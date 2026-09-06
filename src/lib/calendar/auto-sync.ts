'use server';

import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { logSafeFailure, providerErrorCode } from '@/lib/observability/log';

// Task 12 (PRAKTIKA MVP, founder correction round 3): the sync adapter is
// now link-aware, closing the gap the Task 8 comment tracked here for two
// rounds:
//   - autoSyncSessionToCalendars checks CalendarSessionLink FIRST: a
//     session already linked to an integration gets its EXISTING external
//     event updated in place; only a session with no link yet gets a new
//     event created (and a new link, sourceRole='synced').
//   - autoDeleteSessionFromCalendars now deletes the LINKED event by its
//     real externalEventId for both providers (Yandex real delete closes
//     the long-standing no-op gap), then removes the link row(s).
//   - Every reschedule call site used to call
//     autoDeleteSessionFromCalendars() then autoSyncSessionToCalendars() —
//     delete the old event, create a new one. That pattern is gone: a
//     reschedule now calls ONLY autoSyncSessionToCalendars(), which finds
//     the existing link and updates in place — see
//     src/app/client/reschedule/[sessionId]/actions.ts,
//     src/app/diary/actions/sessions.ts#rescheduleSession, and
//     src/app/api/mobile/sessions/[id]/route.ts's reschedule branch.
//   - `excludeIntegrationId` lets commit.ts, after importing a session FROM
//     integration X, sync it OUT to the psychologist's OTHER connected
//     integrations without reflecting a second event back into X.

// Задача 25 §11: синхронизация календарей ломается тихо и незаметно, потому
// что она best-effort: вызывающий её код ничего не ждёт и ничего не проверяет.
// Отсюда требование к логу — быть годным для разбора и при этом безопасным.
//
// Прежние строки вида `Auto-sync failed for google: ${e}` выглядели невинно,
// пока не вспомнишь, ЧТО именно синхронизируется. В теле ответа Google или
// CalDAV лежит само событие: заголовок «Сессия — Анна Волкова», описание с
// заметкой, иногда адрес кабинета. Один console.error — и имя клиента живёт в
// логах ровно столько, сколько живут логи.
//
// Поэтому наружу выходят три поля: какой провайдер, какая категория отказа и
// какой операции это касается. Ни исключения, ни его текста, ни стека, ни тела
// ответа провайдера, ни токенов, ни названия встречи. Одна операция
// синхронизации — один correlation_id, чтобы отказ по двум подключённым
// календарям читался как один случай, а не как два несвязанных.
//
// Наблюдаемость остаётся тише самой синхронизации: логирование обёрнуто так,
// что не может бросить, и ни один отказ по-прежнему не мешает создать,
// перенести или отменить встречу (§12).

/** Только известные провайдеры: строка из базы в лог как есть не идёт. */
function providerName(value: string): 'google' | 'yandex' | 'other' {
    return value === 'google' || value === 'yandex' ? value : 'other';
}

type SyncableSession = {
    id: string;
    date: Date;
    time: string;
    endTime: string | null;
    duration: number;
    type: string;
    format: string;
    notes: string | null;
    client?: { name: string } | null;
};

/**
 * Auto-sync a session to all connected and active calendars. Link-aware:
 * updates an already-linked event in place, creates (and links) a new one
 * otherwise. Called after session create, after a manual field edit, and —
 * since it subsumes the old delete+recreate pair — after a reschedule.
 */
export async function autoSyncSessionToCalendars(
    psychologistId: string,
    session: SyncableSession,
    options?: { excludeIntegrationId?: string }
) {
    const correlationId = randomUUID();
    try {
        const settings = await db.psychologistSettings.findUnique({
            where: { psychologistId },
            select: { autoSync: true },
        });
        if (!settings?.autoSync) return;

        const integrations = await db.calendarIntegration.findMany({
            where: { psychologistId, isActive: true },
        });

        for (const integration of integrations) {
            if (integration.id === options?.excludeIntegrationId) continue;

            try {
                const link = await db.calendarSessionLink.findFirst({
                    where: { sessionId: session.id, integrationId: integration.id },
                });

                if (link) {
                    if (integration.provider === 'google' && integration.accessToken) {
                        const { updateGoogleCalendarEvent } = await import('@/lib/calendar/google');
                        await updateGoogleCalendarEvent(integration.id, link.externalEventId, session);
                    } else if (integration.provider === 'yandex' && integration.caldavLogin) {
                        const { updateYandexCalendarEvent } = await import('@/lib/calendar/yandex');
                        await updateYandexCalendarEvent(integration.id, link.externalEventId, session);
                    }
                    continue;
                }

                let eventId: string | undefined;
                if (integration.provider === 'google' && integration.accessToken) {
                    const { createGoogleCalendarEvent } = await import('@/lib/calendar/google');
                    const result = await createGoogleCalendarEvent(integration.id, session);
                    if (result.success) eventId = result.eventId;
                } else if (integration.provider === 'yandex' && integration.caldavLogin) {
                    const { pushSessionToYandex } = await import('@/lib/calendar/yandex');
                    const result = await pushSessionToYandex(integration.id, session);
                    if (result.success) eventId = result.eventId;
                }

                if (eventId) {
                    try {
                        await db.calendarSessionLink.create({
                            data: {
                                psychologistId,
                                integrationId: integration.id,
                                sessionId: session.id,
                                externalEventId: eventId,
                                sourceRole: 'synced',
                            },
                        });
                    } catch {
                        // A link for (integration, session) already exists —
                        // a concurrent sync beat us to it. This subsystem is
                        // best-effort/fire-and-forget by design (never
                        // called under a lock); the event we just pushed is
                        // an untracked extra in that rare race, not worth
                        // treating as an error.
                    }
                }
            } catch (e) {
                logSafeFailure('calendar-sync', {
                    provider: providerName(integration.provider),
                    error_code: providerErrorCode(e),
                    correlation_id: correlationId,
                    source: 'session_sync',
                });
            }
        }
    } catch {
        // Сюда попадают отказы до обращения к провайдеру: настройки, список
        // подключений. Провайдера здесь ещё нет, поэтому и в логе его нет.
        logSafeFailure('calendar-sync', { error_code: 'SYNC_SETUP_FAILED', correlation_id: correlationId, source: 'session_sync' });
    }
}

/**
 * Delete a session from every calendar it's linked to (real delete for both
 * providers), then remove those CalendarSessionLink rows. Used for
 * cancel/delete ONLY — a reschedule never calls this anymore (see above).
 */
export async function autoDeleteSessionFromCalendars(
    psychologistId: string,
    sessionId: string
) {
    const correlationId = randomUUID();
    try {
        const settings = await db.psychologistSettings.findUnique({
            where: { psychologistId },
            select: { autoSync: true },
        });
        if (!settings?.autoSync) return;

        const links = await db.calendarSessionLink.findMany({
            where: { sessionId, psychologistId },
            include: { integration: true },
        });

        for (const link of links) {
            try {
                if (link.integration.provider === 'google' && link.integration.accessToken) {
                    const { deleteGoogleCalendarEventById } = await import('@/lib/calendar/google');
                    await deleteGoogleCalendarEventById(link.integrationId, link.externalEventId);
                } else if (link.integration.provider === 'yandex' && link.integration.caldavLogin) {
                    const { deleteYandexCalendarEventById } = await import('@/lib/calendar/yandex');
                    await deleteYandexCalendarEventById(link.integrationId, link.externalEventId);
                }
            } catch (e) {
                logSafeFailure('calendar-sync', {
                    provider: providerName(link.integration.provider),
                    error_code: providerErrorCode(e),
                    correlation_id: correlationId,
                    source: 'session_delete',
                });
            }
        }

        if (links.length > 0) {
            await db.calendarSessionLink.deleteMany({ where: { sessionId, psychologistId } });
        } else {
            // Backward compatibility: a session synced BEFORE CalendarSessionLink
            // existed has no link row at all. Fall back to the old
            // search-by-property delete for Google (the only provider that
            // ever supported it) so pre-Task-12 sessions still clean up.
            const linkedIntegrationIds = new Set(links.map((l) => l.integrationId));
            const integrations = await db.calendarIntegration.findMany({
                where: { psychologistId, isActive: true, provider: 'google', id: { notIn: [...linkedIntegrationIds] } },
            });
            for (const integration of integrations) {
                if (!integration.accessToken) continue;
                try {
                    const { deleteGoogleCalendarEvent } = await import('@/lib/calendar/google');
                    await deleteGoogleCalendarEvent(integration.id, sessionId);
                } catch (e) {
                    logSafeFailure('calendar-sync', {
                        provider: 'google',
                        error_code: providerErrorCode(e),
                        correlation_id: correlationId,
                        source: 'legacy_delete',
                    });
                }
            }
        }
    } catch {
        logSafeFailure('calendar-sync', { error_code: 'DELETE_SETUP_FAILED', correlation_id: correlationId, source: 'session_delete' });
    }
}
