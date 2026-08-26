// Класс B: узкое окно на редких событиях отрезало данные, которые есть в
// базе, и блок гас как no_data, хотя ноль в этом окне — измеренный, честный
// ноль. Правило учредителя: «показатель с пустым окном обязан показать
// ближайший непустой факт вместо пустоты» — 0 за окно + дата/давность
// ближайшего факта вокруг, а не голая пустота.
//
// Для каждого исправленного блока здесь проверены три состояния:
//  - таблица пуста целиком → no_data (класс C, не наш случай — остаётся как есть);
//  - в окне пусто, но вокруг есть факты → НЕ no_data, честный ноль с контекстом;
//  - окно тоже непустое → обычный ok с измеренным значением.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const userFindMany = vi.fn();
const userFindFirst = vi.fn();
const psychologistSettingsFindMany = vi.fn();
const diarySessionFindMany = vi.fn();
const diarySessionFindFirst = vi.fn();
const diarySessionGroupBy = vi.fn();
const paymentFindMany = vi.fn();

vi.mock('@/lib/db', () => ({
    db: {
        user: {
            findMany: (...args: unknown[]) => userFindMany(...args),
            findFirst: (...args: unknown[]) => userFindFirst(...args),
        },
        psychologistSettings: { findMany: (...args: unknown[]) => psychologistSettingsFindMany(...args) },
        diarySession: {
            findMany: (...args: unknown[]) => diarySessionFindMany(...args),
            findFirst: (...args: unknown[]) => diarySessionFindFirst(...args),
            groupBy: (...args: unknown[]) => diarySessionGroupBy(...args),
        },
        payment: { findMany: (...args: unknown[]) => paymentFindMany(...args) },
    },
}));

import { qFunnelPractice } from '@/lib/panel/queries/funnel';
import { qPracticeNsm, qPracticeActive, qPracticeActivation, qPracticeReschedule } from '@/lib/panel/queries/products';
import { qCohortsPractice } from '@/lib/panel/queries/retention';

beforeEach(() => {
    userFindMany.mockReset();
    userFindFirst.mockReset();
    psychologistSettingsFindMany.mockReset();
    diarySessionFindMany.mockReset();
    diarySessionFindFirst.mockReset();
    diarySessionGroupBy.mockReset();
    paymentFindMany.mockReset();
});

const DAY_MS = 24 * 60 * 60 * 1000;

describe('q_funnel_practice — B4: окно 28 дней на редких регистрациях', () => {
    it('специалистов в базе нет вообще — no_data (класс C, не трогаем)', async () => {
        userFindMany.mockResolvedValue([]);
        userFindFirst.mockResolvedValue(null);
        const block = await qFunnelPractice();
        expect(block.state).toBe('no_data');
        expect(block.data).toBeNull();
    });

    it('0 регистраций за 28 дней, но специалисты в базе есть — ok с нулевой воронкой и датой последней регистрации', async () => {
        userFindMany.mockResolvedValue([]); // окно 28 дней пусто
        const last = new Date(Date.now() - 39 * DAY_MS);
        userFindFirst.mockResolvedValue({ createdAt: last });

        const block = await qFunnelPractice();

        expect(block.state).toBe('ok');
        expect(block.data?.steps[0].value).toBe(0);
        expect(block.data?.lastRegisteredAt).toBe(last.toISOString());
        expect(block.data?.daysSinceLastRegistered).toBe(39);
    });

    it('есть регистрации в окне — обычный ok, без служебных полей контекста', async () => {
        userFindMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
        psychologistSettingsFindMany.mockResolvedValue([{ psychologistId: 'u1' }]);
        diarySessionFindMany.mockResolvedValue([]);
        paymentFindMany.mockResolvedValue([]);

        const block = await qFunnelPractice();

        expect(block.state).toBe('ok');
        expect(block.data?.steps[0].value).toBe(2);
        expect(block.data?.lastRegisteredAt).toBeUndefined();
    });
});

describe('q_practice_nsm — B: 0 специалистов с сессией за неделю', () => {
    it('завершённых сессий в базе нет вообще — no_data', async () => {
        diarySessionFindMany.mockResolvedValue([]);
        diarySessionFindFirst.mockResolvedValue(null);
        const block = await qPracticeNsm();
        expect(block.state).toBe('no_data');
    });

    it('0 за неделю, но последняя сессия в базе есть — ok с нулём и давностью', async () => {
        diarySessionFindMany.mockResolvedValue([]); // оба окна (7д и 14-7д) пусты
        const last = new Date(Date.now() - 39 * DAY_MS);
        diarySessionFindFirst.mockResolvedValue({ date: last });

        const block = await qPracticeNsm();

        expect(block.state).toBe('ok');
        expect(block.data?.value).toBe(0);
        expect(block.data?.activeSpecialists).toBe(0);
        expect(block.data?.lastSessionAt).toBe(last.toISOString());
        expect(block.data?.daysSinceLastSession).toBe(39);
    });

    it('есть сессии за неделю — обычный ok', async () => {
        diarySessionFindMany.mockImplementation(async ({ where }: { where: { date: { lt: Date } } }) => {
            const isCurrentWindow = where.date.lt.getTime() > Date.now() - DAY_MS;
            return isCurrentWindow ? [{ psychologistId: 'p1' }, { psychologistId: 'p1' }] : [];
        });

        const block = await qPracticeNsm();

        expect(block.state).toBe('ok');
        expect(block.data?.activeSpecialists).toBe(1);
        expect(block.data?.sessions).toBe(2);
    });
});

describe('q_practice_active — тот же корень (MAU=0, но сессии в базе есть)', () => {
    it('сессий в базе нет вообще — no_data', async () => {
        diarySessionFindMany.mockResolvedValue([]);
        diarySessionFindFirst.mockResolvedValue(null);
        const block = await qPracticeActive();
        expect(block.state).toBe('no_data');
    });

    it('MAU=0 за 30 дней, но сессии в базе есть — ok с нулём и давностью последней активности', async () => {
        diarySessionFindMany.mockResolvedValue([]);
        const last = new Date(Date.now() - 39 * DAY_MS);
        diarySessionFindFirst.mockResolvedValue({ date: last });

        const block = await qPracticeActive();

        expect(block.state).toBe('ok');
        expect(block.data?.wau).toBe(0);
        expect(block.data?.mau).toBe(0);
        expect(block.data?.lastSessionAt).toBe(last.toISOString());
        expect(block.data?.daysSinceLastSession).toBe(39);
    });
});

describe('q_practice_activation — узкое окно регистрации + активации', () => {
    it('специалистов в базе нет вообще — no_data', async () => {
        userFindMany.mockResolvedValue([]);
        userFindFirst.mockResolvedValue(null);
        const block = await qPracticeActivation();
        expect(block.state).toBe('no_data');
    });

    it('пустая когорта регистраций, но специалисты в базе есть — ok с нулём и датой последней регистрации', async () => {
        userFindMany.mockResolvedValue([]); // оба измеряемых окна пусты
        const last = new Date(Date.now() - 39 * DAY_MS);
        userFindFirst.mockResolvedValue({ createdAt: last });

        const block = await qPracticeActivation();

        expect(block.state).toBe('ok');
        expect(block.data?.rate).toBe(0);
        expect(block.data?.cohort).toBe(0);
        expect(block.data?.lastRegisteredAt).toBe(last.toISOString());
        expect(block.data?.daysSinceLastRegistered).toBe(39);
    });
});

describe('q_cohorts_practice — B4: окно наблюдения (9 недель) на редких регистрациях', () => {
    it('специалистов в базе нет вообще — no_data', async () => {
        userFindMany.mockResolvedValue([]);
        userFindFirst.mockResolvedValue(null);
        const block = await qCohortsPractice();
        expect(block.state).toBe('no_data');
    });

    it('в окно наблюдения никто не попал, но специалисты есть — ok с пустыми строками и датой последней регистрации', async () => {
        userFindMany.mockResolvedValue([]);
        const last = new Date(Date.now() - 90 * DAY_MS);
        userFindFirst.mockResolvedValue({ createdAt: last });

        const block = await qCohortsPractice();

        expect(block.state).toBe('ok');
        expect(block.data?.rows).toEqual([]);
        expect(block.data?.lastRegisteredAt).toBe(last.toISOString());
        expect(block.data?.daysSinceLastRegistered).toBe(90);
    });

    it('есть регистрации в окне наблюдения — обычный ok с непустыми строками', async () => {
        const recentUser = { id: 'u1', createdAt: new Date() };
        userFindMany.mockResolvedValue([recentUser]);
        diarySessionFindMany.mockResolvedValue([]);

        const block = await qCohortsPractice();

        expect(block.state).toBe('ok');
        expect(block.data?.rows.length).toBeGreaterThan(0);
        expect(block.data?.lastRegisteredAt).toBeUndefined();
    });
});

// q_practice_reschedule (products.ts) — тот же корень, что у q_practice_nsm/
// q_practice_active выше: узкое окно (28 дней) на редких записях. Пропущен
// при первой правке класса B — добавлен отдельно (сверка этапа 4).
describe('qPracticeReschedule — окно не должно прятать историю, если записи в базе есть', () => {
    it('записей в базе нет вообще — no_data', async () => {
        diarySessionGroupBy.mockResolvedValue([]);
        diarySessionFindFirst.mockResolvedValue(null);

        const block = await qPracticeReschedule();
        expect(block.state).toBe('no_data');
    });

    it('за 28 дней ноль записей, но записи в базе есть — ok с честным нулём и датой последней записи', async () => {
        diarySessionGroupBy.mockResolvedValue([]);
        const last = new Date(Date.now() - 39 * DAY_MS);
        diarySessionFindFirst.mockResolvedValue({ date: last });

        const block = await qPracticeReschedule();

        expect(block.state).toBe('ok');
        expect(block.data?.total).toBe(0);
        expect(block.data?.lastSessionAt).toBe(last.toISOString());
        expect(block.data?.daysSinceLastSession).toBe(39);
    });

    it('есть записи в окне — обычный ok с измеренной долей отмен', async () => {
        diarySessionGroupBy.mockResolvedValue([
            { status: 'completed', _count: { _all: 8 } },
            { status: 'cancelled', _count: { _all: 2 } },
        ]);

        const block = await qPracticeReschedule();

        expect(block.state).toBe('ok');
        expect(block.data?.total).toBe(10);
        expect(block.data?.cancelled).toBe(2);
        expect(block.data?.rate).toBe(20);
    });
});
