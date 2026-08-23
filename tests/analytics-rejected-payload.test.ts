// Отвергнутое событие тоже попадает в базу — и до этой правки попадало ЦЕЛИКОМ.
//
// processIngestEvent при неудачной валидации писал `payload: raw` без всякой
// обработки. Строгая типизация props защищала только таблицу принятых событий;
// у events_rejected защиты не было вовсе. Значит любой обладатель валидного
// токена мог одним намеренно неправильным конвертом положить в базу
// произвольный текст — например, содержание заметки о клиенте, — и оно легло
// бы туда без ограничения размера.
//
// Это прямо противоречит красной линии «содержание записей клиентов не
// измеряется никогда»: клиент — не граница доверия, границей является сервер.

import { describe, it, expect } from 'vitest';
import { processIngestEvent } from '@/lib/analytics/ingest';

type Db = Parameters<typeof processIngestEvent>[0];

function makeDb() {
    const rejected: Array<{ reason: string; payload: unknown }> = [];
    const db = {
        analyticsEvent: { create: async ({ data }: any) => data, findUnique: async () => null },
        analyticsEventRejected: { create: async ({ data }: any) => { rejected.push(data); return data; } },
        user: { findUnique: async () => ({ id: 'u1', analyticsConsentAt: new Date() }), update: async () => ({}) },
        analyticsDeviceConsent: { findUnique: async () => null, upsert: async () => ({}) },
    } as unknown as Db;
    return { db, rejected };
}

const SECRET_TEXT = 'клиент рассказал про развод и назвал имя Иванова';

describe('в events_rejected не попадает содержание', () => {
    it('строка вместо объекта props не проносит текст в базу', async () => {
        const { db, rejected } = makeDb();
        await processIngestEvent(db, {
            event: 'app_opened',
            ts: '2026-08-23T10:00:00Z',
            product: 'practice',
            account_id: 'u1',
            props: SECRET_TEXT as unknown as Record<string, unknown>,
            schema_version: 1,
        });
        expect(rejected).toHaveLength(1);
        expect(JSON.stringify(rejected[0].payload)).not.toContain('развод');
        expect(JSON.stringify(rejected[0].payload)).not.toContain('Иванова');
    });

    it('незаявленное свойство не проносит ни своё значение, ни своё имя', async () => {
        const { db, rejected } = makeDb();
        await processIngestEvent(db, {
            event: 'app_opened',
            ts: '2026-08-23T10:00:00Z',
            product: 'practice',
            account_id: 'u1',
            props: { surface: 'android', [SECRET_TEXT]: SECRET_TEXT },
            schema_version: 1,
        });
        const dump = JSON.stringify(rejected[0].payload);
        expect(dump).not.toContain('развод');
        expect(dump).not.toContain('Иванова');
    });

    it('вложенный объект в значении свойства не проносит содержание', async () => {
        const { db, rejected } = makeDb();
        await processIngestEvent(db, {
            event: 'app_opened',
            ts: '2026-08-23T10:00:00Z',
            product: 'practice',
            account_id: 'u1',
            props: { surface: { note: SECRET_TEXT, deep: { more: SECRET_TEXT } } },
            schema_version: 1,
        });
        expect(JSON.stringify(rejected[0].payload)).not.toContain('развод');
    });

    it('причина отказа и структурные поля сохраняются — иначе отладка невозможна', async () => {
        const { db, rejected } = makeDb();
        await processIngestEvent(db, {
            event: 'событие_которого_нет',
            ts: '2026-08-23T10:00:00Z',
            product: 'practice',
            account_id: 'u1',
            props: {},
            schema_version: 1,
        });
        expect(rejected[0].reason).toContain('unknown event');
        const payload = rejected[0].payload as Record<string, unknown>;
        expect(payload.event).toBe('событие_которого_нет');
        expect(payload.product).toBe('practice');
        expect(payload.schema_version).toBe(1);
    });

    it('значения ОБЪЯВЛЕННЫХ свойств сохраняются: они структурны по построению', async () => {
        const { db, rejected } = makeDb();
        await processIngestEvent(db, {
            event: 'session_status_changed',
            ts: '2026-08-23T10:00:00Z',
            product: 'practice',
            account_id: 'u1',
            // `to` объявлено и перечислимо; значение вне списка — как раз то,
            // ради чего отладка и нужна, и его надо видеть.
            props: { surface: 'android', to: 'выдуманный_статус', delivered: true },
            schema_version: 1,
        });
        expect(JSON.stringify(rejected[0].payload)).toContain('выдуманный_статус');
    });
});
