import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { isAccessRevoked, looksLikeAccessRevoked } from '@/lib/calendar/health';
import { blogPosts } from '@/lib/blog-data';

/**
 * ОТКАЗ, КОТОРОГО НЕ ВИДНО, — И СТОРОЖ, КОТОРОГО НЕ БЫЛО.
 *
 * Шаги 5 и 6 книги «Витрина и машинное отделение»: Ф10, Ф15, Ф14, Ф7.
 *
 * Ф10. Провайдер отзывает доступ — выгрузка встреч прекращается, отказ
 * уходит в журнал и дальше журнала не идёт. Подключение остаётся помеченным
 * рабочим, на экране горит «Подключён», специалист верит, что его встречи в
 * календаре.
 *
 * Ф15. За подпиской MAX не следил никто: она ставилась один раз при запуске.
 * У Telegram сторож есть, и написан он после живого отвала.
 *
 * Ф14. Ответ MAX печатался в журнал целиком — вместе с тем, что мы в нём не
 * выбирали.
 */

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf-8');

/** Только код: объяснение дефекта рядом не должно подтверждать само себя. */
const code = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('Ф10 · сломанное подключение различается от моргнувшей сети', () => {
    it('отзыв доступа — единственное, о чём говорят человеку', () => {
        expect(isAccessRevoked('PROVIDER_AUTH')).toBe(true);
        for (const code of ['PROVIDER_TIMEOUT', 'PROVIDER_UNREACHABLE', 'PROVIDER_ERROR'] as const) {
            // Эти проходят сами. Пугать ими — значит научить человека не
            // верить отметке.
            expect(isAccessRevoked(code)).toBe(false);
        }
    });

    it('узнаёт отказ провайдера по коду ответа', () => {
        expect(looksLikeAccessRevoked(401)).toBe(true);
        expect(looksLikeAccessRevoked(403)).toBe(true);
        expect(looksLikeAccessRevoked(500)).toBe(false);
        expect(looksLikeAccessRevoked(200)).toBe(false);
    });

    it('и по тем словам, которыми отвечают Google и CalDAV на деле', () => {
        // Проверка написана по настоящим ответам провайдеров, а не по тому,
        // что удобно реализации: отозванный refresh-токен, протухший
        // access-токен и отказ CalDAV выглядят по-разному.
        expect(looksLikeAccessRevoked(null, 'Failed to refresh token: invalid_grant')).toBe(true);
        expect(looksLikeAccessRevoked(null, 'Google API error: {"error":{"code":401,"message":"Request had invalid authentication credentials"}}')).toBe(true);
        expect(looksLikeAccessRevoked(null, '401 Unauthorized')).toBe(true);
        expect(looksLikeAccessRevoked(null, 'ETIMEDOUT')).toBe(false);
        expect(looksLikeAccessRevoked(null, 'Google API error: event 401abc not found')).toBe(false);
    });

    it('самый частый способ поломки — отозванный refresh-токен — различим', () => {
        // Раньше и отзыв, и упавшая сеть приходили одним сообщением
        // «Failed to refresh token», и отличить их было нельзя.
        const google = readFileSync(join(__dirname, '..', 'src/lib/calendar/google.ts'), 'utf-8');
        expect(google).toContain('invalid_grant');
        expect(looksLikeAccessRevoked(null, 'Failed to refresh token')).toBe(false);
    });
});

describe('Ф10 · отметка ставится там, где отказ и случается', () => {
    const sync = code(read('src/lib/calendar/auto-sync.ts'));

    it('синхронизация зовёт модуль состояния', () => {
        expect(sync).toContain("@/lib/calendar/health");
        expect(sync).toContain('markCalendarBroken');
        expect(sync).toContain('markCalendarHealthy');
    });

    it('отказ, пришедший ОТВЕТОМ, а не исключением, больше не теряется', () => {
        // createGoogleCalendarEvent и pushSessionToYandex не бросают, а
        // возвращают { success: false } — и раньше этот случай не давал даже
        // строки в журнале: отзыв доступа был невидим полностью.
        const create = sync.slice(sync.indexOf('let eventId'), sync.indexOf('if (eventId)'));
        expect(create).toContain('noteFailure');
        expect((create.match(/noteFailure/g) || []).length).toBe(2);
    });

    it('успех снимает отметку — иначе она горела бы вечно', () => {
        expect(sync).toContain('await markCalendarHealthy(integration.id)');
    });
});

describe('Ф10 · экран говорит правду и даёт дверь', () => {
    const page = read('src/app/diary/integrations/page.tsx');

    it('галочка «всё хорошо» не показывается сломанному подключению', () => {
        expect(page).toContain('i.isActive && !isBroken(i)');
    });

    it('сказано, что случилось, и названа дата', () => {
        expect(page).toContain('Доступ отозван');
        expect(page).toContain('lastErrorAt');
    });

    it('есть кнопка переподключения — сделать это может только человек', () => {
        expect(page).toContain('Подключить заново');
    });

    it('сломанным считается только отзыв доступа', () => {
        expect(code(page)).toContain("i.lastErrorCode === 'PROVIDER_AUTH'");
    });
});

describe('заодно: токены календаря перестали уходить в браузер', () => {
    it('экран получает список полей, а не строку целиком', () => {
        // Это данные самого специалиста, и всё же им нечего делать на
        // странице: она их не показывает и не использует.
        const settings = code(read('src/app/diary/actions/settings.ts'));
        const fn = settings.slice(settings.indexOf('export async function getIntegrations'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        expect(body).toContain('select:');
        for (const secret of ['accessToken', 'refreshToken', 'caldavPassword']) {
            expect(body, `${secret} всё ещё уходит на клиент`).not.toContain(secret);
        }
    });
});

describe('Ф15 · у MAX появился сторож', () => {
    const instrumentation = code(read('src/instrumentation.ts'));
    const webhook = code(read('src/lib/max/webhook.ts'));

    it('подписка проверяется по расписанию, а не только при запуске', () => {
        expect(instrumentation).toContain("runExclusive('max-webhook-watchdog'");
        const at = instrumentation.indexOf("runExclusive('max-webhook-watchdog'");
        const schedule = instrumentation
            .slice(instrumentation.lastIndexOf('cron.schedule', at), at)
            .match(/cron\.schedule\('([^']+)'/)?.[1];
        // Тот же период, что у сторожа Telegram: он и задаёт предельную
        // задержку в плохом случае.
        expect(schedule).toBe('*/5 * * * *');
    });

    it('постановка идемпотентна: существующую подписку не трогают', () => {
        expect(webhook).toContain("'already-registered'");
    });

    it('снятия перед постановкой не осталось — в его окне терялись события', () => {
        expect(webhook).not.toContain("method: 'DELETE'");
        expect(instrumentation).not.toContain('platform-api2');
    });
});

describe('Ф14 · ответ провайдера не печатается в журнал', () => {
    const webhook = code(read('src/lib/max/webhook.ts'));
    const instrumentation = code(read('src/instrumentation.ts'));

    it('тело ответа MAX никуда не выводится', () => {
        expect(webhook).not.toContain('JSON.stringify(result)');
        expect(instrumentation).not.toContain('JSON.stringify(result)');
    });

    it('наружу выходит только наше суждение об исходе', () => {
        for (const outcome of ['already-registered', 'registered', 'register-failed', 'check-failed']) {
            expect(webhook).toContain(`'${outcome}'`);
        }
    });

    it('секрет вебхука в журнал не попадает ни при каком исходе', () => {
        const logs = webhook.split('\n').filter((line) => line.includes('console.'));
        for (const line of logs) {
            expect(line).not.toContain('MAX_WEBHOOK_SECRET');
            expect(line).not.toContain('secret');
        }
    });
});

describe('Ф7 · разметка блога понятна поисковику', () => {
    it('у каждой статьи есть машинная дата', () => {
        for (const post of blogPosts) {
            expect(post.isoDate, `у статьи «${post.title}» нет машинной даты`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(new Date(post.isoDate).toString()).not.toBe('Invalid Date');
        }
    });

    it('машинная дата совпадает с человеческой', () => {
        const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
        for (const post of blogPosts) {
            const [, day, month, year] = post.date.match(/^(\d+)\s+(\S+)\s+(\d{4})/) || [];
            expect(post.isoDate).toBe(
                `${year}-${String(months.indexOf(month) + 1).padStart(2, '0')}-${day.padStart(2, '0')}`,
            );
        }
    });

    it('в разметку уходит именно она', () => {
        expect(read('src/app/blog/[slug]/page.tsx')).toContain('datePublished: post.isoDate');
    });

    it('издателем назван нынешний продукт, а не прежнее имя', () => {
        for (const file of ['src/app/blog/[slug]/page.tsx', 'src/app/blog/page.tsx']) {
            expect(code(read(file)), `${file} всё ещё подписан прежним именем`).not.toContain("'Compas'");
        }
    });
});
