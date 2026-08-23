// Провод: НАСТОЯЩИЙ мост ЗАПИСОК → HTTP → НАСТОЯЩИЙ обработчик /ingest.
//
// Предыдущий файл (cross-repo-contract.test.ts) проверяет конверт и гейт
// согласия. Он не проверяет провод: имя заголовка аутентификации, форму тела
// (массив против одного объекта) и разбор `{results:[...]}`. Именно на
// проводе и сломался поток C — он слал `x-simpas-ingest-secret`, а приёмник
// требует `Authorization: Bearer`, и ни один тест ни в одном из двух
// репозиториев этого не видел, потому что каждый проверял себя против
// собственной заглушки другой стороны.
//
// Здесь обе стороны настоящие: класс `PracticeBridge` импортируется прямо из
// рабочего дерева ЗАПИСОК, обработчик `POST` — из этого репозитория, между
// ними настоящий http-сервер и настоящий `fetch`.
//
// Чего этот тест НЕ доказывает, и это важно называть: база данных здесь
// подменена (`vi.mock('@/lib/db')`), потому что `prisma generate` в этой
// среде заблокирован прокси и Prisma Client — заглушка. Значит проверены
// маршрут, аутентификация, форма тела и разбор ответа, но не запись в
// Postgres. Первый настоящий сквозной прогон против живой базы — за
// человеком, после выката.

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';

const SECRET = 'wire-test-secret';
process.env.ANALYTICS_INGEST_ENABLED = 'true';
process.env.ANALYTICS_INGEST_SECRET = SECRET;

interface EventRecord { event: string; product: string; accountId: string | null; deviceId: string | null; eventId: string | null; [key: string]: unknown }
const events: EventRecord[] = [];
const rejected: { reason: string; payload: unknown }[] = [];
const deviceConsents = new Map<string, { deviceId: string; consentAt: Date | null }>();
let userLookups = 0;

vi.mock('@/lib/db', () => ({
    db: {
        analyticsEvent: {
            create: async ({ data }: { data: EventRecord }) => { events.push(data); return data; },
            findUnique: async ({ where }: { where: { eventId: string } }) => events.find((e) => e.eventId === where.eventId) ?? null,
        },
        analyticsEventRejected: { create: async ({ data }: { data: { reason: string; payload: unknown } }) => { rejected.push(data); return data; } },
        user: { findUnique: async () => { userLookups += 1; return null; }, update: async () => null },
        analyticsDeviceConsent: {
            findUnique: async ({ where }: { where: { deviceId: string } }) => deviceConsents.get(where.deviceId) ?? null,
            upsert: async ({ where, create, update }: { where: { deviceId: string }; create: { deviceId: string; consentAt: Date | null }; update: { consentAt: Date | null } }) => {
                const next = { ...(deviceConsents.get(where.deviceId) ?? create), ...update };
                deviceConsents.set(where.deviceId, next);
                return next;
            },
        },
    },
}));

let server: http.Server;
let url: string;

beforeAll(async () => {
    const { POST } = await import('@/app/api/ingest/route');
    const { NextRequest } = await import('next/server');

    server = http.createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', async () => {
            const request = new NextRequest(`http://127.0.0.1${req.url}`, {
                method: req.method,
                headers: req.headers as Record<string, string>,
                body: Buffer.concat(chunks).toString('utf8'),
            });
            const response = await POST(request);
            res.writeHead(response.status, { 'content-type': 'application/json' });
            res.end(await response.text());
        });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/ingest`;
});

afterAll(() => { server?.close(); });

async function bridgeFor(secret: string) {
    const { createPracticeBridge } = await import('/tmp/work/zapiski/server/src/services/practiceBridge.ts');
    return createPracticeBridge({ PRACTICE_INGEST_URL: url, PRACTICE_INGEST_SECRET: secret });
}

const ts = '2026-08-23T10:00:00.000Z';
const consent = { event: 'consent_updated', ts, product: 'zapiski' as const, account_id: 'wire-user', device_id: null, props: { granted: true }, schema_version: 1, event_id: 'w1111111-1111-4111-8111-111111111111' };
const note = { event: 'note_saved', ts, product: 'zapiski' as const, account_id: 'wire-user', device_id: null, props: { length_bucket: 'm', encrypted: true }, schema_version: 1, event_id: 'w2222222-2222-4222-8222-222222222222' };

describe('мост ЗАПИСОК против настоящего обработчика /ingest', () => {
    it('пачка уходит массивом, принимается поэлементно и доезжает до записи', async () => {
        const bridge = await bridgeFor(SECRET);
        expect(bridge).not.toBeNull();
        const results = await bridge!.forwardBatch([consent, note]);
        expect(results.map((r) => r.outcome)).toEqual(['accepted', 'accepted']);
        expect(events.map((e) => e.event)).toEqual(['consent_updated', 'note_saved']);
        expect(userLookups).toBe(0);
    });

    it('неверный секрет — мост честно видит отказ, а не считает 401 успехом', async () => {
        const bridge = await bridgeFor('wrong-secret');
        const results = await bridge!.forwardBatch([{ ...note, event_id: 'w3333333-3333-4333-8333-333333333333' }]);
        expect(results[0].outcome).not.toBe('accepted');
    });

    it('событие субъекта без согласия отвергается на проводе, и мост это различает', async () => {
        const bridge = await bridgeFor(SECRET);
        const results = await bridge!.forwardBatch([{ ...note, account_id: 'wire-user-no-consent', event_id: 'w4444444-4444-4444-8444-444444444444' }]);
        expect(results[0].outcome).toBe('rejected');
        expect(events.some((e) => e.accountId === 'wire-user-no-consent')).toBe(false);
    });
});
