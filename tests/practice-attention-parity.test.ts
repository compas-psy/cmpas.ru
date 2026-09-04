// Задача 17 §1/§5: у веба и мобайла ОДИН источник «требует внимания».
// Проверяется не похожесть текстов, а то, что оба адаптера отдают ровно то,
// что вернул общий getPracticeAttention, под текущим специалистом — и что
// история уведомлений осталась отдельным массивом, не смешанным с задачами.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const shared = vi.hoisted(() => ({
    items: [
        { id: 'client_without_consent:c-9', type: 'client_without_consent', label: 'Мария · нет согласия на обработку данных', title: 'Мария', detail: 'нет согласия на обработку данных', clientId: 'c-9' },
        { id: 'session_without_notes:s-1', type: 'session_without_notes', label: 'Анна · нет заметки по сессии 3 сентября', title: 'Анна', detail: 'нет заметки по сессии 3 сентября', sessionId: 's-1', clientId: 'c-1' },
        { id: 'session_unpaid:s-2', type: 'session_unpaid', label: 'Борис · не отмечена оплата 2 сентября', title: 'Борис', detail: 'не отмечена оплата 2 сентября', sessionId: 's-2', clientId: 'c-2' },
        { id: 'import_review:b-1', type: 'import_review', label: 'Импорт календаря · требуется проверка: 3', title: 'Импорт календаря', detail: 'требуется проверка: 3', batchId: 'b-1', importSource: 'calendar' },
    ],
    calledWith: [] as string[],
}));

vi.mock('@/lib/practice/attention', () => ({
    getPracticeAttention: vi.fn(async (psychologistId: string) => {
        shared.calledWith.push(psychologistId);
        return shared.items;
    }),
}));

vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 'psy-1' } })) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/mobile-auth', () => ({
    authenticateMobileRequest: vi.fn(async () => ({ userId: 'psy-1' })),
    unauthorizedResponse: () => new Response('unauthorized', { status: 401 }),
}));

vi.mock('@/lib/session-maintenance', () => ({
    settlePastSessionsForPsychologist: vi.fn(async () => {}),
    compareSessionStart: () => 0,
    isSessionFuture: () => false,
}));

vi.mock('@/lib/notifications', () => ({
    listNotifications: vi.fn(async () => ({
        items: [{ id: 'n-1', type: 'session_confirmed', title: 'Клиент подтвердил встречу', subtitle: null, createdAt: new Date('2026-09-03T10:00:00Z'), sessionId: 's-9', clientId: 'c-9', readAt: null }],
    })),
}));

vi.mock('@/lib/client-workflow', () => ({ clientBookingLink: () => 'https://cmpas.ru/u/anna' }));
vi.mock('@/lib/booking/slug', () => ({ getPsychologistBookingUrl: async () => 'https://cmpas.ru/u/anna' }));

vi.mock('@/lib/db', () => ({
    db: {
        diarySession: { findMany: vi.fn(async () => []) },
        user: { findUnique: vi.fn(async () => ({ name: 'Илья', psychologistSettings: null })) },
        $queryRaw: vi.fn(async () => []),
    },
}));

const { getDashboardAttention } = await import('@/app/diary/actions/attention');
const { GET } = await import('@/app/api/mobile/dashboard/route');
const { attentionHref } = await import('@/app/diary/page');

beforeEach(() => {
    shared.calledWith = [];
});

describe('веб и мобайл получают одну и ту же семантику', () => {
    it('веб-действие отдаёт ровно то, что вернул общий бэкенд', async () => {
        expect(await getDashboardAttention()).toEqual(shared.items);
    });

    it('мобильный дашборд отдаёт те же пункты с теми же идентификаторами', async () => {
        const res = await GET(new Request('https://cmpas.ru/api/mobile/dashboard') as never);
        const body = await res.json();

        expect(body.attentionItems).toEqual(shared.items);
    });

    it('оба адаптера спрашивают за текущего специалиста, а не за переданного снаружи', async () => {
        await getDashboardAttention();
        await GET(new Request('https://cmpas.ru/api/mobile/dashboard?psychologistId=psy-999') as never);

        expect(new Set(shared.calledWith)).toEqual(new Set(['psy-1']));
    });

    it('мобильный ответ больше не содержит счётчиков вместо объектов', async () => {
        const res = await GET(new Request('https://cmpas.ru/api/mobile/dashboard') as never);
        const body = await res.json();

        for (const item of body.attentionItems) {
            expect(item).not.toHaveProperty('count');
            expect(item.sessionId || item.clientId || item.batchId).toBeTruthy();
        }
    });
});

describe('§6 история уведомлений остаётся отдельной секцией', () => {
    it('attentionItems и notifications — два разных массива в одном ответе', async () => {
        const res = await GET(new Request('https://cmpas.ru/api/mobile/dashboard') as never);
        const body = await res.json();

        expect(Array.isArray(body.attentionItems)).toBe(true);
        expect(Array.isArray(body.notifications)).toBe(true);
        // Уведомление со своим прочитано/непрочитано не подмешано в задачи.
        expect(body.attentionItems.some((i: { id: string }) => i.id === 'n-1')).toBe(false);
        expect(body.notifications[0]).toMatchObject({ id: 'n-1', unread: true });
        expect(body.attentionItems.every((i: Record<string, unknown>) => !('unread' in i))).toBe(true);
    });
});

describe('§4 навигация веба ведёт к конкретному объекту', () => {
    it('каждый тип открывает свой объект, а не общий список', () => {
        const [consent, notes, unpaid, importReview] = shared.items;

        expect(attentionHref(notes as never)).toBe('/diary/session/s-1/notes');
        expect(attentionHref(unpaid as never)).toBe('/diary/session/s-2');
        expect(attentionHref(consent as never)).toBe('/diary/clients?clientId=c-9');
        expect(attentionHref(importReview as never)).toBe('/diary/clients/import-calendar');
    });

    it('импорт таблицы ведёт на экран импорта таблицы', () => {
        expect(attentionHref({ ...shared.items[3], importSource: 'spreadsheet' } as never)).toBe('/diary/clients/import-spreadsheet');
    });
});
