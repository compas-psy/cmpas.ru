// F4: q_event_silence группировал события только по имени. После E1
// (consent_updated/identity_linked стали многопродуктовыми — реестр отдаёт
// им product: "practice, zapiski, moments") живой поток одного продукта
// маскирует тишину двух других под тем же именем события: если ПРАКТИКА
// шлёт identity_linked каждый день, а ЗАПИСКИ и МОМЕНТЫ его вообще не
// отправляют, единственная строка "identity_linked" всё равно окажется
// "ok" — тишина двух третей источников не видна. Чиним группировкой по
// паре (событие, продукт).

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

    it('многопродуктовое событие (identity_linked) даёт отдельную строку на каждый продукт', async () => {
        groupBy.mockResolvedValue([]);
        const block = await qEventSilence();
        expect(block.state).toBe('ok');
        const rows = block.data ?? [];
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
        const rows = block.data ?? [];

        const practiceRow = rows.find((r) => r.event === 'identity_linked' && r.product === 'practice');
        const zapiskiRow = rows.find((r) => r.event === 'identity_linked' && r.product === 'zapiski');
        const momentyRow = rows.find((r) => r.event === 'identity_linked' && r.product === 'moments');

        expect(practiceRow?.severity).toBe('ok');
        expect(zapiskiRow?.severity).toBe('never');
        expect(zapiskiRow?.silentHours).toBeNull();
        expect(momentyRow?.severity).toBe('never');
        expect(momentyRow?.silentHours).toBeNull();
    });

    it('однопродуктовое событие (note_saved) даёт ровно одну строку с product=zapiski', async () => {
        groupBy.mockResolvedValue([]);
        const block = await qEventSilence();
        const rows = block.data ?? [];
        const noteSavedRows = rows.filter((r) => r.event === 'note_saved');
        expect(noteSavedRows).toHaveLength(1);
        expect(noteSavedRows[0].product).toBe('zapiski');
    });
});
