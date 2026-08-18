import { db } from '@/lib/db';

export type NotificationType =
    | 'session_confirmed'
    | 'session_cancelled'
    | 'session_pending'
    | 'new_booking'
    | 'channel_linked'
    | 'homework_received'
    | 'document_acknowledged'
    | 'document_opened'
    | 'session_needs_note'
    | 'client_cancel_attempt'
    | 'invite_expired'
    | 'session_unpaid'
    | 'consent_revoked';

/** Writes a notification at the moment an event happens, so the psychologist's
 * bell/center has real history and read-state instead of a 7-day rolling
 * window recomputed on every dashboard request. Never throws — a failed
 * write must not break the action that triggered it. */
export async function createNotification(params: {
    psychologistId: string;
    type: NotificationType;
    title: string;
    subtitle?: string | null;
    sessionId?: string | null;
    clientId?: string | null;
}) {
    try {
        await db.practiceNotification.create({
            data: {
                psychologistId: params.psychologistId,
                type: params.type,
                title: params.title,
                subtitle: params.subtitle || null,
                sessionId: params.sessionId || null,
                clientId: params.clientId || null,
            },
        });
    } catch (e) {
        console.error('[notifications] createNotification failed:', e);
    }
}

export async function listNotifications(psychologistId: string, params: { cursor?: string; limit?: number } = {}) {
    const limit = Math.min(params.limit ?? 20, 50);
    const items = await db.practiceNotification.findMany({
        where: { psychologistId },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
    const hasMore = items.length > limit;
    return {
        items: items.slice(0, limit),
        nextCursor: hasMore ? items[limit - 1].id : null,
    };
}

export async function getUnreadCount(psychologistId: string) {
    return db.practiceNotification.count({ where: { psychologistId, readAt: null } });
}

export async function markNotificationsRead(psychologistId: string, ids?: string[]) {
    await db.practiceNotification.updateMany({
        where: {
            psychologistId,
            readAt: null,
            ...(ids?.length ? { id: { in: ids } } : {}),
        },
        data: { readAt: new Date() },
    });
}
