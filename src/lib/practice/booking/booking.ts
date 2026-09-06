import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { verifySlotToken, type SlotIdentity } from './slot-token';
import { resolveAvailableTimesForDay } from './availability';
import { fetchExternalBusyBlocks } from './external-busy';
import { verifyTelegramWebAppInitData } from '@/lib/telegram-webapp';
import { resolveSignedPersonalClientToken } from '@/lib/client-workflow';
import { randomUUID } from 'crypto';
import { logSafeFailure } from '@/lib/observability/log';
import {
    trackBookingAttempted,
    trackBookingConflict,
    trackBookingSucceeded,
    type BookingSource,
} from '@/lib/analytics/practice-events';
import type { BlockInput } from './types';

// Task 7 (PRAKTIKA MVP): the single atomic entry point for turning a signed
// slotToken into a DiarySession. Replaces bookSession's ad-hoc
// findFirst(dayOfWeek)-for-duration + read-then-write collision check
// (src/app/bot/actions.ts, pre-Task-7) with:
//   1. exact slot identity from the token — never re-guessed from date/time;
//   2. a Postgres advisory transaction lock scoped to (psychologistId, date),
//      so two concurrent bookings for the same day serialize instead of
//      racing past a stale read;
//   3. re-reading bookedCount/maxSessionsPerDay and re-running the SAME
//      resolver used for display, INSIDE the lock, so a slot that looked
//      open when the client loaded the page but has since been taken,
//      blocked, or capped out is rejected here — not silently double-booked.

export class BookingConflictError extends Error {
    code: 'INVALID_TOKEN' | 'SLOT_UNAVAILABLE' | 'CLIENT_ALREADY_BOOKED' | 'SESSION_NOT_FOUND';
    /**
     * Ниточка для поддержки (Задача 25 §6): по ней в логах находится ровно
     * этот отказ. Проставляется наблюдателем ниже, поэтому необязательна —
     * ядро может бросить конфликт и напрямую, из теста например.
     */
    correlationId?: string;
    constructor(code: BookingConflictError['code'], message: string) {
        super(message);
        this.name = 'BookingConflictError';
        this.code = code;
    }
}

/**
 * Наблюдаемость записи (Задача 25 §5–§6) — одна точка на все три пути.
 *
 * Каноническая точка каждого факта именно здесь, в общем ядре: веб, бот и
 * мобильный API проходят через эти функции, и события, расставленные в
 * маршрутах, считали бы одно и то же по два раза.
 *
 * Попыткой считается запрос, ДОШЕДШИЙ до бронирования: подпись слота уже
 * проверена, ядро начало работу. Мусорный запрос с протухшим токеном
 * попыткой записи не является и в счётчик не идёт.
 *
 * Успех пишется после того, как транзакция вернула управление, — не до
 * коммита: до коммита ничего ещё не произошло.
 *
 * Конфликт пишется вместе с безопасным логом: correlation_id, source и
 * машинный код. Ни времени, ни имени, ни телефона, ни токена в этом логе
 * нет — по нему можно найти инцидент, но нельзя узнать человека.
 */
async function observeBooking<T>(
    source: BookingSource,
    psychologistId: string,
    run: (correlationId: string) => Promise<T>,
): Promise<T> {
    const correlationId = randomUUID();
    await trackBookingAttempted({ accountId: psychologistId }, { source });

    try {
        const result = await run(correlationId);
        await trackBookingSucceeded({ accountId: psychologistId }, { source });
        return result;
    } catch (error) {
        if (error instanceof BookingConflictError) {
            error.correlationId = correlationId;
            logSafeFailure('practice-booking', {
                correlation_id: correlationId,
                source,
                error_code: error.code,
            });
            // INVALID_TOKEN сюда не доходит: подпись слота проверяется до
            // входа в observeBooking, то есть до попытки. Конфликтом
            // попытки, которой не было, он быть не может.
            if (error.code !== 'INVALID_TOKEN') {
                await trackBookingConflict({ accountId: psychologistId }, { source, error_code: error.code });
            }
        } else {
            // Неожиданная ошибка: код категории вместо текста, чтобы в лог
            // не утекло сообщение исключения.
            logSafeFailure('practice-booking', {
                correlation_id: correlationId,
                source,
                error_code: 'INTERNAL_ERROR',
            });
        }
        throw error;
    }
}

export type BookingOrigin = 'self_booking' | 'manual';

export interface CreatePracticeBookingInput {
    psychologistId: string;
    clientId: string;
    slotToken: string;
    origin: BookingOrigin;
    type?: string;
    notes?: string | null;
    /** Skip the client-facing booking buffer when re-resolving (matches how the slot was originally offered — psychologist-facing flows pass true). */
    skipBuffer?: boolean;
    /**
     * External Google/Yandex calendar busy blocks for this day, fetched by
     * the caller BEFORE opening any transaction (network I/O must never
     * happen while holding the advisory lock — see fetchExternalBusyBlocks).
     * Merged into commit-time revalidation alongside DiaryBlock rows.
     */
    externalBusy?: BlockInput[];
}

export interface BookedPracticeSession {
    id: string;
    psychologistId: string;
    clientId: string;
    date: Date;
    time: string;
    endTime: string;
    duration: number;
    format: string;
    addressId: string | null;
    type: string;
    status: string;
    origin: string;
    /** Present only on createManualPracticeSession's result — createPracticeBooking's callers already have the client separately. */
    client?: { id: string; name: string; telegramChatId: string | null; maxChatId?: string | null; phone?: string | null; email?: string | null } | null;
}

function minutesToTimeStr(totalMins: number): string {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Acquires a session-scoped Postgres advisory lock for (psychologistId,
 * dateStr) for the lifetime of the current transaction — released
 * automatically on commit or rollback, no manual unlock needed. Two
 * concurrent bookings for the same psychologist+day always serialize;
 * different days (or different psychologists) never contend.
 */
async function acquireDayLock(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0], psychologistId: string, dateStr: string) {
    const lockKey = `${psychologistId}:${dateStr}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
}

/**
 * Task 8: a second advisory-lock namespace (seed 1, vs the day lock's seed 0
 * — hashtextextended's second argument, so the two keyspaces never collide)
 * scoped to a single sessionId. Reschedule reads-then-writes one existing
 * row, and the row's OLD and NEW day can differ — two concurrent reschedules
 * of the SAME session to two DIFFERENT target days would each only take a
 * day lock, take DIFFERENT day locks, and never serialize against each
 * other. Taking this lock FIRST, before any day lock, on every reschedule
 * closes that gap: any two operations touching the same session always
 * serialize here regardless of which day(s) they target. Acquired first and
 * only by reschedule paths, so it can never invert order against a
 * create-side transaction (which never takes it) — no new deadlock risk.
 */
async function acquireSessionLock(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0], sessionId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${sessionId}, 1))`;
}

function toDateStr(d: Date): string {
    return d.toISOString().slice(0, 10);
}

interface DayWindow {
    dateObj: Date;
    dayStart: Date;
    dayEnd: Date;
    endTime: string;
}

function dayWindowFor(identity: SlotIdentity): DayWindow {
    const [y, m, d] = identity.dateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    const dayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
    const [h, min] = identity.time.split(':').map(Number);
    const endTime = minutesToTimeStr(h * 60 + min + identity.duration);
    return { dateObj, dayStart, dayEnd, endTime };
}

/**
 * The shared "is this exact slot still bookable, right now, under the lock"
 * check — the validation half of the create-side core, and (Task 8) also the
 * ENTIRE validation reschedule needs, since a reschedule is "is this exact
 * slot still available for this client" followed by an UPDATE instead of a
 * CREATE. `excludeSessionId` is what makes it reusable for reschedule: the
 * session being moved must not count against its own target day's collision
 * check, one-booking-per-day rule, or maxSessionsPerDay cap.
 */
async function assertSlotStillAvailable(
    tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
    params: {
        psychologistId: string;
        clientId: string;
        identity: SlotIdentity;
        origin: BookingOrigin;
        skipBuffer?: boolean;
        externalBusy: BlockInput[];
        window: DayWindow;
        /** Reschedule only: the session being moved, excluded from its own target day's checks. */
        excludeSessionId?: string;
    },
): Promise<void> {
    const { identity, window } = params;

    const [settings, slotRow, daySessions, dayBlocks] = await Promise.all([
        tx.psychologistSettings.findUnique({ where: { psychologistId: params.psychologistId } }),
        tx.availabilitySlot.findFirst({
            where: { id: identity.availabilitySlotId, psychologistId: params.psychologistId, isActive: true },
            include: { scheduleRule: true },
        }),
        tx.diarySession.findMany({
            where: {
                psychologistId: params.psychologistId,
                date: { gte: window.dayStart, lte: window.dayEnd },
                status: { not: 'cancelled' },
                ...(params.excludeSessionId ? { id: { not: params.excludeSessionId } } : {}),
            },
            select: { id: true, date: true, time: true, duration: true, clientId: true },
        }),
        tx.diaryBlock.findMany({
            where: { psychologistId: params.psychologistId, date: { gte: window.dayStart, lte: window.dayEnd } },
        }),
    ]);

    if (!slotRow) {
        throw new BookingConflictError('SLOT_UNAVAILABLE', 'Это время больше недоступно — выберите другое.');
    }

    // One client, one booking per day — same rule bookSession enforced.
    if (daySessions.some((s) => s.clientId === params.clientId)) {
        throw new BookingConflictError('CLIENT_ALREADY_BOOKED', 'Вы уже записаны на этот день.');
    }

    // Re-resolve availability for this exact slot, inside the lock, with
    // freshly-read sessions/blocks/settings — the same resolver that decided
    // this slot was bookable when it was first shown. dayBlocks covers
    // internal DiaryBlock rows; externalBusy (fetched by the caller BEFORE
    // this transaction opened — never do network I/O under the advisory
    // lock) covers connected Google/Yandex calendars, so a meeting created
    // there after the slot was offered still blocks the commit.
    const stillOffered = resolveAvailableTimesForDay({
        dateStr: identity.dateStr,
        slots: [slotRow],
        blocks: [...dayBlocks, ...params.externalBusy],
        sessions: daySessions,
        settings,
        clientId: params.origin === 'self_booking' ? params.clientId : null,
        skipBuffer: params.skipBuffer ?? false,
    });

    // A rule with format:'both' resolves to ONE ambiguous option — the
    // concrete online/offline choice is made when the token is minted (see
    // getAvailableTimes), not by the resolver. So a 'both' option matches a
    // token claiming either concrete format, as long as the token's own
    // addressId is consistent with that choice (null for online, the rule's
    // address for offline). availabilitySlotId/scheduleRuleId are checked
    // exactly: if the AvailabilitySlot was rebound to a different
    // ScheduleRule after the token was minted, the old token must fail even
    // if the new rule happens to share the same hours/format/address.
    const matches = stillOffered.some((opt) => {
        if (opt.availabilitySlotId !== identity.availabilitySlotId) return false;
        if (opt.scheduleRuleId !== identity.scheduleRuleId) return false;
        if (opt.time !== identity.time || opt.duration !== identity.duration) return false;
        if (opt.format === identity.format) return opt.addressId === identity.addressId;
        if (opt.format === 'both') {
            if (identity.format === 'online') return identity.addressId === null;
            if (identity.format === 'offline') return identity.addressId === opt.addressId;
        }
        return false;
    });
    if (!matches) {
        throw new BookingConflictError('SLOT_UNAVAILABLE', 'Это время больше недоступно — выберите другое.');
    }
}

/**
 * The shared "re-validate under the lock, then write" core for a NEW
 * booking. Used by both createPracticeBooking (clientId already known) and
 * createSelfPracticeBooking (clientId resolved/created inside the same
 * transaction, just before this runs) — so a rejected booking rolls back
 * identically for both callers.
 */
async function resolveAndCommitSession(
    tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
    params: {
        psychologistId: string;
        clientId: string;
        identity: SlotIdentity;
        origin: BookingOrigin;
        type?: string;
        notes?: string | null;
        skipBuffer?: boolean;
        externalBusy: BlockInput[];
        window: DayWindow;
    },
): Promise<BookedPracticeSession> {
    await assertSlotStillAvailable(tx, params);

    const { identity, window } = params;
    const session = await tx.diarySession.create({
        data: {
            psychologistId: params.psychologistId,
            clientId: params.clientId,
            date: window.dateObj,
            time: identity.time,
            endTime: window.endTime,
            duration: identity.duration,
            format: identity.format,
            addressId: identity.addressId,
            type: params.type || 'individual',
            status: 'confirmed',
            origin: params.origin,
            notes: params.notes || null,
        },
    });

    return session as BookedPracticeSession;
}

export async function createPracticeBooking(input: CreatePracticeBookingInput): Promise<BookedPracticeSession> {
    const identity = verifySlotToken(input.psychologistId, input.slotToken);
    if (!identity) {
        throw new BookingConflictError('INVALID_TOKEN', 'Ссылка на это время устарела или недействительна — выберите время заново.');
    }

    const window = dayWindowFor(identity);
    const externalBusy = input.externalBusy ?? [];

    return observeBooking('known_client', input.psychologistId, () => db.$transaction(async (tx) => {
        await acquireDayLock(tx, input.psychologistId, identity.dateStr);

        return resolveAndCommitSession(tx, {
            psychologistId: input.psychologistId,
            clientId: input.clientId,
            identity,
            origin: input.origin,
            type: input.type,
            notes: input.notes,
            skipBuffer: input.skipBuffer,
            externalBusy,
            window,
        });
    }));
}

function normalizePhone(phone: string): { normalizedPhone: string; plainDigits: string } {
    let normalizedPhone = phone.replace(/[^\d+]/g, '');
    const plainDigits = normalizedPhone.replace(/[^\d]/g, '');

    if (plainDigits.length === 11 && (plainDigits.startsWith('8') || plainDigits.startsWith('7'))) {
        normalizedPhone = '+7' + plainDigits.slice(1);
    } else if (plainDigits.length === 10) {
        normalizedPhone = '+7' + plainDigits;
    } else if (!normalizedPhone.startsWith('+') && normalizedPhone.length > 0) {
        normalizedPhone = '+' + plainDigits;
    }

    return { normalizedPhone, plainDigits };
}

export interface CreateSelfPracticeBookingInput {
    psychologistId: string;
    name: string;
    phone: string;
    slotToken: string;
    /** Raw window.Telegram.WebApp.initData — verified server-side here, never trusted as-is. */
    telegramInitData?: string | null;
    /**
     * Task 14 point 6: the raw signed personal-link token (the same one
     * BookingPageClient already resolved once at page load, via the `?c=`
     * param or a saved compas_clientToken) — re-verified HERE, never trusted
     * as a pre-decoded id. Lets a known client whose phone field the UI
     * hides still resolve to their EXISTING DiaryClient by verified identity
     * instead of the phone-string match below, which silently created a
     * duplicate for a known client with no phone on file.
     */
    clientLinkToken?: string | null;
}

export interface SelfPracticeBookingResult {
    session: BookedPracticeSession;
    client: { id: string; name: string; telegramChatId: string | null; maxChatId: string | null; phone: string | null; email: string | null };
}

// Task 7 (founder review): self-booking's client resolution/creation used to
// run BEFORE createPracticeBooking, outside any transaction — a slot
// conflict or maxSessionsPerDay rejection then rolled back only the session
// write, leaving a freshly-created DiaryClient behind with no booking
// ("an orphan client"). This is the single atomic entry point for
// self-booking: client find-or-create, Telegram binding, consent sync, and
// the slot commit all happen inside ONE transaction under the same
// (psychologist, day) advisory lock, so any BookingConflictError rolls back
// all of it together.
export async function createSelfPracticeBooking(input: CreateSelfPracticeBookingInput): Promise<SelfPracticeBookingResult> {
    const identity = verifySlotToken(input.psychologistId, input.slotToken);
    if (!identity) {
        throw new BookingConflictError('INVALID_TOKEN', 'Ссылка на это время устарела или недействительна — выберите время заново.');
    }

    // Telegram identity is verified locally (no DB/network) — safe before
    // the transaction. Never trust a client-supplied user object
    // (initDataUnsafe.user is fully client-controlled): only an id that
    // survived this HMAC check may ever be written as a telegramChatId.
    const verifiedTelegramUser = verifyTelegramWebAppInitData(input.telegramInitData, process.env.TELEGRAM_BOT_TOKEN);
    const tgUserId = verifiedTelegramUser ? String(verifiedTelegramUser.id) : null;

    const window = dayWindowFor(identity);

    // Network I/O happens here, BEFORE db.$transaction opens — never under
    // the advisory lock.
    const settingsForFetch = await db.psychologistSettings.findUnique({ where: { psychologistId: input.psychologistId } });
    const externalBusy = await fetchExternalBusyBlocks(input.psychologistId, window.dayStart, window.dayEnd, {
        timezone: settingsForFetch?.timezone,
        blockConflicts: settingsForFetch?.blockConflicts ?? true,
    });

    const { normalizedPhone, plainDigits } = normalizePhone(input.phone);

    // Task 14 point 6: re-verify the personal-link token locally (pure,
    // synchronous, no DB) — exactly like telegramInitData above, never trust
    // a pre-decoded clientId from the caller.
    const linkResolution = input.clientLinkToken ? resolveSignedPersonalClientToken(input.clientLinkToken) : null;
    const verifiedLinkClientId = linkResolution?.clientId ?? null;

    return observeBooking('public_booking', input.psychologistId, () => db.$transaction(async (tx) => {
        await acquireDayLock(tx, input.psychologistId, identity.dateStr);

        // Task 14 point 6: a client already identified through a VERIFIED
        // channel (HMAC-checked Telegram id, or a signature this server
        // issued) is matched by that identity FIRST — never by the phone
        // heuristic below, which fails closed to "no match" for a known
        // client whose phone field the UI hid (nothing empty to match) and
        // would otherwise create a duplicate DiaryClient instead of reusing
        // the real one. Only a genuinely unidentified visitor falls through
        // to the phone match.
        let client = tgUserId
            ? await tx.diaryClient.findFirst({ where: { psychologistId: input.psychologistId, telegramChatId: tgUserId } })
            : null;

        if (!client && verifiedLinkClientId) {
            client = await tx.diaryClient.findFirst({ where: { id: verifiedLinkClientId, psychologistId: input.psychologistId } });
        }

        if (!client) {
            client = await tx.diaryClient.findFirst({
                where: {
                    psychologistId: input.psychologistId,
                    OR: [
                        { phone: normalizedPhone },
                        { phone: plainDigits },
                        { phone: '+' + plainDigits },
                        { phone: input.phone }, // legacy formats
                    ],
                },
                orderBy: { createdAt: 'desc' },
            });
        }

        if (!client) {
            client = await tx.diaryClient.create({
                data: {
                    psychologistId: input.psychologistId,
                    name: input.name,
                    phone: normalizedPhone,
                    telegramChatId: tgUserId,
                },
            });
        } else if (tgUserId && !client.telegramChatId) {
            // Клиент найден по телефону — обновляем только telegramChatId, имя НЕ меняем.
            client = await tx.diaryClient.update({
                where: { id: client.id },
                data: { telegramChatId: tgUserId },
            });
        }

        // Привязать TelegramClient → DiaryClient если есть, и синхронизировать согласие.
        if (tgUserId) {
            const tgClient = await tx.telegramClient.findUnique({ where: { telegramUserId: tgUserId } });

            if (tgClient) {
                if (!tgClient.diaryClientId) {
                    await tx.telegramClient.update({
                        where: { id: tgClient.id },
                        data: { diaryClientId: client.id, psychologistId: input.psychologistId },
                    });
                }

                if (tgClient.consentGiven && tgClient.consentDate && !client.consentVersion) {
                    const activeConsentVer = await tx.consentVersion.findFirst({
                        where: { isActive: true },
                        orderBy: { createdAt: 'desc' },
                        select: { version: true },
                    });

                    if (activeConsentVer) {
                        const hashInput = `${tgUserId}:${activeConsentVer.version}:${tgClient.consentDate.toISOString()}`;
                        const hash = createHash('sha256').update(hashInput).digest('hex');
                        client = await tx.diaryClient.update({
                            where: { id: client.id },
                            data: {
                                consentVersion: activeConsentVer.version,
                                consentHash: hash,
                                consentDate: tgClient.consentDate,
                            },
                        });
                    }
                }
            }
        }

        // A BookingConflictError thrown here rolls back this ENTIRE
        // transaction — including the DiaryClient just created/updated
        // above — so a rejected booking never leaves an orphan client.
        const session = await resolveAndCommitSession(tx, {
            psychologistId: input.psychologistId,
            clientId: client.id,
            identity,
            origin: 'self_booking',
            externalBusy,
            window,
        });

        return { session, client };
    }));
}

// Task 8 (PRAKTIKA MVP): "reschedule uses same booking core" — before this,
// src/lib/session-reschedule.ts re-implemented its own read-then-write
// collision check with no advisory lock and no real maxSessionsPerDay
// enforcement, and the web/client-facing reschedule pickers minted a
// slotToken (getAvailableTimes always does) only to throw it away and pass a
// raw date/time string instead. reschedulePracticeBooking makes reschedule a
// first-class citizen of the same core as booking: it takes the SAME
// slotToken the picker already has, re-validates it under the SAME
// (psychologist, day) advisory lock and the SAME assertSlotStillAvailable
// used for a fresh booking, and does an UPDATE instead of a CREATE — the
// session's id/history is preserved, never deleted-then-recreated.
export interface ReschedulePracticeBookingInput {
    psychologistId: string;
    sessionId: string;
    slotToken: string;
    origin: BookingOrigin;
    /** Skip the client-facing booking buffer when re-resolving — psychologist-facing reschedule passes true, same as a fresh manual booking would. */
    skipBuffer?: boolean;
}

export interface ReschedulePracticeBookingResult {
    session: BookedPracticeSession;
    /** The slot being freed — callers use this for calendar sync and to notify the waitlist of the newly-open old slot. */
    previousDate: Date;
    previousTime: string;
}

export async function reschedulePracticeBooking(input: ReschedulePracticeBookingInput): Promise<ReschedulePracticeBookingResult> {
    const identity = verifySlotToken(input.psychologistId, input.slotToken);
    if (!identity) {
        throw new BookingConflictError('INVALID_TOKEN', 'Ссылка на это время устарела или недействительна — выберите время заново.');
    }

    const window = dayWindowFor(identity);

    // Network I/O before opening the transaction — never under the advisory lock.
    const settingsForFetch = await db.psychologistSettings.findUnique({ where: { psychologistId: input.psychologistId } });
    const externalBusy = await fetchExternalBusyBlocks(input.psychologistId, window.dayStart, window.dayEnd, {
        timezone: settingsForFetch?.timezone,
        blockConflicts: settingsForFetch?.blockConflicts ?? true,
    });

    return observeBooking('reschedule', input.psychologistId, () => db.$transaction(async (tx) => {
        // Session lock FIRST (see acquireSessionLock) — serializes this
        // against any other reschedule of the SAME session before either
        // side has even read it, regardless of which day(s) each targets.
        await acquireSessionLock(tx, input.sessionId);

        const existing = await tx.diarySession.findFirst({ where: { id: input.sessionId, psychologistId: input.psychologistId } });
        if (!existing) {
            throw new BookingConflictError('SESSION_NOT_FOUND', 'Сессия не найдена');
        }
        if (existing.status === 'cancelled') {
            throw new BookingConflictError('SESSION_NOT_FOUND', 'Эта сессия уже отменена');
        }

        // A reschedule can move a session to a DIFFERENT day than it's
        // currently on — lock both, in a fixed (sorted) order, so two
        // unrelated reschedules that happen to touch an overlapping pair of
        // days can never deadlock against each other.
        const oldDateStr = toDateStr(existing.date);
        const dateStrs = Array.from(new Set([oldDateStr, identity.dateStr])).sort();
        for (const ds of dateStrs) {
            await acquireDayLock(tx, input.psychologistId, ds);
        }

        // excludeSessionId: this session's OWN current booking must not
        // count against the target day's one-booking-per-day rule or
        // maxSessionsPerDay cap — it's the same booking being moved, not an
        // additional one.
        await assertSlotStillAvailable(tx, {
            psychologistId: input.psychologistId,
            clientId: existing.clientId,
            identity,
            origin: input.origin,
            skipBuffer: input.skipBuffer,
            externalBusy,
            window,
            excludeSessionId: input.sessionId,
        });

        // Task 7's principle carried over: the token is the only source of
        // truth for format/addressId/duration — a reschedule to a slot with
        // a different format now actually applies that format, instead of
        // silently keeping the session's old one (session-reschedule.ts
        // never touched format/addressId at all).
        const session = await tx.diarySession.update({
            where: { id: input.sessionId },
            data: {
                date: window.dateObj,
                time: identity.time,
                endTime: window.endTime,
                duration: identity.duration,
                format: identity.format,
                addressId: identity.addressId,
                notified24h: false,
                notified1h: false,
            },
        });

        return { session: session as BookedPracticeSession, previousDate: existing.date, previousTime: existing.time };
    }));
}

// Task 8: the mobile/Android reschedule is, like createManualPracticeSession,
// NOT tied to any AvailabilitySlot — the psychologist can move a session to
// any time on purpose, on or off their configured schedule. So there is no
// slotToken here either: same shape as the old inline logic in
// src/app/api/mobile/sessions/[id]/route.ts, just moved behind the shared
// advisory locks (session lock + both days' day locks) and a real
// maxSessionsPerDay re-check when the move actually changes the day.
export interface RescheduleManualSessionInput {
    psychologistId: string;
    sessionId: string;
    dateStr: string; // "YYYY-MM-DD"
    time: string; // "HH:MM"
    /** Applied verbatim if given — callers decide their own default (e.g. the mobile route resets to 'pending' on reschedule unless the caller says otherwise). */
    status?: string;
    /** Extra fields (e.g. notes/structuredNotes) merged into the same UPDATE — kept in one write rather than a second, non-atomic one. */
    extraUpdateData?: Record<string, unknown>;
}

export interface RescheduleManualSessionResult {
    session: BookedPracticeSession;
    previousDate: Date;
    previousTime: string;
}

export async function rescheduleManualPracticeSession(input: RescheduleManualSessionInput): Promise<RescheduleManualSessionResult> {
    const [y, m, d] = input.dateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    const dayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
    const [h, min] = input.time.split(':').map(Number);
    const newStartMins = h * 60 + min;

    return db.$transaction(async (tx) => {
        await acquireSessionLock(tx, input.sessionId);

        const existing = await tx.diarySession.findFirst({ where: { id: input.sessionId, psychologistId: input.psychologistId } });
        if (!existing) {
            throw new BookingConflictError('SESSION_NOT_FOUND', 'Сессия не найдена');
        }
        if (existing.status === 'cancelled') {
            throw new BookingConflictError('SESSION_NOT_FOUND', 'Эта сессия уже отменена');
        }

        const duration = existing.duration || 50;
        const newEndMins = newStartMins + duration;
        const endTime = minutesToTimeStr(newEndMins);

        const oldDateStr = toDateStr(existing.date);
        const movingDay = oldDateStr !== input.dateStr;
        const dateStrs = Array.from(new Set([oldDateStr, input.dateStr])).sort();
        for (const ds of dateStrs) {
            await acquireDayLock(tx, input.psychologistId, ds);
        }

        const [settings, daySessions] = await Promise.all([
            tx.psychologistSettings.findUnique({ where: { psychologistId: input.psychologistId } }),
            tx.diarySession.findMany({
                where: {
                    psychologistId: input.psychologistId,
                    id: { not: input.sessionId },
                    date: { gte: dayStart, lte: dayEnd },
                    status: { not: 'cancelled' },
                },
                select: { time: true, duration: true },
            }),
        ]);

        // The cap only matters when this move actually adds to the target
        // day's count — staying on the same day and only changing the time
        // never changes how many sessions that day has.
        if (movingDay && settings?.maxSessionsPerDay && daySessions.length >= settings.maxSessionsPerDay) {
            throw new BookingConflictError('SLOT_UNAVAILABLE', 'На эту дату у специалиста уже максимум записей.');
        }

        const collision = daySessions.some((s) => {
            const [eH, eM] = s.time.split(':').map(Number);
            const eStart = eH * 60 + eM;
            const eEnd = eStart + (s.duration || 50);
            return newStartMins < eEnd && newEndMins > eStart;
        });
        if (collision) {
            throw new BookingConflictError('SLOT_UNAVAILABLE', 'Это время уже занято другой сессией.');
        }

        const session = await tx.diarySession.update({
            where: { id: input.sessionId },
            data: {
                date: dateObj,
                time: input.time,
                endTime,
                ...(input.status !== undefined ? { status: input.status } : {}),
                notified24h: false,
                notified1h: false,
                ...(input.extraUpdateData || {}),
            },
            include: { client: true },
        });

        return { session: session as BookedPracticeSession, previousDate: existing.date, previousTime: existing.time };
    });
}

// Task 7: a psychologist creating a session manually (web SessionModal,
// Android) is NOT tied to any AvailabilitySlot — they can pick a time
// outside their own configured schedule on purpose ("Запись создастся вне
// расписания"). So there is no slotToken here. What manual creation DOES
// need is the same safety the slot-token path gets: an advisory lock per
// (psychologist, day) so two concurrent manual/self-booking requests for
// the same day can't both pass a stale collision/cap check, real
// maxSessionsPerDay enforcement, and idempotent replay by clientRequestId
// (mobile can retry a lost response without ever risking a duplicate,
// since the lock serializes the retry against the original instead of
// racing it).
export interface CreateManualSessionInput {
    psychologistId: string;
    clientId: string;
    dateStr: string; // "YYYY-MM-DD"
    time: string; // "HH:MM"
    duration?: number;
    type?: string;
    format?: string;
    addressId?: string | null;
    status?: string;
    notes?: string | null;
    clientRequestId?: string | null;
}

export interface CreateManualSessionResult {
    session: BookedPracticeSession;
    /** True when clientRequestId matched an existing row — no new session was created (idempotent replay). */
    alreadyExisted: boolean;
}

export async function createManualPracticeSession(input: CreateManualSessionInput): Promise<CreateManualSessionResult> {
    const [y, m, d] = input.dateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    const dayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
    const duration = input.duration || 50;
    const [h, min] = input.time.split(':').map(Number);
    const newStartMins = h * 60 + min;
    const newEndMins = newStartMins + duration;
    const endTime = minutesToTimeStr(newEndMins);

    return db.$transaction(async (tx) => {
        await acquireDayLock(tx, input.psychologistId, input.dateStr);

        if (input.clientRequestId) {
            const already = await tx.diarySession.findFirst({
                where: { clientRequestId: input.clientRequestId, psychologistId: input.psychologistId },
                include: { client: true },
            });
            if (already) return { session: already as BookedPracticeSession, alreadyExisted: true };
        }

        const [settings, daySessions] = await Promise.all([
            tx.psychologistSettings.findUnique({ where: { psychologistId: input.psychologistId } }),
            tx.diarySession.findMany({
                where: { psychologistId: input.psychologistId, date: { gte: dayStart, lte: dayEnd }, status: { not: 'cancelled' } },
                select: { time: true, duration: true },
            }),
        ]);

        if (settings?.maxSessionsPerDay && daySessions.length >= settings.maxSessionsPerDay) {
            throw new BookingConflictError('SLOT_UNAVAILABLE', 'На эту дату у специалиста уже максимум записей.');
        }

        const collision = daySessions.some((s) => {
            const [eH, eM] = s.time.split(':').map(Number);
            const eStart = eH * 60 + eM;
            const eEnd = eStart + (s.duration || 50);
            return newStartMins < eEnd && newEndMins > eStart;
        });
        if (collision) {
            throw new BookingConflictError('SLOT_UNAVAILABLE', 'Это время уже занято другой сессией.');
        }

        const session = await tx.diarySession.create({
            data: {
                psychologistId: input.psychologistId,
                clientId: input.clientId,
                date: dateObj,
                time: input.time,
                endTime,
                duration,
                type: input.type || 'individual',
                format: input.format || 'online',
                addressId: input.addressId ?? null,
                status: input.status || 'confirmed',
                origin: 'manual',
                notes: input.notes ?? null,
                clientRequestId: input.clientRequestId ?? null,
            },
            include: { client: true },
        });

        return { session: session as BookedPracticeSession, alreadyExisted: false };
    });
}
