// Поток F: приёмник POST /ingest общий, consent_updated/identity_linked
// многопродуктовые (E1-E5), ЗАПИСКИ и МОМЕНТЫ реально шлют события. Значит
// ZAPISKI_REASON/MOMENTY_REASON в products.ts ("отдельный сервер, общего
// приёмника ещё нет" / "нет сервера, события копятся на устройстве")
// перестали быть правдой — события обоих продуктов попадают в
// AnalyticsEvent (product: 'zapiski' | 'moments'). Этот файл проверяет по
// каждому из 11 блоков «Продукты · ЗАПИСКИ/МОМЕНТЫ» ровно одно из двух:
//
//  - определение показателя нашлось (05_METRICS §2.2/§2.3, F2 задания
//    для D1/D7/D30) — тогда пустая таблица даёт no_data (не выдуманный
//    ноль), а таблица с событиями даёт измеренное число;
//  - определения нет (нет session_id у заметок, нет события про поддержку
//    в реестре) — тогда блок остаётся no_data всегда, но с новой честной
//    причиной, а не со старой ложью про отсутствие приёмника.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
const count = vi.fn();
const findFirst = vi.fn();

vi.mock('@/lib/db', () => ({
    db: {
        analyticsEvent: {
            findMany: (...args: unknown[]) => findMany(...args),
            count: (...args: unknown[]) => count(...args),
            findFirst: (...args: unknown[]) => findFirst(...args),
        },
    },
}));

import {
    qZapiskiNsm,
    qZapiskiWriters,
    qZapiskiNotesPerSession,
    qZapiskiSyncs,
    qZapiskiConflicts,
    qZapiskiSupport,
    qMomentyNsm,
    qMomentyInstalls,
    qMomentyD1,
    qMomentyD7,
    qMomentyD30,
} from '@/lib/panel/queries/products';

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
    findMany.mockReset();
    count.mockReset();
    findFirst.mockReset();
});

describe('zapiskiNsm — определения нет, честная дыра всегда', () => {
    it('no_data и без обращения к базе: показатель не определён (нет session_id)', async () => {
        const block = await qZapiskiNsm();
        expect(block.state).toBe('no_data');
        expect(block.data).toBeNull();
        expect(block.reason).toMatch(/session_id|сесси/i);
        // Прежняя ложная причина про отсутствие приёмника не должна остаться.
        expect(block.reason).not.toMatch(/общего приёмника ещё нет/);
    });
});

describe('zapiskiNotesPerSession — определения нет, честная дыра всегда', () => {
    it('no_data без обращения к базе', async () => {
        const block = await qZapiskiNotesPerSession();
        expect(block.state).toBe('no_data');
        expect(block.reason).not.toMatch(/общего приёмника ещё нет/);
    });
});

describe('zapiskiSupport — события в реестре нет, честная дыра всегда', () => {
    it('no_data без обращения к базе', async () => {
        const block = await qZapiskiSupport();
        expect(block.state).toBe('no_data');
        expect(block.reason).not.toMatch(/общего приёмника ещё нет/);
        expect(block.reason).toMatch(/поддерж|обращени/i);
    });
});

describe('qZapiskiWriters — считается по note_saved', () => {
    it('пустая таблица → no_data, а не ноль', async () => {
        findMany.mockResolvedValue([]);
        const block = await qZapiskiWriters();
        expect(block.state).toBe('no_data');
        expect(block.data).toBeNull();
    });

    it('есть note_saved → измеренное число разных авторов', async () => {
        findMany.mockImplementation(async ({ where }: { where: { ts: { lt: Date } } }) => {
            // Текущее окно (lt = "сейчас") — три события, два разных автора.
            // Предыдущее окно (lt = неделю назад) — пусто.
            const isCurrentWindow = where.ts.lt.getTime() > Date.now() - DAY_MS;
            if (!isCurrentWindow) return [];
            return [
                { accountId: 'acc-1', deviceId: null },
                { accountId: 'acc-1', deviceId: null },
                { accountId: 'acc-2', deviceId: null },
            ];
        });
        const block = await qZapiskiWriters();
        expect(block.state).toBe('ok');
        expect(block.data?.count).toBe(2);
    });
});

describe('qZapiskiSyncs / qZapiskiConflicts — считаются по sync_completed', () => {
    it('пустая таблица → оба no_data', async () => {
        findMany.mockResolvedValue([]);
        const syncs = await qZapiskiSyncs();
        const conflicts = await qZapiskiConflicts();
        expect(syncs.state).toBe('no_data');
        expect(conflicts.state).toBe('no_data');
    });

    it('есть sync_completed → измеренные числа синков и суммы конфликтов', async () => {
        findMany.mockImplementation(async ({ where }: { where: { ts: { lt: Date } } }) => {
            const isCurrentWindow = where.ts.lt.getTime() > Date.now() - 27 * DAY_MS;
            if (!isCurrentWindow) return [];
            return [
                { props: { pushed: 3, pulled: 1, conflicts: 1 } },
                { props: { pushed: 2, pulled: 0, conflicts: 0 } },
            ];
        });

        const syncs = await qZapiskiSyncs();
        expect(syncs.state).toBe('ok');
        expect(syncs.data?.count).toBe(2);
        expect(syncs.data?.pushed).toBe(5);
        expect(syncs.data?.pulled).toBe(1);

        const conflicts = await qZapiskiConflicts();
        expect(conflicts.state).toBe('ok');
        expect(conflicts.data?.count).toBe(1);
        expect(conflicts.data?.syncsTotal).toBe(2);
    });
});

describe('qMomentyInstalls — считается по app_installed', () => {
    it('пустая таблица → no_data', async () => {
        count.mockResolvedValue(0);
        const block = await qMomentyInstalls();
        expect(block.state).toBe('no_data');
        expect(block.data).toBeNull();
    });

    it('есть установки → измеренное число', async () => {
        count.mockImplementation(async ({ where }: { where: { ts: { lt: Date } } }) => {
            const isCurrentWindow = where.ts.lt.getTime() > Date.now() - DAY_MS;
            return isCurrentWindow ? 42 : 10;
        });
        const block = await qMomentyInstalls();
        expect(block.state).toBe('ok');
        expect(block.data?.count).toBe(42);
        expect(block.data?.previous).toBe(10);
    });
});

describe('qMomentyNsm — активация: завершили практику в первые 24ч (05_METRICS §2.3)', () => {
    it('нет установок в окне → no_data, а не 0%', async () => {
        findMany.mockResolvedValue([]);
        const block = await qMomentyNsm();
        expect(block.state).toBe('no_data');
        expect(block.data).toBeNull();
    });

    it('часть когорты активировалась → измеренный процент', async () => {
        const now = Date.now();
        const installTs = new Date(now - 3 * DAY_MS);
        findMany.mockImplementation(async (args: { where: { event: string } }) => {
            if (args.where.event === 'app_installed') {
                return [
                    { deviceId: 'dev-1', ts: installTs },
                    { deviceId: 'dev-2', ts: installTs },
                ];
            }
            if (args.where.event === 'practice_finished') {
                // dev-1 закончил практику через 2 часа после установки, dev-2 — нет.
                return [{ deviceId: 'dev-1', ts: new Date(installTs.getTime() + 2 * 60 * 60 * 1000) }];
            }
            return [];
        });
        const block = await qMomentyNsm();
        expect(block.state).toBe('ok');
        expect(block.data?.cohort).toBe(2);
        expect(block.data?.activated).toBe(1);
        expect(block.data?.rate).toBeCloseTo(50, 5);
    });
});

describe('qMomentyD1/D7/D30 — когорты устройств (F2 задания)', () => {
    it('таблица пустая → no_data с причиной про недостаточную историю, а не 0%', async () => {
        findFirst.mockResolvedValue(null);
        const d1 = await qMomentyD1();
        expect(d1.state).toBe('no_data');
        expect(d1.reason).toMatch(/истори/i);
    });

    it('таблица моложе окна D7 → no_data про недостаточную историю', async () => {
        findFirst.mockResolvedValue({ ts: new Date(Date.now() - 2 * DAY_MS) }); // моложе 8 дней
        const d7 = await qMomentyD7();
        expect(d7.state).toBe('no_data');
        expect(d7.reason).toMatch(/истори/i);
    });

    it('D1: часть когорты вернулась на 1-й день → измеренный процент, не ноль по умолчанию', async () => {
        const now = Date.now();
        findFirst.mockResolvedValue({ ts: new Date(now - 40 * DAY_MS) }); // истории достаточно

        const installTs = new Date(now - 5 * DAY_MS); // дню 1 уже больше суток назад

        findMany.mockImplementation(async (args: { where: { event?: string; deviceId?: unknown } }) => {
            if (args.where.event === 'app_installed') {
                return [
                    { deviceId: 'dev-a', ts: installTs },
                    { deviceId: 'dev-b', ts: installTs },
                ];
            }
            // Второй findMany — без event, читает все события устройств когорты.
            return [
                // dev-a вернулось ровно на день 1
                { deviceId: 'dev-a', ts: new Date(installTs.getTime() + 1 * DAY_MS + 60 * 60 * 1000) },
                // dev-b не вернулось вовсе
            ];
        });

        const d1 = await qMomentyD1();
        expect(d1.state).toBe('ok');
        expect(d1.data?.cohort).toBe(2);
        expect(d1.data?.retained).toBe(1);
        expect(d1.data?.percent).toBeCloseTo(50, 5);
    });

    it('когорта пуста в самом окне (нет установок, доросших до дня N) → no_data, а не 0%', async () => {
        findFirst.mockResolvedValue({ ts: new Date(Date.now() - 100 * DAY_MS) });
        findMany.mockResolvedValue([]); // нет установок в окне когорты
        const d30 = await qMomentyD30();
        expect(d30.state).toBe('no_data');
        expect(d30.data).toBeNull();
    });
});
