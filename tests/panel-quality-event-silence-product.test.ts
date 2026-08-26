// F4: q_event_silence группировал события только по имени. После E1
// (consent_updated/identity_linked стали многопродуктовыми — реестр отдаёт
// им product: "practice, zapiski, moments") живой поток одного продукта
// маскирует тишину двух других под тем же именем события: если ПРАКТИКА
// шлёт identity_linked каждый день, а ЗАПИСКИ и МОМЕНТЫ его вообще не
// отправляют, единственная строка "identity_linked" всё равно окажется
// "ok" — тишина двух третей источников не видна. Чиним группировкой по
// паре (событие, продукт).
//
// 26.08: результат разделён на outages (потоки, которые хоть раз
// начинались — живые и замолчавшие) и notStarted (не начинались ни разу —
// план работ, не авария). Двадцать строк плана не должны топить строку
// настоящей аварии — раньше всё лежало в одном списке.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const groupBy = vi.fn();

vi.mock('@/lib/db', () => ({
    db: {
        analyticsEvent: {
            groupBy: (...args: unknown[]) => groupBy(...args),
        },
    },
}));

import { qEventSilence } from '@/lib/panel/queries/quality';
import { resetRegistryCache } from '@/lib/panel/queries/registry';

beforeEach(() => {
    groupBy.mockReset();
    resetRegistryCache();
});

describe('q_event_silence: группировка по (событие, продукт), не только по событию (F4)', () => {
    it('группирует запрос к базе по event И product', async () => {
        groupBy.mockResolvedValue([]);
        await qEventSilence();
        expect(groupBy).toHaveBeenCalledWith(
            expect.objectContaining({ by: expect.arrayContaining(['event', 'product']) }),
        );
    });

    it('многопродуктовое событие (identity_linked) даёт отдельную строку на каждый продукт в notStarted, если никто не шлёт', async () => {
        groupBy.mockResolvedValue([]);
        const block = await qEventSilence();
        expect(block.state).toBe('ok');
        const rows = block.data?.notStarted ?? [];
        const identityRows = rows.filter((r) => r.event === 'identity_linked');
        expect(identityRows.map((r) => r.product).sort()).toEqual(['moments', 'practice', 'zapiski']);
    });

    it('живой поток ПРАКТИКИ не маскирует тишину ЗАПИСОК/МОМЕНТОВ на том же событии', async () => {
        const now = new Date();
        groupBy.mockResolvedValue([
            { event: 'identity_linked', product: 'practice', _max: { ts: now } },
            // zapiski и moments вообще не прислали identity_linked — не должны
            // унаследовать свежесть от practice.
        ]);
        const block = await qEventSilence();
        const outages = block.data?.outages ?? [];
        const notStarted = block.data?.notStarted ?? [];

        const practiceRow = outages.find((r) => r.event === 'identity_linked' && r.product === 'practice');
        const zapiskiRow = notStarted.find((r) => r.event === 'identity_linked' && r.product === 'zapiski');
        const momentyRow = notStarted.find((r) => r.event === 'identity_linked' && r.product === 'moments');

        expect(practiceRow?.severity).toBe('ok');
        expect(zapiskiRow?.severity).toBe('never');
        expect(zapiskiRow?.silentHours).toBeNull();
        expect(momentyRow?.severity).toBe('never');
        expect(momentyRow?.silentHours).toBeNull();

        // Живой поток ПРАКТИКИ — это НЕ авария, он лежит рядом с "never" в
        // разных списках, но не в одном: outages не должен содержать строк
        // с severity 'never', notStarted не должен содержать 'ok'.
        expect(outages.some((r) => r.severity === 'never')).toBe(false);
        expect(notStarted.some((r) => r.severity !== 'never')).toBe(false);
    });

    it('однопродуктовое событие (note_saved) даёт ровно одну строку с product=zapiski', async () => {
        groupBy.mockResolvedValue([]);
        const block = await qEventSilence();
        const rows = block.data?.notStarted ?? [];
        const noteSavedRows = rows.filter((r) => r.event === 'note_saved');
        expect(noteSavedRows).toHaveLength(1);
        expect(noteSavedRows[0].product).toBe('zapiski');
    });

    it('замолчавший поток (был живой, теперь тихо) попадает в outages, а не в notStarted', async () => {
        const longAgo = new Date(Date.now() - 100 * 60 * 60 * 1000); // 100ч — serious по порогу eventSilenceHours
        groupBy.mockResolvedValue([{ event: 'identity_linked', product: 'practice', _max: { ts: longAgo } }]);

        const block = await qEventSilence();
        const outages = block.data?.outages ?? [];
        const row = outages.find((r) => r.event === 'identity_linked' && r.product === 'practice');

        expect(row?.severity).toBe('serious');
        expect(row?.silentHours).not.toBeNull();
        expect(block.data?.notStarted.some((r) => r.event === 'identity_linked' && r.product === 'practice')).toBe(false);
    });
});
