// Стык приложения и приёмника: НАСТОЯЩИЙ конверт против НАСТОЯЩЕГО валидатора.
//
// Почему этот файл выглядит иначе, чем остальные тесты. В репозитории уже есть
// tests/cross-repo-contract.test.ts, и он сам про себя честно пишет, что
// фикстура МОМЕНТОВ «ВЫВЕДЕНА ЧТЕНИЕМ» кода Kotlin, потому что Gradle в той
// среде не поднимался. Такая фикстура проверяет представление автора о
// собственном коде, а не сам код: обе стороны могут ошибаться одинаково и не
// заметить этого никогда — ровно так и вышло у МОМЕНТОВ, где клиент не слал
// заголовок Authorization вовсе, а зелёные тесты в трёх репозиториях этого не
// поймали.
//
// Здесь фикстура не написана руками. Её ПРОИЗВОДИТ на прогоне CI настоящий
// AnalyticsRecorder приложения (android/.../AnalyticsEnvelopeFixtureTest.kt) —
// тот самый код, который зовут экраны, — а шаг workflow кладёт результат в
// tests/fixtures/android/. Дальше конверт идёт через НАСТОЯЩИЙ обработчик
// POST /api/mobile/analytics и через НАСТОЯЩИЙ validateEvent с НАСТОЯЩИМ
// реестром analytics/schema/events.yaml.
//
// Отсутствие фикстуры — провал, а не пропуск. Тест, который молча ничего не
// проверил, выглядит зелёным ровно так же, как выполненный.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const FIXTURE = path.join(process.cwd(), 'tests/fixtures/android/practice-android-envelopes.json');

const written: any[] = [];
const rejected: any[] = [];

vi.mock('@/lib/mobile-auth', () => ({
    authenticateMobileRequest: async () => ({ userId: 'psy-1' }),
    unauthorizedResponse: () => new Response('unauthorized', { status: 401 }),
}));

// Подменена только база — валидатор, реестр и сам обработчик настоящие.
vi.mock('@/lib/db', () => ({
    db: {
        user: { findUnique: async () => ({ id: 'psy-1', analyticsConsentAt: new Date('2026-08-01T00:00:00Z') }) },
        analyticsEvent: {
            create: async ({ data }: any) => { written.push(data); return data; },
            findUnique: async () => null,
        },
        analyticsEventRejected: { create: async ({ data }: any) => { rejected.push(data); return data; } },
        analyticsDeviceConsent: { findUnique: async () => null, upsert: async () => ({}) },
    },
}));

function readFixture(): any[] {
    if (!fs.existsSync(FIXTURE)) {
        throw new Error(
            `Конверт приложения не выложен: ${FIXTURE} отсутствует.\n` +
            'Его пишет AnalyticsEnvelopeFixtureTest на прогоне тестов Android, а шаг ' +
            '«Проверить конверт аналитики против приёмника» копирует сюда. Без файла ' +
            'этот тест не проверяет ничего — поэтому он падает, а не пропускается.',
        );
    }
    const parsed = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error(`Конверт приложения пуст: ${FIXTURE}`);
    }
    return parsed;
}

describe('конверт приложения проходит настоящий приёмник', () => {
    beforeEach(() => {
        written.length = 0;
        rejected.length = 0;
        vi.resetModules();
    });

    it('все семь событий принимаются без единого отказа', async () => {
        const envelopes = readFixture();
        const { POST } = await import('../src/app/api/mobile/analytics/route');

        const res = await POST(new Request('https://cmpas.ru/api/mobile/analytics', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
            body: JSON.stringify(envelopes),
        }) as any);

        const body = await res.json();
        const refusals = body.results
            .map((r: any, i: number) => ({ event: envelopes[i]?.event, ...r }))
            .filter((r: any) => !r.accepted);

        expect(
            refusals,
            `приёмник отверг конверты приложения: ${JSON.stringify(refusals, null, 2)}`,
        ).toEqual([]);
        expect(body.results).toHaveLength(envelopes.length);
        expect(written).toHaveLength(envelopes.length);
        expect(rejected).toEqual([]);
    });

    it('в записанное не попадает ничего сверх того, что прислало приложение', async () => {
        const envelopes = readFixture();
        const { POST } = await import('../src/app/api/mobile/analytics/route');

        await POST(new Request('https://cmpas.ru/api/mobile/analytics', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
            body: JSON.stringify(envelopes),
        }) as any);

        for (const row of written) {
            // account_id подставляет сервер из токена, а не клиент.
            expect(row.accountId).toBe('psy-1');
            // device_id не отправляется вовсе (решение учредителя 4).
            expect(row.deviceId).toBeNull();
            expect(row.product).toBe('practice');
        }
    });

    it('конверт покрывает все семь событий, а не одно удобное', async () => {
        const envelopes = readFixture();
        const names = new Set(envelopes.map((e: any) => e.event));
        expect(names).toEqual(new Set([
            'app_opened',
            'session_created',
            'session_status_changed',
            'session_note_saved',
            'session_note_abandoned',
            'client_created',
            'client_invite_created',
        ]));
    });
});
