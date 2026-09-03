import { db } from '@/lib/db';
import { verifySlotToken } from './slot-token';
import { resolveAvailableTimesForDay } from './availability';

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

export async function createPracticeBooking(input: CreatePracticeBookingInput): Promise<BookedPracticeSession> {
    const identity = verifySlotToken(input.psychologistId, input.slotToken);
    if (!identity) {
        throw new BookingConflictError('INVALID_TOKEN', 'Ссылка на это время устарела или недействительна — выберите время заново.');
    }

    const [y, m, d] = identity.dateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    const dayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
    const [h, min] = identity.time.split(':').map(Number);
    const endTime = minutesToTimeStr(h * 60 + min + identity.duration);

    return db.$transaction(async (tx) => {
        await acquireDayLock(tx, input.psychologistId, identity.dateStr);

        const [settings, slotRow, daySessions, dayBlocks] = await Promise.all([
            tx.psychologistSettings.findUnique({ where: { psychologistId: input.psychologistId } }),
            tx.availabilitySlot.findFirst({
                where: { id: identity.availabilitySlotId, psychologistId: input.psychologistId, isActive: true },
                include: { scheduleRule: true },
            }),
            tx.diarySession.findMany({
                where: { psychologistId: input.psychologistId, date: { gte: dayStart, lte: dayEnd }, status: { not: 'cancelled' } },
                select: { id: true, date: true, time: true, duration: true, clientId: true },
            }),
            tx.diaryBlock.findMany({
                where: { psychologistId: input.psychologistId, date: { gte: dayStart, lte: dayEnd } },
            }),
        ]);

        if (!slotRow) {
            throw new BookingConflictError('SLOT_UNAVAILABLE', 'Это время больше недоступно — выберите другое.');
        }

        // One client, one booking per day — same rule bookSession enforced.
        if (daySessions.some((s) => s.clientId === input.clientId)) {
            throw new BookingConflictError('CLIENT_ALREADY_BOOKED', 'Вы уже записаны на этот день.');
        }

        // Re-resolve availability for this exact slot, inside the lock, with
        // freshly-read sessions/blocks/settings — the same resolver that
        // decided this slot was bookable when it was first shown. Only
        // internal DiaryBlock rows are re-checked here (not external-calendar
        // blocks, which would mean live network I/O while holding the lock);
        // external-calendar conflicts were already checked when the slot was
        // offered, and a slot that collides with one now will still be caught
        // by autoSyncSessionToCalendars / the next display refresh.
        const stillOffered = resolveAvailableTimesForDay({
            dateStr: identity.dateStr,
            slots: [slotRow],
            blocks: dayBlocks,
            sessions: daySessions,
            settings,
            clientId: input.origin === 'self_booking' ? input.clientId : null,
            skipBuffer: input.skipBuffer ?? false,
        });

        // A rule with format:'both' resolves to ONE ambiguous option — the
        // concrete online/offline choice is made when the token is minted
        // (see getAvailableTimes), not by the resolver. So a 'both' option
        // matches a token claiming either concrete format, as long as the
        // token's own addressId is consistent with that choice (null for
        // online, the rule's address for offline).
        const matches = stillOffered.some((opt) => {
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
                psychologistId: input.psychologistId,
                clientId: input.clientId,
                date: dateObj,
                time: identity.time,
                endTime,
                duration: identity.duration,
                format: identity.format,
                addressId: identity.addressId,
                type: input.type || 'individual',
                status: 'confirmed',
                origin: input.origin,
                notes: input.notes || null,
            },
        });

        return session as BookedPracticeSession;
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
