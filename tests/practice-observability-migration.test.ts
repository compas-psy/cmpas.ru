// Задача 25 §3: перенос практики виден в цифрах — и только в цифрах.
//
// Перенос это ровно то место, где PII лежит горой: названия событий
// календаря, имена из таблицы, телефоны, адреса кабинетов. Поэтому проверка
// здесь двойная. Сначала перехватываем всё, что уходит в track(), потом
// прогоняем каждое перехваченное событие через НАСТОЯЩИЙ реестр: если в
// props просочилась бы строка не из перечисления, реестр её отвергнет, и
// тест упадёт — независимо от того, догадался ли автор теста её искать.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { expectRegistryClean, expectNoHumanText, eventsNamed, type CapturedEvent } from './fixtures/analytics-capture';

const world = vi.hoisted(() => ({
    captured: [] as CapturedEvent[],
    integrations: [] as Array<{ id: string; provider: string }>,
    googleEvents: [] as unknown[],
    commit: null as unknown,
    commitError: null as Error | null,
    classified: [] as Array<{ reviewState: string }>,
}));

vi.mock('@/lib/analytics/track', () => ({
    track: vi.fn(async (_db: unknown, input: CapturedEvent) => { world.captured.push(input); }),
}));

vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 'psy-1' } })) }));

vi.mock('@/lib/db', () => ({
    db: {
        psychologistSettings: { findUnique: vi.fn(async () => ({ timezone: 'Europe/Moscow', defaultSessionDuration: 50 })) },
        calendarIntegration: { findMany: vi.fn(async () => world.integrations) },
        calendarSessionLink: { findMany: vi.fn(async () => []) },
        diaryClient: { findMany: vi.fn(async () => []) },
        psychologistAddress: { findMany: vi.fn(async () => []) },
        practiceImportBatch: { create: vi.fn(async () => ({ id: 'batch-1' })) },
    },
}));

vi.mock('@/lib/calendar/google', () => ({
    fetchGoogleCalendarEvents: vi.fn(async () => ({ success: true, events: world.googleEvents })),
}));
vi.mock('@/lib/calendar/yandex', () => ({
    fetchYandexCalendarEvents: vi.fn(async () => ({ success: true, events: [] })),
}));

vi.mock('@/lib/practice/migration/classify', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/practice/migration/classify')>();
    return { ...actual, classifyCalendarEvents: vi.fn(() => world.classified) };
});

class FakeCommitConflictError extends Error {
    constructor(public readonly code = 'COMMIT_IN_PROGRESS') { super(code); }
}

vi.mock('@/lib/practice/migration/commit', () => ({
    CommitConflictError: FakeCommitConflictError,
    commitPracticeImport: vi.fn(async () => {
        if (world.commitError) throw world.commitError;
        return world.commit;
    }),
}));

vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn(async () => undefined) }));

const calendarPreview = await import('@/app/api/diary/calendar/import/preview/route');
const calendarApply = await import('@/app/api/diary/calendar/import/apply/route');
const sheetPreview = await import('@/app/api/diary/clients/import-spreadsheet/preview/route');
const sheetApply = await import('@/app/api/diary/clients/import-spreadsheet/apply/route');

function jsonRequest(body: unknown) {
    return { headers: { get: () => 'application/json' }, json: async () => body } as never;
}

beforeEach(() => {
    world.captured = [];
    world.integrations = [{ id: 'int-1', provider: 'google' }];
    world.googleEvents = [];
    world.classified = [];
    world.commit = { batchId: 'batch-1', status: 'committed', imported: 0, skipped: 0, failed: 0, outcomes: [] };
    world.commitError = null;
});

describe('перенос из календаря', () => {
    it('начало переноса названо источником и провайдером, больше ничем', async () => {
        await calendarPreview.GET();

        const started = eventsNamed(world.captured, 'practice_migration_started');
        expect(started).toHaveLength(1);
        expect(started[0].props).toEqual({ source: 'calendar' });
        expectRegistryClean(world.captured);
    });

    it('разбор отдаёт уже посчитанные корзины, а не содержимое встреч', async () => {
        world.classified = [
            { reviewState: 'ready' }, { reviewState: 'ready' },
            { reviewState: 'review' }, { reviewState: 'personal' }, { reviewState: 'skipped' },
        ];

        await calendarPreview.GET();

        const [previewed] = eventsNamed(world.captured, 'practice_migration_previewed');
        expect(previewed.props).toEqual({
            source: 'calendar', provider: 'google',
            items_count: 5, ready_count: 2, review_count: 1, personal_count: 1, skipped_count: 1,
        });
        expectRegistryClean(world.captured);
        expectNoHumanText(world.captured);
    });

    it('два разных календаря сразу — провайдер не называется, а не выдумывается', async () => {
        world.integrations = [{ id: 'int-1', provider: 'google' }, { id: 'int-2', provider: 'yandex' }];
        world.classified = [{ reviewState: 'ready' }];

        await calendarPreview.GET();

        const [previewed] = eventsNamed(world.captured, 'practice_migration_previewed');
        expect(previewed.props).not.toHaveProperty('provider');
    });

    it('поломка разбора уходит категорией, а не текстом исключения', async () => {
        const { classifyCalendarEvents } = await import('@/lib/practice/migration/classify');
        vi.mocked(classifyCalendarEvents).mockImplementationOnce(() => {
            throw new Error('Google 403: Сессия — Анна Волкова, +7 999 123-45-67');
        });

        const res = await calendarPreview.GET();
        expect(res.status).toBe(500);

        const [failed] = eventsNamed(world.captured, 'practice_migration_failed');
        expect(failed.props).toEqual({ source: 'calendar', error_code: 'internal_error' });
        expect(JSON.stringify(world.captured)).not.toContain('Волкова');
        expect(JSON.stringify(world.captured)).not.toContain('999');
        expectRegistryClean(world.captured);
    });

    it('состоявшийся перенос считается числами самого commit', async () => {
        world.commit = { batchId: 'b', status: 'committed', imported: 7, skipped: 2, failed: 1, outcomes: [] };

        await calendarApply.POST(jsonRequest({ items: [{ date: '2026-09-10', startTime: '10:00', provider: 'google', duration: 50 }] }));

        const [committed] = eventsNamed(world.captured, 'practice_migration_committed');
        expect(committed.props).toEqual({
            source: 'calendar', provider: 'google', imported_count: 7, skipped_count: 2, failed_count: 1,
        });
        expectRegistryClean(world.captured);
    });

    it('несостоявшийся commit не считается состоявшимся', async () => {
        world.commitError = new FakeCommitConflictError();

        const res = await calendarApply.POST(jsonRequest({ items: [{ date: '2026-09-10', startTime: '10:00', duration: 50 }] }));
        expect(res.status).toBe(409);

        expect(eventsNamed(world.captured, 'practice_migration_committed')).toHaveLength(0);
        const [failed] = eventsNamed(world.captured, 'practice_migration_failed');
        expect(failed.props).toEqual({ source: 'calendar', error_code: 'commit_in_progress' });
    });

    it('несданная аттестация — своя категория, а не «внутренняя ошибка»', async () => {
        world.commitError = new Error('ATTESTATION_REQUIRED');

        const res = await calendarApply.POST(jsonRequest({ items: [{ date: '2026-09-10', startTime: '10:00', duration: 50 }] }));
        expect(res.status).toBe(403);

        const [failed] = eventsNamed(world.captured, 'practice_migration_failed');
        expect(failed.props.error_code).toBe('attestation_required');
    });
});

describe('перенос из таблицы', () => {
    it('источник из тела запроса не попадает в аналитику как есть', async () => {
        await sheetPreview.POST(jsonRequest({ mode: 'client_only', source: 'Клиенты Анны.xlsx', text: 'Анна' }));

        const [started] = eventsNamed(world.captured, 'practice_migration_started');
        expect(started.props).toEqual({ source: 'spreadsheet' });
        expect(JSON.stringify(world.captured)).not.toContain('Анн');
        expectRegistryClean(world.captured);
    });

    it('известный источник становится провайдером из реестра', async () => {
        await sheetPreview.POST(jsonRequest({ mode: 'client_only', source: 'paste', text: 'Анна Волкова\nБорис Петров' }));

        const [started] = eventsNamed(world.captured, 'practice_migration_started');
        expect(started.props).toEqual({ source: 'spreadsheet', provider: 'paste' });

        const [previewed] = eventsNamed(world.captured, 'practice_migration_previewed');
        expect(previewed.props.items_count).toBe(2);
        expect(previewed.props.provider).toBe('paste');
        expectRegistryClean(world.captured);
        expectNoHumanText(world.captured);
    });

    it('негодный источник — отказ с машинной категорией', async () => {
        const res = await sheetPreview.POST(jsonRequest({ mode: 'client_only', source: 'dropbox', text: 'x' }));
        expect(res.status).toBe(400);

        const [failed] = eventsNamed(world.captured, 'practice_migration_failed');
        expect(failed.props).toEqual({ source: 'spreadsheet', error_code: 'invalid_input' });
    });

    it('добавление клиентов из таблицы считается числами commit', async () => {
        world.commit = { batchId: 'b', status: 'committed', imported: 3, skipped: 1, failed: 0, outcomes: [] };

        await sheetApply.POST(jsonRequest({ mode: 'client_only', items: [{ clientMode: 'new', name: 'Анна Волкова', phone: '+79991234567' }] }));

        const [committed] = eventsNamed(world.captured, 'practice_migration_committed');
        expect(committed.props).toEqual({ source: 'spreadsheet', imported_count: 3, skipped_count: 1, failed_count: 0 });
        expect(JSON.stringify(world.captured)).not.toContain('Волкова');
        expect(JSON.stringify(world.captured)).not.toContain('7999');
        expectRegistryClean(world.captured);
    });

    it('пустая партия не порождает события о состоявшемся переносе', async () => {
        await sheetApply.POST(jsonRequest({ mode: 'client_only', items: [] }));

        expect(eventsNamed(world.captured, 'practice_migration_committed')).toHaveLength(0);
    });
});
