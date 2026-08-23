// Core POST /ingest processing (charter/12_ANALYTICS.md §3), kept separate
// from the route handler so it's testable against a mocked Prisma client.
//
// account_id means different things depending on `product` (E2, контракт
// контура v2 п.5):
//   - product === 'practice': account_id IS User.id — cmpas.ru has no
//     separate cross-product pseudonym table yet (charter/12_ANALYTICS.md
//     §2 describes one; building it is out of scope here, Ф1 is
//     per-product). Consent lives on User.analyticsConsentAt. Unchanged.
//   - product is 'zapiski' or 'moments': ПРАКТИКА has no table of their
//     users at all — их account_id NEVER means a row in `User` and is
//     NEVER looked up there or rejected as "unknown account_id". The
//     subject is the pair (product, account_id ?? device_id), namespaced
//     as `${product}:${account_id ?? device_id}` so a ЗАПИСКИ id can never
//     collide with a same-valued МОМЕНТЫ id or a ПРАКТИКА User.id. Consent
//     for that subject lives in AnalyticsDeviceConsent, keyed by that same
//     namespaced string in the `deviceId` column — for this path the
//     column holds a subject key, not necessarily a physical device
//     identifier. See the model comment in prisma/schema.prisma.
//
// O-260817-13: a device without an account (МОМЕНТЫ has none, ЗАПИСКИ has no
// production login yet) may send device_id in place of account_id. For
// practice this still uses the raw device_id as the AnalyticsDeviceConsent
// key (unchanged, unprefixed — no migration of existing rows). Its consent
// is independent of User.analyticsConsentAt — when identity_linked later
// ties the device to an account, past rows are not rewritten; joining them
// is a mart-layer concern.

import type { Prisma, PrismaClient } from '@prisma/client';
import { validateEvent, loadRegistry, RawEvent } from './schema';
import { isRateLimited, defaultRateLimitStore } from './rate-limit';

type Db = Pick<PrismaClient, 'analyticsEvent' | 'analyticsEventRejected' | 'user' | 'analyticsDeviceConsent'>;

export type IngestResult =
    | { accepted: true }
    | { accepted: false; reason: string };

/** Наибольшая пачка, которую примет POST /ingest за один запрос (O-260817-17). */
export const MAX_INGEST_BATCH_SIZE = 200;

/**
 * Что именно ложится в events_rejected.
 *
 * Раньше туда писался исходный конверт целиком (`payload: raw`). Строгая
 * типизация props защищала только таблицу ПРИНЯТЫХ событий; у таблицы
 * отвергнутых защиты не было вовсе — и обладатель валидного токена одним
 * намеренно неправильным конвертом клал в базу произвольный текст: например,
 * содержание заметки о клиенте, без ограничения размера. Клиент — не граница
 * доверия, границей является сервер, и здесь она отсутствовала.
 *
 * Что остаётся. Структурные поля конверта — по ним видно, кто и что прислал.
 * Значения ОБЪЯВЛЕННЫХ для этого события свойств — они по построению
 * перечислимы, булевы или числа, свободного текста среди них нет, а видеть их
 * необходимо: неверное значение перечисления и есть самый частый повод для
 * отладки. Имена НЕЗАЯВЛЕННЫХ свойств сохраняются усечёнными до 32 символов —
 * их достаточно, чтобы понять, что прислал клиент, и мало, чтобы пронести
 * содержание; значения незаявленных свойств не сохраняются вовсе, только их
 * тип.
 */
function rejectedPayload(raw: RawEvent): Record<string, unknown> {
    const base: Record<string, unknown> = {
        event: typeof raw.event === 'string' ? raw.event.slice(0, 64) : typeof raw.event,
        ts: typeof raw.ts === 'string' ? raw.ts.slice(0, 40) : typeof raw.ts,
        product: typeof raw.product === 'string' ? raw.product.slice(0, 32) : typeof raw.product,
        account_id: raw.account_id ? 'есть' : null,
        device_id: raw.device_id ? 'есть' : null,
        schema_version: typeof raw.schema_version === 'number' ? raw.schema_version : typeof raw.schema_version,
        event_id: typeof raw.event_id === 'string' ? raw.event_id.slice(0, 64) : null,
    };

    if (raw.props === null || raw.props === undefined) {
        base.props = raw.props === null ? null : undefined;
        return base;
    }
    if (typeof raw.props !== 'object' || Array.isArray(raw.props)) {
        // Сам факт «props не объект» — это и есть причина отказа; значение
        // сюда не переносим, потому что именно им и проносили текст.
        base.props_type = Array.isArray(raw.props) ? 'array' : typeof raw.props;
        return base;
    }

    const declared = new Set<string>();
    const def = typeof raw.event === 'string' ? loadRegistry().events[raw.event] : undefined;
    if (def) {
        for (const key of def.required) declared.add(key);
        for (const key of def.optional) declared.add(key);
    }

    const props: Record<string, unknown> = {};
    let extra = 0;
    for (const [key, value] of Object.entries(raw.props as Record<string, unknown>)) {
        if (declared.has(key)) {
            // Объявленное свойство: значение видно, но только если оно
            // примитив — вложенный объект под знакомым именем это попытка
            // пронести содержание, а не отладочные данные.
            props[key] = (typeof value === 'object' && value !== null) ? `[${Array.isArray(value) ? 'array' : 'object'}]` : value;
        } else {
            if (extra >= 10) continue;
            extra += 1;
            // Усечения имени недостаточно: имя свойства само может быть
            // текстом («клиент рассказал про...»), и первые же его символы
            // пронесут содержание. Поэтому имя сохраняется, только если оно
            // ВЫГЛЯДИТ как имя свойства — короткий snake_case из латиницы.
            // Настоящая ошибка клиента («note_length», «clientId») этому
            // виду отвечает; произвольный текст — нет.
            const looksLikePropName = /^[a-z][a-z0-9_]{0,31}$/i.test(key);
            const label = looksLikePropName ? key : `поле №${extra}`;
            props[`${label} (не объявлено)`] = `[${typeof value}]`;
        }
    }
    base.props = props;
    return base;
}

export async function processIngestEvent(
    db: Db,
    raw: RawEvent,
    now: Date = new Date(),
    rateLimitStore: Map<string, number[]> = defaultRateLimitStore,
    /**
     * Разрешён ли предъявленному секрету этот продукт (см.
     * src/lib/analytics/secrets.ts). По умолчанию — разрешено всё: так
     * существующие вызовы и тесты, которые про привязку ничего не знают,
     * ведут себя ровно как раньше. Маршрут передаёт настоящую проверку.
     */
    productAllowed: (product: string) => boolean = () => true,
): Promise<IngestResult> {
    const validation = validateEvent(raw);
    if (!validation.valid) {
        await db.analyticsEventRejected.create({
            data: { reason: validation.reason, payload: rejectedPayload(raw) },
        });
        return { accepted: false, reason: validation.reason };
    }

    // Привязка секрет→продукт сверяется ПОСЛЕ проверки конверта: испорченный
    // конверт обязан получать «неверный конверт», а не «не тот продукт» —
    // иначе причина отказа зависела бы от того, чей секрет предъявлен, и
    // отладка чужой стороны превращалась бы в угадайку.
    if (!productAllowed(raw.product as string)) {
        const reason = `secret not allowed for product ${raw.product}`;
        await db.analyticsEventRejected.create({
            data: { reason, payload: rejectedPayload(raw) },
        });
        return { accepted: false, reason };
    }

    // Идемпотентность (O-260817-17): event_id необязателен — без него
    // поведение не меняется вовсе, findUnique даже не вызывается. С ним
    // повтор той же отправки (например, ретрай клиента после таймаута
    // ответа) не создаёт вторую строку и не повторяет побочные эффекты
    // события (скажем, consent_updated не переигрывает согласие на новое
    // время) — просто честно отвечает "принято", как и в первый раз.
    const eventId = typeof raw.event_id === 'string' && raw.event_id ? raw.event_id : null;
    if (eventId) {
        const existing = await db.analyticsEvent.findUnique({ where: { eventId } });
        if (existing) return { accepted: true };
    }

    const accountId = (raw.account_id ?? null) as string | null;
    const deviceId = (raw.device_id ?? null) as string | null;
    const product = raw.product as string;

    // E3 (контракт контура v2 п.7): rate limit is keyed by the same subject
    // consent is gated on, not raw device_id — otherwise an account_id-only
    // submission (no device_id at all, e.g. ЗАПИСКИ pre-fingerprint) was
    // never limited at all, for any product including practice.
    const subjectKey = subjectKeyFor(product, accountId, deviceId);
    if (isRateLimited(subjectKey, now.getTime(), rateLimitStore)) {
        return { accepted: false, reason: 'rate limited' };
    }

    const event = raw.event as string;
    const props = (raw.props ?? {}) as Record<string, unknown>;

    if (product !== 'practice') {
        // E2: ЗАПИСКИ/МОМЕНТЫ never touch `User` — see file header.
        return writeForeignProductEvent(db, raw, product, accountId, deviceId, subjectKey, event, props, now, eventId);
    }
    if (accountId) {
        return writeAccountEvent(db, raw, accountId, deviceId, event, props, now, eventId);
    }
    return writeDeviceOnlyEvent(db, raw, deviceId as string, event, props, now, eventId);
}

/**
 * Ключ субъекта для гейта согласия и для ограничения частоты (E2/E3,
 * контракт контура v2 п.5, п.7). Для ПРАКТИКИ — как раньше: User.id, если
 * есть, иначе сырой device_id (без префикса — не мигрируем существующие
 * строки AnalyticsDeviceConsent). Для ЗАПИСОК/МОМЕНТОВ — всегда с префиксом
 * продукта, чтобы одинаковый account_id/device_id разных продуктов (или
 * совпавший с ПРАКТИКА User.id) не делил один субъект.
 */
function subjectKeyFor(product: string, accountId: string | null, deviceId: string | null): string {
    const raw = (accountId ?? deviceId) as string; // validateEvent уже гарантировал, что хотя бы одно задано
    return product === 'practice' ? raw : `${product}:${raw}`;
}

async function writeAccountEvent(
    db: Db,
    raw: RawEvent,
    accountId: string,
    deviceId: string | null,
    event: string,
    props: Record<string, unknown>,
    now: Date,
    eventId: string | null,
): Promise<IngestResult> {
    const user = await db.user.findUnique({ where: { id: accountId }, select: { id: true, analyticsConsentAt: true } });
    if (!user) {
        await db.analyticsEventRejected.create({
            data: { reason: 'unknown account_id', payload: rejectedPayload(raw) },
        });
        return { accepted: false, reason: 'unknown account_id' };
    }

    let consentGiven = user.analyticsConsentAt !== null;

    if (event === 'consent_updated') {
        const granted = props.granted === true;
        await db.user.update({ where: { id: accountId }, data: { analyticsConsentAt: granted ? now : null } });
        consentGiven = granted;
    }

    // Rule: no device_id is written to `events` before consent is on file
    // (checked *after* this event's own consent_updated is applied, so the
    // granting event itself can carry its device_id).
    await db.analyticsEvent.create({
        data: {
            event,
            ts: new Date(raw.ts as string),
            product: raw.product as string,
            accountId,
            deviceId: consentGiven ? deviceId : null,
            props: props as Prisma.InputJsonValue,
            schemaVersion: raw.schema_version as number,
            eventId,
        },
    });

    return { accepted: true };
}

async function writeDeviceOnlyEvent(
    db: Db,
    raw: RawEvent,
    deviceId: string,
    event: string,
    props: Record<string, unknown>,
    now: Date,
    eventId: string | null,
): Promise<IngestResult> {
    const existing = await db.analyticsDeviceConsent.findUnique({ where: { deviceId } });
    let consentGiven = existing?.consentAt != null;

    if (event === 'consent_updated') {
        const granted = props.granted === true;
        await db.analyticsDeviceConsent.upsert({
            where: { deviceId },
            create: { deviceId, consentAt: granted ? now : null },
            update: { consentAt: granted ? now : null },
        });
        consentGiven = granted;
    }

    // No account to fall back on: without consent there is nothing lawful
    // to record for this device at all, unlike the account path where the
    // event is still written with device_id stripped.
    if (!consentGiven) {
        await db.analyticsEventRejected.create({
            data: { reason: 'consent required for a device without an account', payload: rejectedPayload(raw) },
        });
        return { accepted: false, reason: 'consent required for a device without an account' };
    }

    await db.analyticsEvent.create({
        data: {
            event,
            ts: new Date(raw.ts as string),
            product: raw.product as string,
            accountId: null,
            deviceId,
            props: props as Prisma.InputJsonValue,
            schemaVersion: raw.schema_version as number,
            eventId,
        },
    });

    return { accepted: true };
}

/**
 * ЗАПИСКИ/МОМЕНТЫ (E2, контракт контура v2 п.5): ПРАКТИКА не хранит их
 * пользователей, поэтому `User` здесь не участвует вовсе — ни для
 * account_id (никогда не ищется, никогда не отвергается как "unknown
 * account_id"), ни для согласия. Субъект — `subjectKey`
 * (`${product}:${account_id ?? device_id}`, см. subjectKeyFor), согласие —
 * в AnalyticsDeviceConsent под этим ключом, тем же путём, что и
 * device-only-путь ПРАКТИКИ (writeDeviceOnlyEvent), только с изолирующим
 * префиксом продукта. account_id пишется в AnalyticsEvent как есть — без
 * него отличить "чей" это аккаунт можно только по колонке product.
 */
async function writeForeignProductEvent(
    db: Db,
    raw: RawEvent,
    product: string,
    accountId: string | null,
    deviceId: string | null,
    subjectKey: string,
    event: string,
    props: Record<string, unknown>,
    now: Date,
    eventId: string | null,
): Promise<IngestResult> {
    const existing = await db.analyticsDeviceConsent.findUnique({ where: { deviceId: subjectKey } });
    let consentGiven = existing?.consentAt != null;

    if (event === 'consent_updated') {
        const granted = props.granted === true;
        await db.analyticsDeviceConsent.upsert({
            where: { deviceId: subjectKey },
            create: { deviceId: subjectKey, consentAt: granted ? now : null },
            update: { consentAt: granted ? now : null },
        });
        consentGiven = granted;
    }

    // Красная линия не сдвигается: без согласия этого субъекта нет
    // законного аккаунта, на который можно списать событие (тот же принцип,
    // что у writeDeviceOnlyEvent) — отказ целиком, а не запись с усечённым
    // device_id.
    if (!consentGiven) {
        const reason = `consent required for ${product} subject (no consent on file)`;
        await db.analyticsEventRejected.create({ data: { reason, payload: rejectedPayload(raw) } });
        return { accepted: false, reason };
    }

    await db.analyticsEvent.create({
        data: {
            event,
            ts: new Date(raw.ts as string),
            product,
            accountId,
            deviceId,
            props: props as Prisma.InputJsonValue,
            schemaVersion: raw.schema_version as number,
            eventId,
        },
    });

    return { accepted: true };
}
