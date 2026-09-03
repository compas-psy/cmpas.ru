import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { verifySlotToken, type SlotIdentity } from './slot-token';
import { resolveAvailableTimesForDay } from './availability';
import { fetchExternalBusyBlocks } from './external-busy';
import { verifyTelegramWebAppInitData } from '@/lib/telegram-webapp';
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
    code: 'INVALID_TOKEN' | 'SLOT_UNAVAILABLE' | 'CLIENT_ALREADY_BOOKED';
    constructor(code: BookingConflictError['code'], message: string) {
        super(message);
        this.name = 'BookingConflictError';
        this.code = code;
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
 * The shared "re-validate under the lock, then write" core. Used by both
 * createPracticeBooking (clientId already known) and createSelfPracticeBooking
 * (clientId resolved/created inside the same transaction, just before this
 * runs) — so a rejected booking rolls back identically for both callers.
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
    const { identity, window } = params;

    const [settings, slotRow, daySessions, dayBlocks] = await Promise.all([
        tx.psychologistSettings.findUnique({ where: { psychologistId: params.psychologistId } }),
        tx.availabilitySlot.findFirst({
            where: { id: identity.availabilitySlotId, psychologistId: params.psychologistId, isActive: true },
            include: { scheduleRule: true },
        }),
        tx.diarySession.findMany({
            where: { psychologistId: params.psychologistId, date: { gte: window.dayStart, lte: window.dayEnd }, status: { not: 'cancelled' } },
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

    return db.$transaction(async (tx) => {
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
    });
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

    return db.$transaction(async (tx) => {
        await acquireDayLock(tx, input.psychologistId, identity.dateStr);

        let client = await tx.diaryClient.findFirst({
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
