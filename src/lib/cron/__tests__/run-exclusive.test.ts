// Task 9 (cron safety): a new tick must be SKIPPED while the previous run
// of the same job is still in flight — never queued, never run concurrently.

import { describe, it, expect, vi } from 'vitest';
import { runExclusive } from '../run-exclusive';

function deferred<T = void>() {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((r) => { resolve = r; });
    return { promise, resolve };
}

describe('runExclusive', () => {
    it('skips a new tick while the previous run of the same job is still in flight', async () => {
        const gate = deferred();
        let concurrentRuns = 0;
        let maxConcurrent = 0;
        let completedRuns = 0;

        const job = runExclusive('test-job', async () => {
            concurrentRuns++;
            maxConcurrent = Math.max(maxConcurrent, concurrentRuns);
            await gate.promise;
            concurrentRuns--;
            completedRuns++;
        });

        const firstTick = job(); // starts, blocks on the gate
        const secondTick = job(); // fires while the first is still running — must be a no-op

        await secondTick; // the skipped tick resolves immediately
        expect(maxConcurrent).toBe(1); // never two bodies running at once
        expect(completedRuns).toBe(0); // the first hasn't finished yet

        gate.resolve();
        await firstTick;
        expect(completedRuns).toBe(1);
    });

    it('runs again on the NEXT tick once the previous run has finished', async () => {
        let calls = 0;
        const job = runExclusive('test-job', async () => { calls++; });

        await job();
        await job();
        await job();

        expect(calls).toBe(3);
    });

    it('releases the guard even when the wrapped job throws', async () => {
        let attempt = 0;
        const job = runExclusive('test-job', async () => {
            attempt++;
            if (attempt === 1) throw new Error('boom');
        });

        await expect(job()).rejects.toThrow('boom');
        // A throw must not leave the guard stuck "running" forever.
        await job();
        expect(attempt).toBe(2);
    });

    it('logs a warning naming the job when a tick is skipped', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const gate = deferred();
        const job = runExclusive('my-job', async () => { await gate.promise; });

        const first = job();
        await job(); // skipped

        expect(warn).toHaveBeenCalledWith(expect.stringContaining('my-job'));
        gate.resolve();
        await first;
        warn.mockRestore();
    });
});
