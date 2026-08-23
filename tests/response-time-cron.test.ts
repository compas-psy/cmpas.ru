// Периодический сброс окна времени ответа (ТЗ §5): proxy.ts копит
// длительности в общем буфере процесса; эта задача — тонкая cron-обвязка
// вокруг persistResponseTimeWindow (уже покрыт tests/response-time.test.ts),
// добавляющая только то, что сама persistResponseTimeWindow не знает: где
// кончается предыдущее окно и начинается следующее.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const create = vi.fn().mockResolvedValue({});
vi.mock('@/lib/db', () => ({ db: { appResponseTime: { create: (...args: unknown[]) => create(...args) } } }));

import { flushResponseTimeWindow } from '@/lib/cron/response-time';
import { defaultDurationStore, recordRequestDuration } from '@/lib/infra-pulse/response-time';

describe('flushResponseTimeWindow (O-260817-12/§5)', () => {
    beforeEach(() => {
        create.mockClear();
        create.mockResolvedValue({});
        defaultDurationStore.length = 0;
    });

    it('пустой буфер — ничего не пишет, это не сбой', async () => {
        await flushResponseTimeWindow(new Date('2026-08-23T10:05:00Z'));
        expect(create).not.toHaveBeenCalled();
    });

    it('непустой буфер — пишет окно и опустошает буфер', async () => {
        recordRequestDuration(100);
        recordRequestDuration(300);
        await flushResponseTimeWindow(new Date('2026-08-23T10:05:00Z'));
        expect(create).toHaveBeenCalledTimes(1);
        expect(defaultDurationStore).toEqual([]);
    });

    it('следующее окно начинается там, где закончилось предыдущее, а не растягивается с самого начала', async () => {
        recordRequestDuration(100);
        await flushResponseTimeWindow(new Date('2026-08-23T10:05:00Z'));
        recordRequestDuration(200);
        await flushResponseTimeWindow(new Date('2026-08-23T10:10:00Z'));

        expect(create).toHaveBeenCalledTimes(2);
        const secondCallArgs = create.mock.calls[1][0];
        expect(secondCallArgs.data.windowStart).toEqual(new Date('2026-08-23T10:05:00Z'));
        expect(secondCallArgs.data.windowEnd).toEqual(new Date('2026-08-23T10:10:00Z'));
    });

    it('сбой записи в БД не блокирует следующее окно — оно всё равно начинается сейчас, а не остаётся зависшим', async () => {
        recordRequestDuration(100);
        create.mockRejectedValueOnce(new Error('db down'));
        await expect(flushResponseTimeWindow(new Date('2026-08-23T10:05:00Z'))).resolves.toBeUndefined();

        recordRequestDuration(200);
        await flushResponseTimeWindow(new Date('2026-08-23T10:10:00Z'));
        const secondCallArgs = create.mock.calls[1][0];
        expect(secondCallArgs.data.windowStart).toEqual(new Date('2026-08-23T10:05:00Z'));
    });
});
