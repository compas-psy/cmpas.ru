// Outbox for session reminders (O-260817-16, CJM_booking_v2.md §1 «восьмое,
// невидимое»). Replaces the old ±15-minute in-process node-cron scan
// (formerly src/lib/cron/reminders.ts) with one row per planned send:
//   - a unique (sessionId, kind) row makes a duplicate send physically
//     impossible, not just unlikely;
//   - the claim query is "everything overdue and not yet sent", not a
//     window, so a gap in polling (restart, deploy) catches up on the next
//     tick instead of losing the reminder silently;
//   - FOR UPDATE SKIP LOCKED means two worker replicas never claim the same
//     row, so "two copies of the site" can no longer mean "sent twice".
//
// Message TEXT is unchanged from the old reminders.ts — this file only
// changes WHEN and HOW RELIABLY a message goes out, never WHAT it says
// (boundary of this order: text is separate CJM work).

import type { Prisma, PrismaClient } from '@prisma/client';
import { clientActionToken, clientBookingLink, publicBaseUrl } from '@/lib/client-workflow';
import { sendTelegramMessage, type SendMessageOptions } from '@/lib/telegram';
import { sendMaxMessage as sendMaxText } from '@/lib/max';
import { sendMaxMessage as sendMaxFull } from '@/lib/max-bot';

type TelegramInlineKeyboardRow = NonNullable<SendMessageOptions['reply_markup']>['inline_keyboard'][number];

export const REMINDER_KINDS = ['client_24h', 'client_1h', 'psychologist_reminder'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** How long a claim ("sending") is honored before another worker may retry it — covers a crash mid-send. */
const LOCK_TIMEOUT_MS = 5 * MINUTE_MS;
/** Sent later than this after dueAt counts as a caught-up, late send for the dashboard — not lost, just late. */
const LATE_THRESHOLD_MS = 15 * MINUTE_MS;
/** After this many failed attempts, stop retrying — the row stays "failed" and visible, not retried forever. */
const MAX_ATTEMPTS = 5;

type Db = Pick<PrismaClient, 'diarySession' | 'reminderOutbox' | '$queryRaw'>;

function dueAtFor(kind: ReminderKind, sessionDate: Date): Date {
    if (kind === 'client_1h') return new Date(sessionDate.getTime() - HOUR_MS);
    // client_24h and psychologist_reminder both fire a day before, same as
    // the old reminders.ts — see the module header for why
    // psychologist_reminder isn't tied to NotificationSettings.reminderMinutesBefore.
    return new Date(sessionDate.getTime() - DAY_MS);
}

// ── Scheduling: one row per (session, enabled kind) ─────────────────────────

/**
 * Creates outbox rows for upcoming sessions that don't have one yet, refreshes
 * `dueAt` on still-pending rows (a reschedule moves the session's `date`),
 * and skips rows for a kind the psychologist has since turned off. Safe to
 * call every poll — `skipDuplicates` and the (sessionId, kind) unique index
 * make it idempotent.
 */
export async function ensureOutboxRows(db: Db, now: Date = new Date()): Promise<void> {
    const sessions = await db.diarySession.findMany({
        where: { status: { in: ['pending', 'confirmed'] }, date: { gte: now } },
        select: {
            id: true,
            date: true,
            psychologist: {
                select: {
                    notificationSettings: {
                        select: { reminderEnabled: true, clientReminder25hEnabled: true, clientReminder1hEnabled: true },
                    },
                },
            },
        },
    });

    const toCreate: Prisma.ReminderOutboxCreateManyInput[] = [];
    const wantedByKind: Record<ReminderKind, Map<string, Date>> = {
        client_24h: new Map(),
        client_1h: new Map(),
        psychologist_reminder: new Map(),
    };

    for (const session of sessions) {
        // No settings row yet = defaults apply (NotificationSettings model
        // defaults every enabled flag to true) — an absent row is not "off".
        const settings = session.psychologist.notificationSettings;
        const enabled: Record<ReminderKind, boolean> = {
            client_24h: settings?.clientReminder25hEnabled ?? true,
            client_1h: settings?.clientReminder1hEnabled ?? true,
            psychologist_reminder: settings?.reminderEnabled ?? true,
        };

        for (const kind of REMINDER_KINDS) {
            const due = dueAtFor(kind, session.date);
            if (enabled[kind]) {
                wantedByKind[kind].set(session.id, due);
                toCreate.push({ sessionId: session.id, kind, dueAt: due });
            }
        }
    }

    if (toCreate.length > 0) {
        await db.reminderOutbox.createMany({ data: toCreate, skipDuplicates: true });
    }

    // Refresh dueAt on pending rows whose session moved (reschedule), and
    // retire pending rows for a kind that's now disabled or whose session
    // dropped out of (pending, confirmed) — a cancelled session gets no
    // more reminders, regardless of what was already queued.
    const pending = await db.reminderOutbox.findMany({
        where: { status: 'pending' },
        select: { id: true, sessionId: true, kind: true, dueAt: true },
    });

    for (const row of pending) {
        const kind = row.kind as ReminderKind;
        const wantedDue = wantedByKind[kind].get(row.sessionId);
        if (wantedDue === undefined) {
            await db.reminderOutbox.update({ where: { id: row.id }, data: { status: 'skipped' } });
        } else if (wantedDue.getTime() !== row.dueAt.getTime()) {
            await db.reminderOutbox.update({ where: { id: row.id }, data: { dueAt: wantedDue } });
        }
    }
}

// ── Claiming: FOR UPDATE SKIP LOCKED so two workers never send the same row ─

interface ClaimedRow {
    id: string;
    sessionId: string;
    kind: string;
    dueAt: Date;
}

/**
 * Atomically claims up to `limit` due rows for this worker. Two workers
 * running this concurrently split the batch instead of double-claiming —
 * that's what SKIP LOCKED buys over a plain SELECT+UPDATE.
 */
export async function claimDueRows(
    db: Db,
    workerId: string,
    now: Date = new Date(),
    limit = 20
): Promise<ClaimedRow[]> {
    const lockCutoff = new Date(now.getTime() - LOCK_TIMEOUT_MS);
    return db.$queryRaw<ClaimedRow[]>`
        WITH claimed AS (
            SELECT "id" FROM "ReminderOutbox"
            WHERE ("status" = 'pending' OR ("status" = 'sending' AND "lockedAt" < ${lockCutoff}))
              AND "dueAt" <= ${now}
            ORDER BY "dueAt" ASC
            LIMIT ${limit}
            FOR UPDATE SKIP LOCKED
        )
        UPDATE "ReminderOutbox" r
        SET "status" = 'sending', "lockedAt" = ${now}, "lockedBy" = ${workerId}, "attempts" = r."attempts" + 1
        FROM claimed
        WHERE r."id" = claimed."id"
        RETURNING r."id", r."sessionId", r."kind", r."dueAt"
    `;
}

// ── Sending: build the same message reminders.ts always built, dispatch it ──

async function sendToClientAndMaybePsychologist(
    kind: 'client_24h' | 'client_1h',
    session: NonNullable<Awaited<ReturnType<typeof loadSessionForSend>>>
): Promise<{ ok: boolean; error?: string }> {
    const client = session.client;
    if (!client) return { ok: false, error: 'client not found' };

    const onlineLink = session.psychologist?.psychologistSettings?.onlineSessionLink;
    const telegramId = client.telegramClient?.telegramUserId || client.telegramChatId;
    const maxId =
        client.telegramClient?.telegramUserId?.startsWith('max_')
            ? client.telegramClient.telegramUserId
            : client.maxChatId;
    const telegramTarget = maxId && telegramId === maxId ? null : telegramId;

    if (!telegramTarget && !maxId) return { ok: true }; // nothing to notify — not a failure

    const psychologistName = session.psychologist?.name || 'Ваш психолог';
    let text: string;
    if (kind === 'client_24h') {
        const linkText = session.format === 'online' && onlineLink ? `\n🔗 Ссылка для подключения: ${onlineLink}` : '';
        const confirmationText =
            session.status === 'pending' ? '\n\nПожалуйста, подтвердите встречу кнопкой ниже.' : '\n\nВстреча уже подтверждена.';
        text = `Напоминание о сессии\n\nЗдравствуйте, ${client.name}! Завтра в ${session.time} у вас встреча с психологом (${psychologistName}).\nФормат: ${session.format === 'online' ? 'Онлайн' : `В кабинете: ${session.address?.name || 'адрес уточнит специалист'}`}.${linkText}${confirmationText}`;
    } else {
        const linkText = session.format === 'online' && onlineLink ? `\n🔗 Подключение: ${onlineLink}` : '';
        const confirmationText = session.status === 'pending' ? '\nПодтвердите, пожалуйста, встречу.' : '';
        text = `Сессия начнётся через 1 час, в ${session.time}.${linkText}${confirmationText}`;
    }

    const result = await sendNotification(telegramTarget, maxId, text, sessionActions(session, session.status === 'pending'));
    if (!result.ok) return result;

    if (kind === 'client_24h') {
        const psychologistTelegramId = session.psychologist?.telegramChatId;
        const psychologistMaxId = session.psychologist?.maxChatId;
        if (psychologistTelegramId || psychologistMaxId) {
            const statusText = session.status === 'confirmed' ? 'подтверждена' : 'ожидает подтверждения';
            const message = `Завтра в ${session.time} сессия с клиентом ${client.name}. Статус: ${statusText}.`;
            // Best-effort: the client-facing send above already succeeded and is
            // what this row's outcome tracks; a failed psychologist copy is
            // logged but doesn't turn a delivered client reminder into "failed".
            await sendNotification(psychologistTelegramId, psychologistMaxId, message, {
                reply_markup: { inline_keyboard: [[{ text: '👤 Профиль клиента', url: `https://cmpas.ru/diary/clients?clientId=${client.id}` }]] },
            }).catch((e) => console.error('[reminders-outbox] psychologist copy failed:', e));
        }
    }

    return { ok: true };
}

async function sendPsychologistReminder(
    session: NonNullable<Awaited<ReturnType<typeof loadSessionForSend>>>
): Promise<{ ok: boolean; error?: string }> {
    const client = session.client;
    if (!client) return { ok: false, error: 'client not found' };
    const psychologistTelegramId = session.psychologist?.telegramChatId;
    const psychologistMaxId = session.psychologist?.maxChatId;
    if (!psychologistTelegramId && !psychologistMaxId) return { ok: true };

    const statusText = session.status === 'confirmed' ? 'подтверждена' : 'ожидает подтверждения';
    const message = `Завтра в ${session.time} сессия с клиентом ${client.name}. Статус: ${statusText}.`;
    return sendNotification(psychologistTelegramId, psychologistMaxId, message, {
        reply_markup: { inline_keyboard: [[{ text: '👤 Профиль клиента', url: `https://cmpas.ru/diary/clients?clientId=${client.id}` }]] },
    });
}

async function sendNotification(
    tgChatId: string | null | undefined,
    maxChatId: string | null | undefined,
    text: string,
    options?: Parameters<typeof sendTelegramMessage>[2]
): Promise<{ ok: boolean; error?: string }> {
    const errors: string[] = [];
    if (tgChatId) {
        const ok = await sendTelegramMessage(tgChatId, text, options);
        if (!ok) errors.push('telegram send failed');
    }
    if (maxChatId) {
        const telegramKeyboard = options?.reply_markup?.inline_keyboard;
        let result;
        if (telegramKeyboard) {
            const maxButtons = telegramKeyboard.map((row: TelegramInlineKeyboardRow) =>
                row.map((button) =>
                    button.url
                        ? { text: button.text, url: button.url }
                        : { text: button.text, payload: button.callback_data || '' }
                )
            );
            result = await sendMaxFull(maxChatId, text.replace(/<[^>]+>/g, ''), maxButtons);
        } else {
            result = await sendMaxText(maxChatId, text.replace(/<[^>]+>/g, ''));
        }
        if (result === null) errors.push('max send failed');
    }
    return errors.length > 0 ? { ok: false, error: errors.join('; ') } : { ok: true };
}

function sessionActions(session: { id: string; psychologistId: string; clientId: string }, pending: boolean) {
    const token = clientActionToken(session.psychologistId, session.clientId);
    const actionUrl = (action: string) => `${publicBaseUrl()}/api/client/session-action?s=${session.id}&a=${action}&t=${token}`;
    const rows: Array<Array<{ text: string; url: string }>> = [];
    if (pending) rows.push([{ text: '✅ Подтвердить', url: actionUrl('confirm') }]);
    rows.push([
        { text: '🔄 Перенести', url: clientBookingLink(session.psychologistId, session.clientId) },
        { text: '❌ Отменить', url: actionUrl('cancel') },
    ]);
    return { reply_markup: { inline_keyboard: rows } };
}

async function loadSessionForSend(db: Db, sessionId: string) {
    return db.diarySession.findUnique({
        where: { id: sessionId },
        include: {
            client: { include: { telegramClient: true } },
            psychologist: { include: { psychologistSettings: true } },
            address: true,
        },
    });
}

/** Sends one claimed row. Never throws — failures come back as `{ ok: false }` for the caller to record. */
export async function sendOutboxRow(db: Db, row: ClaimedRow): Promise<{ ok: boolean; error?: string }> {
    try {
        const session = await loadSessionForSend(db, row.sessionId);
        if (!session) return { ok: false, error: 'session not found' };
        if (!['pending', 'confirmed'].includes(session.status)) return { ok: true }; // cancelled/completed since claim — nothing to send, not a failure

        const kind = row.kind as ReminderKind;
        if (kind === 'client_24h' || kind === 'client_1h') return sendToClientAndMaybePsychologist(kind, session);
        return sendPsychologistReminder(session);
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}

// ── Finalizing a claimed row ─────────────────────────────────────────────────

export async function markSent(db: Db, row: ClaimedRow, now: Date = new Date()): Promise<void> {
    const late = now.getTime() - row.dueAt.getTime() > LATE_THRESHOLD_MS;
    await db.reminderOutbox.updateMany({
        where: { id: row.id, status: 'sending' },
        data: { status: 'sent', sentAt: now, late, sendCount: { increment: 1 } },
    });
}

export async function markFailed(db: Db, row: ClaimedRow, error: string, attempts: number): Promise<void> {
    const giveUp = attempts >= MAX_ATTEMPTS;
    await db.reminderOutbox.updateMany({
        where: { id: row.id, status: 'sending' },
        data: { status: giveUp ? 'failed' : 'pending', lastError: error.slice(0, 500), lockedAt: null },
    });
}

// ── One poll cycle — this is what the standalone worker calls in a loop ─────

export interface OutboxRunResult {
    claimed: number;
    sent: number;
    failed: number;
}

export async function runOutboxOnce(db: Db, workerId: string, now: Date = new Date(), batchSize = 20): Promise<OutboxRunResult> {
    await ensureOutboxRows(db, now);

    const claimed = await claimDueRows(db, workerId, now, batchSize);
    let sent = 0;
    let failed = 0;

    for (const row of claimed) {
        const result = await sendOutboxRow(db, row);
        if (result.ok) {
            await markSent(db, row, new Date());
            sent += 1;
        } else {
            // attempts was already incremented by the claim query.
            const current = await db.reminderOutbox.findUnique({ where: { id: row.id }, select: { attempts: true } });
            await markFailed(db, row, result.error ?? 'unknown error', current?.attempts ?? MAX_ATTEMPTS);
            failed += 1;
        }
    }

    return { claimed: claimed.length, sent, failed };
}

// ── Dashboard numbers (TZ_management_dashboard.md §9.6) ─────────────────────

export interface ReminderOutboxCounters {
    /** "должно было уйти" — due by now, regardless of outcome. */
    due: number;
    /** "ушло" — actually sent. */
    sent: number;
    /** "ушло дважды" — sendCount > 1; the unique constraint + claim query should keep this at 0. */
    sentTwice: number;
}

export async function getReminderOutboxCounters(db: Db, now: Date = new Date()): Promise<ReminderOutboxCounters> {
    const [due, sent, sentTwice] = await Promise.all([
        db.reminderOutbox.count({ where: { dueAt: { lte: now } } }),
        db.reminderOutbox.count({ where: { status: 'sent' } }),
        db.reminderOutbox.count({ where: { sendCount: { gt: 1 } } }),
    ]);
    return { due, sent, sentTwice };
}
