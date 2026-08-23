// Секрет на продукт (Часть 4). До этой правки ANALYTICS_INGEST_SECRET был один
// на весь контур: им пользуется мост ЗАПИСОК и веб ПРАКТИКИ, и им же должны
// были пользоваться МОМЕНТЫ из своего APK. Секрет, попавший в публикуемый APK,
// извлекается из скачанного файла за минуты — то есть публикация приложения
// публиковала бы ключ от приёма ВСЕХ ТРЁХ продуктов.
//
// Теперь у МОМЕНТОВ отдельный ANALYTICS_INGEST_SECRET_MOMENTS, и секрет решает,
// под каким product разрешено слать. Проверка подлинности идёт до разбора тела
// (иначе неаутентифицированный запрос управлял бы разбором), а привязка
// секрет→продукт сверяется ПОСЛЕ проверки конверта: испорченный конверт должен
// получать «неверный конверт», а не «не тот продукт».

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveIngestIdentity } from '../src/lib/analytics/secrets';

const ORIGINAL_ENV = { ...process.env };

const SHARED = 'a'.repeat(64);
const MOMENTS = 'b'.repeat(64);

describe('секрет определяет, под каким продуктом разрешено слать', () => {
    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV };
        process.env.ANALYTICS_INGEST_SECRET = SHARED;
        process.env.ANALYTICS_INGEST_SECRET_MOMENTS = MOMENTS;
    });
    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
    });

    it('секретом МОМЕНТОВ нельзя прислать событие ЗАПИСОК', () => {
        const identity = resolveIngestIdentity(`Bearer ${MOMENTS}`);
        expect(identity).not.toBeNull();
        expect(identity!.allows('zapiski')).toBe(false);
    });

    it('секретом МОМЕНТОВ нельзя прислать событие ПРАКТИКИ', () => {
        const identity = resolveIngestIdentity(`Bearer ${MOMENTS}`);
        expect(identity!.allows('practice')).toBe(false);
    });

    it('секретом МОМЕНТОВ можно прислать событие МОМЕНТОВ', () => {
        const identity = resolveIngestIdentity(`Bearer ${MOMENTS}`);
        expect(identity!.allows('moments')).toBe(true);
    });

    it('старый общий секрет остаётся действующим для practice и zapiski', () => {
        const identity = resolveIngestIdentity(`Bearer ${SHARED}`);
        expect(identity!.allows('practice')).toBe(true);
        expect(identity!.allows('zapiski')).toBe(true);
    });

    it('старым общим секретом нельзя прислать событие МОМЕНТОВ', () => {
        const identity = resolveIngestIdentity(`Bearer ${SHARED}`);
        expect(identity!.allows('moments')).toBe(false);
    });

    it('чужой секрет не подходит ни подо что', () => {
        expect(resolveIngestIdentity(`Bearer ${'c'.repeat(64)}`)).toBeNull();
    });

    it('без заголовка — отказ', () => {
        expect(resolveIngestIdentity(null)).toBeNull();
        expect(resolveIngestIdentity('')).toBeNull();
        expect(resolveIngestIdentity(SHARED)).toBeNull(); // без префикса Bearer
    });

    it('когда не настроен ни один секрет — отказ всем, приёмник не открывается', () => {
        delete process.env.ANALYTICS_INGEST_SECRET;
        delete process.env.ANALYTICS_INGEST_SECRET_MOMENTS;
        expect(resolveIngestIdentity(`Bearer ${SHARED}`)).toBeNull();
    });

    it('секрет МОМЕНТОВ работает и когда общий секрет не настроен вовсе', () => {
        delete process.env.ANALYTICS_INGEST_SECRET;
        const identity = resolveIngestIdentity(`Bearer ${MOMENTS}`);
        expect(identity!.allows('moments')).toBe(true);
    });

    it('секреты разной длины не ломают постоянное по времени сравнение', () => {
        process.env.ANALYTICS_INGEST_SECRET_MOMENTS = 'короткий';
        expect(resolveIngestIdentity(`Bearer ${SHARED}`)!.allows('practice')).toBe(true);
        expect(resolveIngestIdentity('Bearer короткий')!.allows('moments')).toBe(true);
    });
});

// ── Сквозная проверка: привязка сверяется ПОСЛЕ конверта ────────────────────

import { processIngestEvent } from '@/lib/analytics/ingest';

type Db = Parameters<typeof processIngestEvent>[0];

function makeDb() {
    const events: unknown[] = [];
    const rejected: Array<{ reason: string }> = [];
    const db = {
        analyticsEvent: {
            create: async ({ data }: { data: unknown }) => { events.push(data); return data; },
            findUnique: async () => null,
        },
        analyticsEventRejected: { create: async ({ data }: { data: { reason: string } }) => { rejected.push(data); return data; } },
        user: { findUnique: async () => ({ id: 'u1', analyticsConsentAt: new Date() }), update: async () => ({}) },
        analyticsDeviceConsent: { findUnique: async () => ({ deviceId: 'd', consentAt: new Date() }), upsert: async () => ({}) },
    } as unknown as Db;
    return { db, events, rejected };
}

const momentsEvent = {
    event: 'app_installed',
    ts: '2026-08-23T10:00:00Z',
    product: 'moments',
    device_id: 'device-1',
    props: {},
    schema_version: 1,
};

describe('приёмник: привязка секрет→продукт сверяется после проверки конверта', () => {
    it('корректное событие чужого продукта отвергается с внятной причиной', async () => {
        const { db, events, rejected } = makeDb();
        const result = await processIngestEvent(db, momentsEvent, new Date(), new Map(), () => false);
        expect(result).toEqual({ accepted: false, reason: 'secret not allowed for product moments' });
        expect(events).toHaveLength(0);
        expect(rejected[0].reason).toBe('secret not allowed for product moments');
    });

    it('испорченный конверт получает «неверный конверт», а не «не тот продукт»', async () => {
        const { db } = makeDb();
        const broken = { ...momentsEvent, event: 'событие_которого_нет' };
        const result = await processIngestEvent(db, broken, new Date(), new Map(), () => false);
        expect(result.accepted).toBe(false);
        expect((result as { reason: string }).reason).toContain('unknown event');
    });

    it('свой продукт проходит', async () => {
        const { db, events } = makeDb();
        const result = await processIngestEvent(db, momentsEvent, new Date(), new Map(), (p) => p === 'moments');
        expect(result).toEqual({ accepted: true });
        expect(events).toHaveLength(1);
    });

    it('без указания проверки поведение прежнее — ничего не сломано у существующих вызовов', async () => {
        const { db, events } = makeDb();
        const result = await processIngestEvent(db, momentsEvent);
        expect(result).toEqual({ accepted: true });
        expect(events).toHaveLength(1);
    });
});
