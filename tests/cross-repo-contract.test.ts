// Стык контура: конверты ЗАПИСОК и МОМЕНТОВ против НАСТОЯЩЕГО приёмника.
//
// Зачем этот файл существует. Три продукта чинились параллельно, и каждый
// проверял себя против собственного представления о другой стороне: ЗАПИСКИ
// — против смоделированного приёмника, МОМЕНТЫ — чтением кода (Gradle в
// песочнице не поднимается). Оба представления оказались неверны, и обе
// поломки были невидимы изнутри своего репозитория: мост слал заголовок
// `x-simpas-ingest-secret` вместо `Authorization: Bearer`, а `consent_updated`
// был объявлен принадлежащим одной ПРАКТИКЕ — из-за чего ни одно событие
// устройства без аккаунта не могло быть принято никогда. Зелёные тесты в
// трёх репозиториях этого не ловили. Этот файл ловит.
//
// Происхождение данных — честно, потому что доверие к тесту стоит ровно
// столько, сколько происхождение его входа:
//  - tests/fixtures/cross-repo/zapiski-envelopes.json — СГЕНЕРИРОВАН
//    запуском настоящей функции `envelopeFor` из
//    zapiski/server/src/services/practiceBridge.ts (ветка
//    feature/analytics-contract-e, 23.08.2026). Не написан руками.
//  - tests/fixtures/cross-repo/moments-envelopes.json — ВЫВЕДЕН ЧТЕНИЕМ
//    `buildAnalyticsEvent` из compas-voice/.../analytics/AnalyticsSchema.kt
//    (та же дата). Запустить Kotlin в этой среде нельзя: прокси не пускает
//    к Maven и Gradle Plugin Portal. Это слабее сгенерированного и названо
//    слабее намеренно: при правке AnalyticsSchema.kt фикстуру обязан
//    обновить тот, кто её правит.
//
// Порядок событий в фикстурах не случаен: `consent_updated` идёт первым,
// потому что контракт контура v2 §5 требует именно этого — до согласия
// субъекта приёмник обязан отвергать всё остальное.

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { processIngestEvent } from '@/lib/analytics/ingest';
import { validateEvent } from '@/lib/analytics/schema';

type Db = Parameters<typeof processIngestEvent>[0];
interface EventRecord { event: string; product: string; accountId: string | null; deviceId: string | null; eventId: string | null; [key: string]: unknown }
interface RejectedRecord { reason: string; payload: unknown }

function makeDb() {
    const events: EventRecord[] = [];
    const rejected: RejectedRecord[] = [];
    const deviceConsents = new Map<string, { deviceId: string; consentAt: Date | null }>();
    let userLookups = 0;

    const db: Db = {
        analyticsEvent: {
            create: (async ({ data }: { data: EventRecord }) => { events.push(data); return data; }) as Db['analyticsEvent']['create'],
            findUnique: (async ({ where }: { where: { eventId: string } }) =>
                events.find((e) => e.eventId === where.eventId) ?? null) as Db['analyticsEvent']['findUnique'],
        },
        analyticsEventRejected: {
            create: (async ({ data }: { data: RejectedRecord }) => { rejected.push(data); return data; }) as Db['analyticsEventRejected']['create'],
        },
        user: {
            // Ни одно событие чужого продукта не имеет права сюда попасть:
            // у ПРАКТИКИ нет таблицы пользователей ЗАПИСОК и МОМЕНТОВ.
            findUnique: (async () => { userLookups += 1; return null; }) as Db['user']['findUnique'],
            update: (async () => null) as Db['user']['update'],
        },
        analyticsDeviceConsent: {
            findUnique: (async ({ where }: { where: { deviceId: string } }) => deviceConsents.get(where.deviceId) ?? null) as Db['analyticsDeviceConsent']['findUnique'],
            upsert: (async ({ where, create, update }: { where: { deviceId: string }; create: { deviceId: string; consentAt: Date | null }; update: { consentAt: Date | null } }) => {
                const next = { ...(deviceConsents.get(where.deviceId) ?? create), ...update };
                deviceConsents.set(where.deviceId, next);
                return next;
            }) as Db['analyticsDeviceConsent']['upsert'],
        },
    } as Db;

    return { db, events, rejected, deviceConsents, userLookups: () => userLookups };
}

function fixture(name: string): Record<string, unknown>[] {
    const file = path.join(__dirname, 'fixtures', 'cross-repo', name);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

describe('стык контура: чужой продукт → POST /ingest', () => {
    it('конверт ЗАПИСОК, собранный их собственным кодом, проходит валидатор ПРАКТИКИ', () => {
        for (const envelope of fixture('zapiski-envelopes.json')) {
            const verdict = validateEvent(envelope);
            expect(verdict.valid, `${String(envelope.event)}: ${verdict.valid ? '' : verdict.reason}`).toBe(true);
        }
    });

    it('конверт МОМЕНТОВ проходит валидатор ПРАКТИКИ', () => {
        for (const envelope of fixture('moments-envelopes.json')) {
            const verdict = validateEvent(envelope);
            expect(verdict.valid, `${String(envelope.event)}: ${verdict.valid ? '' : verdict.reason}`).toBe(true);
        }
    });

    it('пачка ЗАПИСОК доезжает до events: согласие первым, дальше содержательные', async () => {
        const { db, events, rejected, userLookups } = makeDb();
        for (const envelope of fixture('zapiski-envelopes.json')) {
            await processIngestEvent(db, envelope);
        }
        // zap-user-77 дал согласие первым событием — три его события приняты.
        const accepted77 = events.filter((e) => e.accountId === 'zap-user-77');
        expect(accepted77.map((e) => e.event)).toEqual(['consent_updated', 'note_saved', 'export_requested']);
        // zap-user-88 согласия не давал — его событие отвергнуто, а не записано.
        expect(events.some((e) => e.accountId === 'zap-user-88')).toBe(false);
        expect(rejected).toHaveLength(1);
        expect(String(rejected[0].reason)).toContain('consent');
        // Чужой account_id не ищется в User ПРАКТИКИ ни разу.
        expect(userLookups()).toBe(0);
    });

    it('пачка МОМЕНТОВ доезжает до events целиком', async () => {
        const { db, events, rejected, userLookups } = makeDb();
        for (const envelope of fixture('moments-envelopes.json')) {
            await processIngestEvent(db, envelope);
        }
        expect(events.map((e) => e.event)).toEqual(['consent_updated', 'app_installed', 'practice_started', 'practice_finished']);
        expect(rejected).toHaveLength(0);
        expect(userLookups()).toBe(0);
        expect(events.every((e) => e.product === 'moments' && e.deviceId === 'moments-device-42')).toBe(true);
    });

    it('без согласия впереди не проезжает ничего — порядок в пачке значим', async () => {
        const { db, events, rejected } = makeDb();
        const [consent, ...rest] = fixture('moments-envelopes.json');
        for (const envelope of rest) await processIngestEvent(db, envelope);
        expect(events).toHaveLength(0);
        expect(rejected).toHaveLength(rest.length);
        // а после согласия — те же события проходят
        await processIngestEvent(db, consent);
        for (const envelope of rest) await processIngestEvent(db, envelope);
        expect(events.map((e) => e.event)).toEqual(['consent_updated', 'app_installed', 'practice_started', 'practice_finished']);
    });

    it('согласие одного продукта не открывает ворота другому с тем же идентификатором', async () => {
        const { db, events, rejected } = makeDb();
        const [momentsConsent] = fixture('moments-envelopes.json');
        await processIngestEvent(db, momentsConsent);
        // ЗАПИСКИ с account_id, буквально равным device_id МОМЕНТОВ.
        const zapiski = { ...fixture('zapiski-envelopes.json')[1], account_id: 'moments-device-42', event_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' };
        const result = await processIngestEvent(db, zapiski);
        expect(result.accepted).toBe(false);
        expect(events).toHaveLength(1);
        expect(rejected).toHaveLength(1);
    });

    it('отзыв согласия закрывает ворота обратно', async () => {
        const { db, events } = makeDb();
        const envelopes = fixture('moments-envelopes.json');
        await processIngestEvent(db, envelopes[0]);
        await processIngestEvent(db, envelopes[1]);
        const revoke = { ...envelopes[0], props: { granted: false }, event_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' };
        await processIngestEvent(db, revoke);
        const before = events.length;
        await processIngestEvent(db, { ...envelopes[2], event_id: '99999999-9999-4999-8999-999999999999' });
        expect(events).toHaveLength(before);
    });

    it('повтор доставки той же пачки не задваивает строки', async () => {
        const { db, events } = makeDb();
        const envelopes = fixture('moments-envelopes.json');
        for (const envelope of envelopes) await processIngestEvent(db, envelope);
        const afterFirst = events.length;
        for (const envelope of envelopes) await processIngestEvent(db, envelope);
        expect(events).toHaveLength(afterFirst);
    });
});
