// POST /ingest (O-260817-17): приёмник был открыт всем (никакой проверки
// подлинности запроса) и принимал только одно событие за раз. Эти тесты
// проверяют аутентификацию общим секретом (включая честный отказ, когда
// секрета вовсе нет в окружении) и приём пачки — на уровне route handler'а,
// с замоканным processIngestEvent (его собственная логика уже проверена в
// tests/analytics-ingest.test.ts).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const processIngestEvent = vi.fn();
vi.mock('@/lib/analytics/ingest', () => ({
    processIngestEvent: (...args: unknown[]) => processIngestEvent(...args),
    MAX_INGEST_BATCH_SIZE: 200,
}));

// Реальный @/lib/db тянет Prisma Client, которому в этой песочнице неоткуда
// взять движок (сеть к binaries.prisma.sh закрыта политикой прокси) — route
// сам его не использует, кроме передачи в processIngestEvent (замокан).
vi.mock('@/lib/db', () => ({ db: {} }));

function req(body: unknown, headers: Record<string, string> = {}): Request {
    return new Request('https://cmpas.ru/api/ingest', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
    });
}

const ORIGINAL_ENV = { ...process.env };

describe('POST /ingest — аутентификация общим секретом (O-260817-17)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        process.env = { ...ORIGINAL_ENV, ANALYTICS_INGEST_ENABLED: 'true' };
    });
    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
    });

    it('без секрета в окружении — отказ 401 даже с заголовком, приёмник не открывается', async () => {
        delete process.env.ANALYTICS_INGEST_SECRET;
        const { POST } = await import('../src/app/api/ingest/route');
        const res = await POST(req({}, { authorization: 'Bearer whatever' }) as any);
        expect(res.status).toBe(401);
        expect(processIngestEvent).not.toHaveBeenCalled();
    });

    it('без секрета в окружении и вовсе без заголовка — тоже 401, не открытый приём', async () => {
        delete process.env.ANALYTICS_INGEST_SECRET;
        const { POST } = await import('../src/app/api/ingest/route');
        const res = await POST(req({}) as any);
        expect(res.status).toBe(401);
        expect(processIngestEvent).not.toHaveBeenCalled();
    });

    it('секрет задан, заголовка Authorization нет — 401', async () => {
        process.env.ANALYTICS_INGEST_SECRET = 'topsecret';
        const { POST } = await import('../src/app/api/ingest/route');
        const res = await POST(req({}) as any);
        expect(res.status).toBe(401);
        expect(processIngestEvent).not.toHaveBeenCalled();
    });

    it('секрет задан, заголовок с неверным значением — 401', async () => {
        process.env.ANALYTICS_INGEST_SECRET = 'topsecret';
        const { POST } = await import('../src/app/api/ingest/route');
        const res = await POST(req({}, { authorization: 'Bearer wrong' }) as any);
        expect(res.status).toBe(401);
        expect(processIngestEvent).not.toHaveBeenCalled();
    });

    it('верный секрет — запрос доходит до обработки', async () => {
        process.env.ANALYTICS_INGEST_SECRET = 'topsecret';
        processIngestEvent.mockResolvedValue({ accepted: true });
        const { POST } = await import('../src/app/api/ingest/route');
        const res = await POST(req({ event: 'x' }, { authorization: 'Bearer topsecret' }) as any);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ accepted: true });
        expect(processIngestEvent).toHaveBeenCalledTimes(1);
    });
});

describe('POST /ingest — приём пачки (O-260817-17)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        process.env = { ...ORIGINAL_ENV, ANALYTICS_INGEST_ENABLED: 'true', ANALYTICS_INGEST_SECRET: 'topsecret' };
    });
    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
    });

    function auth(body: unknown) {
        return req(body, { authorization: 'Bearer topsecret' });
    }

    it('массив до 200 событий обрабатывается поштучно, ответ — массив результатов в том же порядке', async () => {
        processIngestEvent.mockResolvedValueOnce({ accepted: true }).mockResolvedValueOnce({ accepted: false, reason: 'boom' });
        const events = [{ event: 'e0' }, { event: 'e1' }];
        const { POST } = await import('../src/app/api/ingest/route');
        const res = await POST(auth(events) as any);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.results).toEqual([{ accepted: true }, { accepted: false, reason: 'boom' }]);
        expect(processIngestEvent).toHaveBeenCalledTimes(2);
    });

    it('пачка больше 200 отклоняется с внятной причиной, ни одно событие не обрабатывается', async () => {
        const events = Array.from({ length: 201 }, (_, i) => ({ event: `e${i}` }));
        const { POST } = await import('../src/app/api/ingest/route');
        const res = await POST(auth(events) as any);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.accepted).toBe(false);
        expect(body.reason).toMatch(/200/);
        expect(processIngestEvent).not.toHaveBeenCalled();
    });

    it('ровно 200 событий — принимается', async () => {
        processIngestEvent.mockResolvedValue({ accepted: true });
        const events = Array.from({ length: 200 }, (_, i) => ({ event: `e${i}` }));
        const { POST } = await import('../src/app/api/ingest/route');
        const res = await POST(auth(events) as any);
        expect(res.status).toBe(200);
        expect(processIngestEvent).toHaveBeenCalledTimes(200);
    });

    it('пустой массив отклоняется как отказ, а не как 200 без событий', async () => {
        const { POST } = await import('../src/app/api/ingest/route');
        const res = await POST(auth([]) as any);
        expect(res.status).toBe(400);
        expect(processIngestEvent).not.toHaveBeenCalled();
    });

    it('одиночный объект по-прежнему отдаёт одиночный результат, а не массив — существующее поведение не сломано', async () => {
        processIngestEvent.mockResolvedValue({ accepted: false, reason: 'unknown account_id' });
        const { POST } = await import('../src/app/api/ingest/route');
        const res = await POST(auth({ event: 'x' }) as any);
        const body = await res.json();
        expect(body).toEqual({ accepted: false, reason: 'unknown account_id' });
        expect(body.results).toBeUndefined();
        expect(processIngestEvent).toHaveBeenCalledTimes(1);
    });
});
