// q_tech_response_p95 (ТЗ §5, экран 6) был пуст — источника не было.
// src/proxy.ts (в Next.js 16 — обязательная замена deprecated
// middleware.ts, см. https://nextjs.org/docs/messages/middleware-to-proxy)
// меряет длительность каждого запроса и складывает её в общий буфер
// (src/lib/infra-pulse/response-time.ts), который потом снимает cron.
//
// after() требует реальный контекст запроса Next.js, которого в юнит-тесте
// нет — подменяем его так, чтобы переданный колбэк просто выполнялся сразу.
// Важно здесь только то, что колбэк действительно вызывается и действительно
// пишет в общий буфер, а не то, как сам Next.js планирует его выполнение.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const afterMock = vi.fn((cb: () => void) => cb());
vi.mock('next/server', async (importOriginal) => {
    const actual = await importOriginal<typeof import('next/server')>();
    return { ...actual, after: (cb: () => void) => afterMock(cb) };
});

import { proxy, config } from '@/proxy';
import { defaultDurationStore } from '@/lib/infra-pulse/response-time';

describe('proxy — измерение времени ответа (ТЗ §5)', () => {
    beforeEach(() => {
        afterMock.mockClear();
        defaultDurationStore.length = 0;
    });

    it('пишет неотрицательную длительность в общий буфер после ответа', () => {
        const request = new Request('https://cmpas.ru/diary') as any;

        proxy(request);

        expect(afterMock).toHaveBeenCalledTimes(1);
        expect(defaultDurationStore.length).toBe(1);
        expect(defaultDurationStore[0]).toBeGreaterThanOrEqual(0);
    });

    it('возвращает ответ, позволяющий запросу продолжиться, а не блокирует его на замер', () => {
        const request = new Request('https://cmpas.ru/diary') as any;

        const response = proxy(request);

        expect(response).toBeDefined();
        expect(response.headers.get('x-middleware-next')).toBe('1');
    });

    it('matcher исключает статику _next и favicon — не тратим буфер на шум', () => {
        expect(config.matcher).toEqual(['/((?!_next/static|_next/image|favicon.ico).*)']);
    });

    it('не задаёт runtime: proxy.ts всегда выполняется в Node.js и падает при явном runtime-конфиге', () => {
        expect((config as Record<string, unknown>).runtime).toBeUndefined();
    });
});
