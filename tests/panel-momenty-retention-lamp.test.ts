// Два блока панели, чьи причины «нет данных» пережили поток F по недосмотру:
// обе ссылались на то, что «у МОМЕНТОВ нет сервера». После потоков A/B/E/F
// сервер есть, транспорт включён, события МОМЕНТОВ попадают в AnalyticsEvent
// — значит обе причины стали такой же унаследованной ложью, какую поток F
// вычистил в products.ts, просто в двух других файлах.
//
//  - q_retention_momenty (экран «Удержание») — когорты устройств считаются
//    ровно тем же способом, что и когорты специалистов рядом
//    (qCohortsPractice): когорта по неделе первой установки, удержание на
//    неделе N — доля устройств когорты, от которых на этой неделе пришло
//    хоть одно событие.
//  - q_lamp_app (экран «Утро», лампа «Приложение») — «нет сигнала от
//    приложений» теперь проверяемое утверждение, а не предположение.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
const count = vi.fn();

vi.mock('@/lib/db', () => ({
    db: {
        analyticsEvent: {
            findMany: (...args: unknown[]) => findMany(...args),
            count: (...args: unknown[]) => count(...args),
        },
    },
}));

import { qRetentionMomenty } from '@/lib/panel/queries/retention';
import { qLampApp } from '@/lib/panel/queries/morning';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

beforeEach(() => {
    findMany.mockReset();
    count.mockReset();
});

describe('q_retention_momenty', () => {
    it('без установок — no_data, и причина больше не про отсутствие сервера', async () => {
        findMany.mockResolvedValue([]);
        const block = await qRetentionMomenty();
        expect(block.state).toBe('no_data');
        expect(block.reason).not.toContain('нет сервера');
        expect(block.reason).toBeTruthy();
    });

    it('установки и возвраты дают измеренную долю, а незакрытая неделя — «рано» отличается от измеренного нуля', async () => {
        const now = Date.now();
        // Устройство установило приложение три недели назад и возвращалось на первой неделе.
        const installTs = new Date(now - 3 * WEEK_MS - DAY_MS);
        findMany
            .mockResolvedValueOnce([{ deviceId: 'dev-1', ts: installTs }, { deviceId: 'dev-2', ts: installTs }])
            .mockResolvedValueOnce([
                { deviceId: 'dev-1', ts: installTs },
                { deviceId: 'dev-1', ts: new Date(installTs.getTime() + WEEK_MS + DAY_MS) },
                { deviceId: 'dev-2', ts: installTs },
            ]);

        const block = await qRetentionMomenty();
        expect(block.state).toBe('ok');
        const rows = (block as { data: { rows: { size: number; cells: { kind: string; percent?: number }[] }[] } }).data.rows;
        const cohort = rows.find((r) => r.size === 2);
        expect(cohort, 'когорта из двух устройств должна найтись').toBeDefined();
        // Неделя 0 — оба устройства активны в неделю установки.
        expect(cohort!.cells[0]).toEqual({ kind: 'value', percent: 100 });
        // Неделя 1 — вернулось одно из двух.
        expect(cohort!.cells[1]).toEqual({ kind: 'value', percent: 50 });
        // Вот ради чего блок и существует: неделя 2 прожита и никто не
        // вернулся — это ИЗМЕРЕННЫЙ ноль; неделя 3 ещё не кончилась — это
        // «рано». Одинаково пустые на вид, противоположные по смыслу.
        expect(cohort!.cells[2]).toEqual({ kind: 'value', percent: 0 });
        expect(cohort!.cells[3]).toEqual({ kind: 'too_early' });
    });
});

describe('q_lamp_app', () => {
    it('событий не было никогда — лампа серая, и это сказано проверенным фактом', async () => {
        count.mockResolvedValue(0);
        const block = await qLampApp();
        const data = (block as { data: { lamp: string; detail: string } }).data;
        expect(data.lamp).toBe('unverified');
        expect(data.detail).not.toContain('нет сервера');
    });

    it('события были, но давно — предупреждение, а не «в порядке»', async () => {
        // порядок: ЗАПИСКИ за сутки, МОМЕНТЫ за сутки, всего за всё время
        count.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(41);
        const block = await qLampApp();
        const data = (block as { data: { lamp: string; detail: string } }).data;
        expect(data.lamp).toBe('warning');
    });

    it('события за сутки есть — лампа зелёная и показывает оба продукта', async () => {
        count.mockResolvedValueOnce(12).mockResolvedValueOnce(30).mockResolvedValueOnce(400);
        const block = await qLampApp();
        const data = (block as { data: { lamp: string; detail: string } }).data;
        expect(data.lamp).toBe('ok');
        expect(data.detail).toContain('12');
        expect(data.detail).toContain('30');
    });
});
