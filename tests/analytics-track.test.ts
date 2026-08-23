// B4: track() — единая точка отправки событий ПРАКТИКИ в тот же конвейер,
// что и POST /ingest (processIngestEvent). Проверяем: уважает
// ANALYTICS_TRACKING_ENABLED, никогда не бросает наружу, пишет корректный
// конверт.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { track } from '@/lib/analytics/track';

const ORIGINAL_ENV = { ...process.env };

function makeDb(user: { id: string; analyticsConsentAt: Date | null } | null) {
    const events: Record<string, unknown>[] = [];
    const db = {
        analyticsEvent: {
            create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
                events.push(data);
                return data;
            }),
            findUnique: vi.fn(async () => null),
        },
        analyticsEventRejected: { create: vi.fn(async () => ({})) },
        user: {
            findUnique: vi.fn(async () => user),
            update: vi.fn(async () => user),
        },
        analyticsDeviceConsent: {
            findUnique: vi.fn(async () => null),
            upsert: vi.fn(async () => ({})),
        },
    };
    return { db: db as any, events };
}

describe('track (B4)', () => {
    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV };
    });
    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
    });

    it('ANALYTICS_TRACKING_ENABLED=false — ничего не пишет и не бросает', async () => {
        process.env.ANALYTICS_TRACKING_ENABLED = 'false';
        const { db, events } = makeDb({ id: 'u1', analyticsConsentAt: new Date() });
        await expect(track(db, { event: 'payment_succeeded', product: 'practice', accountId: 'u1', props: { terminal: 'site', plan: 'practice', amount: 99000, months: 1 } })).resolves.toBeUndefined();
        expect(events).toHaveLength(0);
        expect(db.analyticsEvent.create).not.toHaveBeenCalled();
    });

    it('ANALYTICS_TRACKING_ENABLED=true, известный account_id, есть согласие — пишет событие с полным конвертом', async () => {
        process.env.ANALYTICS_TRACKING_ENABLED = 'true';
        const { db, events } = makeDb({ id: 'u1', analyticsConsentAt: new Date() });
        await track(db, {
            event: 'payment_succeeded',
            product: 'practice',
            accountId: 'u1',
            props: { terminal: 'site', plan: 'practice', amount: 99000, months: 1 },
        });
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            event: 'payment_succeeded',
            product: 'practice',
            accountId: 'u1',
            schemaVersion: 1,
        });
    });

    it('неизвестный account_id (пользователь не найден в базе) — не бросает, событие уходит в отклонённые', async () => {
        process.env.ANALYTICS_TRACKING_ENABLED = 'true';
        const { db, events } = makeDb(null);
        await expect(
            track(db, { event: 'payment_succeeded', product: 'practice', accountId: 'ghost', props: { terminal: 'site', plan: 'practice', amount: 1, months: 1 } }),
        ).resolves.toBeUndefined();
        expect(events).toHaveLength(0);
        expect(db.analyticsEventRejected.create).toHaveBeenCalledTimes(1);
    });

    it('ошибка транспорта (падение записи в базу) проглатывается — не долетает до вызывающего кода', async () => {
        process.env.ANALYTICS_TRACKING_ENABLED = 'true';
        const { db } = makeDb({ id: 'u1', analyticsConsentAt: new Date() });
        db.analyticsEvent.create.mockRejectedValueOnce(new Error('db is down'));

        await expect(
            track(db, { event: 'payment_succeeded', product: 'practice', accountId: 'u1', props: { terminal: 'site', plan: 'practice', amount: 1, months: 1 } }),
        ).resolves.toBeUndefined();
    });

    it('невалидное событие (не в реестре) не бросает — проглатывается как отказ', async () => {
        process.env.ANALYTICS_TRACKING_ENABLED = 'true';
        const { db } = makeDb({ id: 'u1', analyticsConsentAt: new Date() });
        await expect(track(db, { event: 'not_a_real_event', product: 'practice', accountId: 'u1' })).resolves.toBeUndefined();
    });
});
