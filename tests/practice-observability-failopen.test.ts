// Задача 25 §12: наблюдаемость не имеет права ронять то, за чем наблюдает.
//
// Это не абстрактная осторожность. Если событие о конфликте записи бросит
// исключение, упадёт сама запись — то есть человек не попадёт к специалисту
// потому, что не сработал счётчик. Такой обмен недопустим ни в какую сторону.
//
// Общий track() фейл-опен сам по себе (tests/analytics-track.test.ts), но
// десять событий Задачи 25 идут через типизированный фасад, и проверить надо
// именно то, чем пользуется продуктовый код.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

const broken = vi.hoisted(() => ({
    db: {
        get analyticsEvent(): never { throw new Error('база недоступна'); },
    },
}));

vi.mock('@/lib/db', () => ({ db: broken.db }));

const facade = await import('@/lib/analytics/practice-events');

beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, ANALYTICS_TRACKING_ENABLED: 'true' };
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { process.env = { ...ORIGINAL_ENV }; });

describe('аналитика при недоступной базе', () => {
    it('конфликт записи: событие не уходит, но и не мешает обработать конфликт', async () => {
        await expect(
            facade.trackBookingConflict({ accountId: 'psy-1' }, { source: 'public_booking', error_code: 'SLOT_UNAVAILABLE' }),
        ).resolves.toBeUndefined();
    });

    it('состоявшийся перенос практики не отменяется из-за упавшего счётчика', async () => {
        await expect(
            facade.trackMigrationCommitted({ accountId: 'psy-1' }, { source: 'calendar', imported_count: 5, skipped_count: 0, failed_count: 0 }),
        ).resolves.toBeUndefined();
    });

    it('аккаунт без accountId событие не ломает — конверт остаётся законным', async () => {
        await expect(
            facade.trackOnboardingCompleted({ accountId: null }),
        ).resolves.toBeUndefined();
    });

    it('выключенная аналитика — тишина без исключений', async () => {
        process.env.ANALYTICS_TRACKING_ENABLED = 'false';

        await expect(
            facade.trackAttentionActionCompleted({ accountId: 'psy-1' }, { source: 'session_unpaid' }),
        ).resolves.toBeUndefined();
    });
});
