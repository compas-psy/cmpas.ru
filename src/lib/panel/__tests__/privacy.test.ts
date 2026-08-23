/**
 * Приватность панели (ТЗ §8).
 *
 * На панель не попадает НИЧЕГО из содержимого: ни имён людей, ни заголовков
 * заметок, ни путей к файлам, ни текстов обращений, ни адресов почты, ни
 * идентификаторов клиентов психолога. Только агрегаты, числа и темы из
 * закрытого словаря.
 *
 * Четыре теста ниже — не декларация, а тот механизм, который не даст этому
 * измениться незаметно.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const QUERIES = path.join(ROOT, 'queries');
const BUILD = path.join(ROOT, 'build');

/** Поля, которых не должно быть в ответе панели ни на какой глубине. */
const FORBIDDEN_KEYS = ['email', 'name', 'phone', 'title', 'path', 'content', 'text', 'clientName'];

/** Поля бизнес-таблиц, которые панели запрещено выбирать из базы. */
const FORBIDDEN_SELECTS = [
    'email',
    'phone',
    'notes',
    'structuredNotes',
    'privateNotes',
    'clientSummary',
    'content',
    'subject',
    'errorMsg',
    'userAgent',
    'ip',
    'referrer',
    'currentUrl',
    'telegramUsername',
    'consentHash',
    'fingerprintComponents',
];

function readAllSources(dir: string): { file: string; text: string }[] {
    const out: { file: string; text: string }[] = [];
    for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
            out.push(...readAllSources(full));
            continue;
        }
        if (!entry.endsWith('.ts')) continue;
        out.push({ file: full, text: readFileSync(full, 'utf8') });
    }
    return out;
}

/** Собирает все ключи объекта на любой глубине. */
function collectKeys(value: unknown, acc: Set<string> = new Set()): Set<string> {
    if (Array.isArray(value)) {
        value.forEach((v) => collectKeys(v, acc));
        return acc;
    }
    if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) {
            acc.add(k);
            collectKeys(v, acc);
        }
    }
    return acc;
}

/** Собирает все строковые значения на любой глубине. */
function collectStrings(value: unknown, acc: string[] = []): string[] {
    if (typeof value === 'string') {
        acc.push(value);
        return acc;
    }
    if (Array.isArray(value)) {
        value.forEach((v) => collectStrings(v, acc));
        return acc;
    }
    if (value && typeof value === 'object') {
        Object.values(value).forEach((v) => collectStrings(v, acc));
    }
    return acc;
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(?:\+7|8)[\s(-]?\d{3}[\s)-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/;
const FILE_PATH_RE = /(?:^|\s)(?:\/(?:home|var|etc|usr|root|srv|opt|mnt)\/|[A-Za-z]:\\)/;

/**
 * Форма ответа экрана, собранная из настоящих запросов, но без базы:
 * тесты проверяют КОНТРАКТ ответа, а не конкретные числа, поэтому берут
 * состояния `no_data`, в которых поля данных заведомо пусты, плюс
 * синтетические `ok`-блоки той же формы, что отдаёт продакшн.
 */
async function samplePayloads(): Promise<Record<string, unknown>[]> {
    const products = await import('../queries/products');
    const funnel = await import('../queries/funnel');
    const retention = await import('../queries/retention');
    const tech = await import('../queries/tech');

    return [
        {
            zapiskiNsm: await products.qZapiskiNsm(),
            zapiskiWriters: await products.qZapiskiWriters(),
            zapiskiNotesPerSession: await products.qZapiskiNotesPerSession(),
            zapiskiSyncs: await products.qZapiskiSyncs(),
            zapiskiConflicts: await products.qZapiskiConflicts(),
            zapiskiSupport: await products.qZapiskiSupport(),
        },
        {
            momentyNsm: await products.qMomentyNsm(),
            momentyInstalls: await products.qMomentyInstalls(),
            momentyD1: await products.qMomentyD1(),
            momentyD7: await products.qMomentyD7(),
            momentyD30: await products.qMomentyD30(),
        },
        { bookingAuthor: await products.qPracticeBookingAuthor(), reminders: await products.qPracticeReminders() },
        { sources: await funnel.qSources() },
        { momenty: await retention.qRetentionMomenty(), churnReasons: await retention.qChurnReasons() },
        {
            responseP95: await tech.qTechResponseP95(),
            zapiskiStorage: await tech.qTechZapiskiStorage(),
            appVersion: await tech.qTechAppVersion(),
        },
    ];
}

describe('приватность панели', () => {
    it('1. в ответе нет запрещённых полей ни на какой глубине', async () => {
        for (const payload of await samplePayloads()) {
            const keys = collectKeys(payload);
            for (const forbidden of FORBIDDEN_KEYS) {
                expect(keys.has(forbidden), `в ответе встретилось поле «${forbidden}»`).toBe(false);
            }
        }
    });

    it('2. в ответе нет строк, похожих на почту, телефон или путь к файлу', async () => {
        for (const payload of await samplePayloads()) {
            for (const str of collectStrings(payload)) {
                expect(EMAIL_RE.test(str), `похоже на адрес почты: ${str}`).toBe(false);
                expect(PHONE_RE.test(str), `похоже на телефон: ${str}`).toBe(false);
                expect(FILE_PATH_RE.test(str), `похоже на путь к файлу: ${str}`).toBe(false);
            }
        }
    });

    it('3. ни один запрос панели не выбирает из базы поля с содержимым', () => {
        const sources = [...readAllSources(QUERIES), ...readAllSources(BUILD)];
        expect(sources.length).toBeGreaterThan(0);

        for (const { file, text } of sources) {
            // Ищем содержимое каждого select-блока и проверяем его ключи.
            const selects = [...text.matchAll(/select:\s*\{([^}]*)\}/g)];
            for (const match of selects) {
                const body = match[1];
                for (const forbidden of FORBIDDEN_SELECTS) {
                    const keyRe = new RegExp(`(^|[\\s,{])${forbidden}\\s*:\\s*true`, 'm');
                    expect(
                        keyRe.test(body),
                        `${path.relative(ROOT, file)}: запрос выбирает запрещённое поле «${forbidden}»`,
                    ).toBe(false);
                }
            }
        }
    });

    it('3b. ни один запрос не читает таблицу целиком без select', () => {
        // Именно так на панель уехал свободный текст `DeployLog.errorNote`:
        // findMany без select отдаёт все колонки, включая те, что появятся
        // в таблице позже. Разрешены только таблицы без свободного текста.
        const WHITELIST = ['systemConfig'];

        for (const { file, text } of readAllSources(QUERIES)) {
            const calls = [...text.matchAll(/db\.(\w+)\.findMany\(\{([\s\S]{0,400}?)\}\)/g)];
            for (const [, model, body] of calls) {
                if (WHITELIST.includes(model)) continue;
                expect(
                    body.includes('select:'),
                    `${path.relative(ROOT, file)}: db.${model}.findMany без select — вернёт все колонки таблицы`,
                ).toBe(true);
            }
        }
    });

    it('4. темы обращений берутся из закрытого словаря, произвольная строка не проходит', async () => {
        const { SUPPORT_TOPICS, isSupportTopic } = await import('../topics');

        expect(SUPPORT_TOPICS.length).toBeGreaterThan(0);
        for (const topic of SUPPORT_TOPICS) {
            expect(isSupportTopic(topic)).toBe(true);
        }

        for (const rubbish of ['не могу войти, помогите', 'Иванов И.И.', '', 'синхронизация', 'ЛЮБАЯ СТРОКА']) {
            expect(isSupportTopic(rubbish), `произвольная строка «${rubbish}» прошла как тема`).toBe(false);
        }
    });
});
