// O-260829 §5.4 (правка по дополняющему Android-ТЗ, android_booking_v2.md
// §1): пост-сессионный каскад читает исход из DiarySession.status
// ('completed' | 'no_show'), а не из отдельного поля outcome. Проверяем:
// 1. no_show подавляет сообщение через 2 часа; обычная/неотмеченная сессия — нет.
// 2. сообщение через неделю не уходит, если у клиента уже есть будущая запись.
// 3. ни одно из двух сообщений не отправляется дважды при повторных проходах cron.
// 4. слишком старые сессии (включая всю историю status='completed' до этой
//    фичи) не разлетаются задним числом при первом проходе cron.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const diarySessionFindMany = vi.fn();
const diarySessionFindFirst = vi.fn();
const diarySessionUpdate = vi.fn().mockResolvedValue({});
const userFindUnique = vi.fn();

vi.mock('@/lib/db', () => ({
    db: {
        diarySession: {
            findMany: (...args: unknown[]) => diarySessionFindMany(...args),
            findFirst: (...args: unknown[]) => diarySessionFindFirst(...args),
            update: (...args: unknown[]) => diarySessionUpdate(...args),
        },
        user: {
            findUnique: (...args: unknown[]) => userFindUnique(...args),
        },
    },
}));

const sendTelegramMessage = vi.fn();
vi.mock('@/lib/telegram', () => ({
    sendTelegramMessage: (...args: unknown[]) => sendTelegramMessage(...args),
}));

const sendMaxMessage = vi.fn();
vi.mock('@/lib/max', () => ({
    sendMaxMessage: (...args: unknown[]) => sendMaxMessage(...args),
}));

vi.mock('@/lib/client-workflow', () => ({
    clientBookingLink: (psychologistId: string, clientId: string, base?: string) =>
        `${base || 'https://cmpas.ru/bot/book/' + psychologistId}?c=token-${clientId}`,
}));

vi.mock('@/lib/booking/slug', () => ({
    getPsychologistBookingUrl: vi.fn().mockResolvedValue('https://cmpas.ru/u/anna-volkova'),
}));

// '@/app/bot/actions' — реальный модуль тянет next-auth через свою длинную
// цепочку импортов (нужен только для полноценного Next.js рантайма) и падает
// под vitest на резолве 'next/server'; поэтому он всегда мокается — как и в
// компонентных тестах страницы записи.
const getSuggestedTimes = vi.fn();
vi.mock('@/app/bot/actions', () => ({
    getSuggestedTimes: (...args: unknown[]) => getSuggestedTimes(...args),
}));

const track = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/analytics/track', () => ({ track: (...args: unknown[]) => track(...args) }));

function baseSession(overrides: Record<string, unknown> = {}) {
    return {
        id: 'session_1',
        psychologistId: 'psy_1',
        clientId: 'client_1',
        date: new Date(), // переопределяется в каждом тесте под нужный сценарий
        time: '13:00',
        endTime: '13:50',
        status: 'confirmed',
        nextBookingNudgeSent: false,
        weeklyFollowupSent: false,
        client: { id: 'client_1', name: 'Клиент', telegramClient: null, telegramChatId: 'tg_client', maxChatId: null },
        ...overrides,
    };
}

function timeStrOf(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

describe('processNextBookingNudge (O-260829 §5.4)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        userFindUnique.mockResolvedValue({ name: 'Анна Волкова', psychologistSettings: null });
        getSuggestedTimes.mockResolvedValue([{ date: '2026-09-20', time: '18:00', format: 'online', addressId: null }]);
        sendTelegramMessage.mockResolvedValue(true);
    });

    it('сессия завершилась 3 часа назад и не отмечена — сообщение уходит', async () => {
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
        diarySessionFindMany.mockResolvedValue([baseSession({ date: threeHoursAgo, time: '00:00', endTime: timeStrOf(threeHoursAgo) })]);

        const { processNextBookingNudge } = await import('../src/lib/cron/post-session-cascade');
        await processNextBookingNudge();

        expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
        expect(sendTelegramMessage.mock.calls[0][1]).toMatch(/Спасибо за встречу/);
        expect(diarySessionUpdate).toHaveBeenCalledWith({ where: { id: 'session_1' }, data: { nextBookingNudgeSent: true } });
    });

    it('сессия уже автоматически completed (settlePastSessionsForPsychologist) — сообщение всё равно уходит', async () => {
        // status='completed' не значит "специалист явно подтвердил" — это
        // тоже могло быть автоматическим settle-переходом. Раз не no_show,
        // считаем встречу состоявшейся (v2 §5.4).
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
        diarySessionFindMany.mockResolvedValue([
            baseSession({ date: threeHoursAgo, time: '00:00', endTime: timeStrOf(threeHoursAgo), status: 'completed' }),
        ]);

        const { processNextBookingNudge } = await import('../src/lib/cron/post-session-cascade');
        await processNextBookingNudge();

        expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
    });

    it('сессия отмечена no_show — сообщение НЕ уходит, но флаг всё равно закрывается', async () => {
        diarySessionFindMany.mockResolvedValue([]); // status: {notIn: [...,'no_show']} в запросе — Prisma сам не вернёт эту сессию

        const { processNextBookingNudge } = await import('../src/lib/cron/post-session-cascade');
        await processNextBookingNudge();

        expect(sendTelegramMessage).not.toHaveBeenCalled();
        // Запрос должен явно исключать no_show, а не полагаться на код после выборки.
        const where = diarySessionFindMany.mock.calls[0][0].where;
        expect(where.status.notIn).toContain('no_show');
    });

    it('слишком старая сессия (заведена до этого релиза) — закрывается без отправки', async () => {
        const veryOld = new Date(Date.now() - 90 * 60 * 60 * 1000); // 90 часов назад
        diarySessionFindMany.mockResolvedValue([baseSession({ date: veryOld, time: '00:00', endTime: timeStrOf(veryOld) })]);

        const { processNextBookingNudge } = await import('../src/lib/cron/post-session-cascade');
        await processNextBookingNudge();

        expect(sendTelegramMessage).not.toHaveBeenCalled();
        expect(diarySessionUpdate).toHaveBeenCalledWith({ where: { id: 'session_1' }, data: { nextBookingNudgeSent: true } });
    });

    it('повторный проход после отправки не шлёт второе сообщение (nextBookingNudgeSent уже true)', async () => {
        // Запрос фильтрует nextBookingNudgeSent: false — вторая сессия уже не придёт.
        diarySessionFindMany.mockResolvedValue([]);

        const { processNextBookingNudge } = await import('../src/lib/cron/post-session-cascade');
        await processNextBookingNudge();

        expect(sendTelegramMessage).not.toHaveBeenCalled();
        const where = diarySessionFindMany.mock.calls[0][0].where;
        expect(where.nextBookingNudgeSent).toBe(false);
    });

    it('Task 9: сессия импортирована (origin=import) — сообщение НЕ уходит, флаг всё равно закрывается', async () => {
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
        diarySessionFindMany.mockResolvedValue([
            baseSession({ date: threeHoursAgo, time: '00:00', endTime: timeStrOf(threeHoursAgo), origin: 'import' }),
        ]);

        const { processNextBookingNudge } = await import('../src/lib/cron/post-session-cascade');
        await processNextBookingNudge();

        expect(sendTelegramMessage).not.toHaveBeenCalled();
        expect(getSuggestedTimes).not.toHaveBeenCalled();
        expect(track).not.toHaveBeenCalled();
        expect(diarySessionUpdate).toHaveBeenCalledWith({ where: { id: 'session_1' }, data: { nextBookingNudgeSent: true } });
    });
});

describe('processWeeklyFollowup (O-260829 §5.4)', () => {
    const ORIGINAL_FLAG = process.env.PRACTICE_WEEKLY_FOLLOWUP_ENABLED;

    beforeEach(() => {
        vi.clearAllMocks();
        // PRAKTIKA MVP addendum §8: launch default — выключено; остальные
        // тесты этого блока проверяют логику при явно включённом флаге.
        process.env.PRACTICE_WEEKLY_FOLLOWUP_ENABLED = 'true';
    });

    afterEach(() => {
        process.env.PRACTICE_WEEKLY_FOLLOWUP_ENABLED = ORIGINAL_FLAG;
    });

    it('addendum §8: по умолчанию (флаг не задан) cron не читает базу и не шлёт сообщений', async () => {
        delete process.env.PRACTICE_WEEKLY_FOLLOWUP_ENABLED;

        const { processWeeklyFollowup } = await import('../src/lib/cron/post-session-cascade');
        await processWeeklyFollowup();

        expect(diarySessionFindMany).not.toHaveBeenCalled();
        expect(sendTelegramMessage).not.toHaveBeenCalled();
    });

    it('неделя прошла, будущей записи нет — сообщение уходит', async () => {
        const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
        diarySessionFindMany.mockResolvedValue([
            baseSession({ date: eightDaysAgo, time: '00:00', endTime: timeStrOf(eightDaysAgo), status: 'completed' }),
        ]);
        diarySessionFindFirst.mockResolvedValue(null); // нет будущей записи
        sendTelegramMessage.mockResolvedValue(true);

        const { processWeeklyFollowup } = await import('../src/lib/cron/post-session-cascade');
        await processWeeklyFollowup();

        expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
        expect(sendTelegramMessage.mock.calls[0][1]).toMatch(/ваша ссылка на запись всегда здесь/);
        expect(diarySessionUpdate).toHaveBeenCalledWith({ where: { id: 'session_1' }, data: { weeklyFollowupSent: true } });
    });

    it('у клиента уже есть будущая запись — сообщение НЕ уходит, но флаг закрывается', async () => {
        const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
        diarySessionFindMany.mockResolvedValue([
            baseSession({ date: eightDaysAgo, time: '00:00', endTime: timeStrOf(eightDaysAgo), status: 'completed' }),
        ]);
        diarySessionFindFirst.mockResolvedValue({ id: 'future_session' }); // уже записался

        const { processWeeklyFollowup } = await import('../src/lib/cron/post-session-cascade');
        await processWeeklyFollowup();

        expect(sendTelegramMessage).not.toHaveBeenCalled();
        expect(diarySessionUpdate).toHaveBeenCalledWith({ where: { id: 'session_1' }, data: { weeklyFollowupSent: true } });
    });

    it('повторный проход после отправки не шлёт второе сообщение (weeklyFollowupSent уже true)', async () => {
        diarySessionFindMany.mockResolvedValue([]); // запрос фильтрует weeklyFollowupSent: false

        const { processWeeklyFollowup } = await import('../src/lib/cron/post-session-cascade');
        await processWeeklyFollowup();

        expect(sendTelegramMessage).not.toHaveBeenCalled();
        const where = diarySessionFindMany.mock.calls[0][0].where;
        expect(where.weeklyFollowupSent).toBe(false);
    });

    it('сессия без отметки специалиста (status не completed) не попадает под еженедельное сообщение', async () => {
        diarySessionFindMany.mockResolvedValue([]); // запрос фильтрует status: 'completed'

        const { processWeeklyFollowup } = await import('../src/lib/cron/post-session-cascade');
        await processWeeklyFollowup();

        const where = diarySessionFindMany.mock.calls[0][0].where;
        expect(where.status).toBe('completed');
    });

    it('сессия старше 37 дней (существовала до этой фичи, status=completed от settle) — закрывается без отправки', async () => {
        // До правки по Android-ТЗ поле фильтровало outcome (новое, всегда
        // null у истории). Теперь это status='completed' — значение, которое
        // settlePastSessionsForPsychologist проставляло годами до этой
        // фичи. Без нижней границы первый ночной проход разослал бы письмо
        // по каждой когда-либо состоявшейся сессии.
        const veryOld = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 дней назад
        diarySessionFindMany.mockResolvedValue([
            baseSession({ date: veryOld, time: '00:00', endTime: timeStrOf(veryOld), status: 'completed' }),
        ]);

        const { processWeeklyFollowup } = await import('../src/lib/cron/post-session-cascade');
        await processWeeklyFollowup();

        expect(sendTelegramMessage).not.toHaveBeenCalled();
        expect(diarySessionFindFirst).not.toHaveBeenCalled(); // даже будущую запись не проверяем — сразу закрываем
        expect(diarySessionUpdate).toHaveBeenCalledWith({ where: { id: 'session_1' }, data: { weeklyFollowupSent: true } });
    });

    it('Task 9: сессия импортирована (origin=import), будущей записи нет — сообщение НЕ уходит, флаг закрывается', async () => {
        const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
        diarySessionFindMany.mockResolvedValue([
            baseSession({ date: eightDaysAgo, time: '00:00', endTime: timeStrOf(eightDaysAgo), status: 'completed', origin: 'import' }),
        ]);
        diarySessionFindFirst.mockResolvedValue(null);

        const { processWeeklyFollowup } = await import('../src/lib/cron/post-session-cascade');
        await processWeeklyFollowup();

        expect(sendTelegramMessage).not.toHaveBeenCalled();
        expect(track).not.toHaveBeenCalled();
        expect(diarySessionUpdate).toHaveBeenCalledWith({ where: { id: 'session_1' }, data: { weeklyFollowupSent: true } });
    });
});
