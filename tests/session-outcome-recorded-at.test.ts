// «Специалист сказал» и «система предположила» — разные вещи.
//
// ЖИВОЙ СЛУЧАЙ, сессия 09.09.2026. На карточке прошедшей встречи
// одновременно висели «Была», «Не пришли», «Заметка» и «Оплата»: четыре
// равноправных действия там, где человеку нужно сделать одно. Первое из них —
// сказать, состоялась ли встреча; всё остальное осмысленно только после
// ответа. И после ответа кнопки обязаны исчезнуть, оставив подпись со
// статусом: выбор сделан, переспрашивать незачем.
//
// Сделать это по статусу нельзя. settlePastSessionsForPsychologist
// (src/lib/session-maintenance.ts) сам переводит confirmed в completed через
// 15 минут после конца встречи, и к вечеру — когда специалист обычно и
// просматривает день — почти все сегодняшние сессии уже completed. По статусу
// «сказал специалист» и «время прошло, и мы предположили» неразличимы.
//
// Отсюда отдельное поле outcomeRecordedAt: его ставят ТОЛЬКО пути, где исход
// назвал человек. Здесь проверяются оба таких пути и то, что поле доезжает до
// приложения.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = vi.fn();
vi.mock('@/auth', () => ({ auth: (...args: unknown[]) => auth(...args) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const diarySessionFindUnique = vi.fn();
const diarySessionUpdate = vi.fn();
vi.mock('@/lib/db', () => ({
    db: {
        diarySession: {
            findUnique: (...args: unknown[]) => diarySessionFindUnique(...args),
            update: (...args: unknown[]) => diarySessionUpdate(...args),
        },
    },
}));

vi.mock('@/lib/calendar/auto-sync', () => ({
    autoSyncSessionToCalendars: vi.fn(),
    autoDeleteSessionFromCalendars: vi.fn(),
}));
vi.mock('@/lib/telegram', () => ({ sendTelegramMessage: vi.fn() }));
vi.mock('@/lib/max-bot', () => ({ sendMaxMessage: vi.fn() }));
vi.mock('@/lib/client-workflow', () => ({
    buildSessionClientMessage: vi.fn(),
    clientBookingLink: vi.fn(),
    createAutoDocumentDeliveries: vi.fn(),
    getPaymentInstruction: vi.fn(),
}));
vi.mock('@/lib/waitlist-notify', () => ({ notifyWaitlistOnFreedSlot: vi.fn() }));
vi.mock('@/lib/practice/booking/booking', () => ({
    createManualPracticeSession: vi.fn(),
    reschedulePracticeBooking: vi.fn(),
    BookingConflictError: class BookingConflictError extends Error {},
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn().mockResolvedValue(undefined) }));

function baseSession(overrides: Record<string, unknown> = {}) {
    return {
        id: 'session_1',
        psychologistId: 'psy_1',
        clientId: 'client_1',
        date: new Date('2026-09-10T00:00:00Z'),
        time: '10:00',
        endTime: '10:50',
        status: 'confirmed',
        ...overrides,
    };
}

describe('веб: markSessionOutcome помечает момент ответа', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.mockResolvedValue({ user: { id: 'psy_1' } });
        diarySessionFindUnique.mockResolvedValue(baseSession());
        diarySessionUpdate.mockResolvedValue(baseSession({ status: 'completed' }));
    });

    it('«Была» — вместе со статусом пишется outcomeRecordedAt', async () => {
        const { markSessionOutcome } = await import('../src/app/diary/actions/sessions');
        await markSessionOutcome('session_1', 'completed');

        const data = diarySessionUpdate.mock.calls[0][0].data;
        expect(data.status).toBe('completed');
        expect(data.outcomeRecordedAt).toBeInstanceOf(Date);
    });

    it('«Не пришли» — так же', async () => {
        const { markSessionOutcome } = await import('../src/app/diary/actions/sessions');
        await markSessionOutcome('session_1', 'no_show');

        const data = diarySessionUpdate.mock.calls[0][0].data;
        expect(data.status).toBe('no_show');
        expect(data.outcomeRecordedAt).toBeInstanceOf(Date);
    });
});

describe('мобильный DTO доносит поле до приложения', () => {
    it('дата отдаётся строкой ISO', async () => {
        const { formatSession } = await import('../src/lib/mobile-sessions');
        const dto = formatSession({
            id: 's1',
            date: new Date('2026-09-10T00:00:00Z'),
            time: '10:00',
            status: 'completed',
            outcomeRecordedAt: new Date('2026-09-10T19:05:00Z'),
        });
        expect(dto.outcomeRecordedAt).toBe('2026-09-10T19:05:00.000Z');
    });

    it('исход не назван — null, а не отсутствующее поле', async () => {
        // Приложению важно именно отличие «не назван» от «назван»: на нём
        // держится, спрашивать ли ещё. Молчаливое отсутствие ключа читалось бы
        // так же, как null, но у старых ответов сервера — иначе.
        const { formatSession } = await import('../src/lib/mobile-sessions');
        const dto = formatSession({ id: 's1', date: new Date('2026-09-10T00:00:00Z'), time: '10:00', status: 'completed' });
        expect(dto.outcomeRecordedAt).toBeNull();
    });
});
