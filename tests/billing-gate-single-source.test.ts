import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { computeBillingStatus } from '@/lib/billing/status';
import { dayWord, plural } from '@/lib/ru-plural';

/**
 * ОДНО ПРАВИЛО НА ВОПРОС «КОНЧИЛСЯ ЛИ ДОСТУП».
 *
 * Дефект В1 книги 2. Гейт кабинета считал это сам, своей копией правила — и
 * копия была ПРЕЖНЕЙ версией, которую однажды признали неверной и переписали
 * в src/lib/billing/status.ts.
 *
 * Ошибка прежней версии: конец доступа брался из даты пробного периода
 * всегда, когда подписка не активна. У человека, оплатившего сразу, без
 * пробного периода, даты триала нет вовсе — и конец доступа получался
 * «неизвестно», то есть доступ не кончался никогда.
 *
 * Тест на ПРАВИЛО, а не на экран: экран пережил бы правку, правило — нет.
 */

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf-8');
const layout = read('src/app/diary/layout.tsx');

/**
 * Только код, без комментариев: объяснение дефекта рядом с кодом обязано
 * называть его своими словами — и не должно из-за этого ронять проверку,
 * которая тот же дефект стережёт.
 */
const code = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const layoutCode = code(layout);

const day = (iso: string) => new Date(iso);
const NOW = day('2026-09-15T12:00:00Z');

describe('гейт кабинета не считает сам', () => {
    it('зовёт общее правило', () => {
        expect(layout).toContain("from '@/lib/billing/status'");
        expect(layout).toContain('computeBillingStatus(');
    });

    it('в гейте не осталось собственной арифметики по датам', () => {
        // Именно эти три выражения и составляли прежнюю копию правила.
        expect(layoutCode).not.toContain('getFullYear() >= 2099');
        expect(layoutCode).not.toContain('86400000');
        expect(layoutCode).not.toMatch(/hasActiveSub\s*\?/);
    });
});

describe('случай, из-за которого правило переписывали', () => {
    it('оплатил сразу, не пробуя, срок вышел — доступ кончился', () => {
        // У прежней копии здесь получалось «конец неизвестен» — и человек
        // продолжал работать бесплатно после окончания подписки.
        const status = computeBillingStatus({
            trialEndsAt: null,
            subscriptionEndsAt: day('2026-05-01T00:00:00Z'),
            subscriptionPlan: 'practice',
        }, NOW);
        expect(status.isExpired).toBe(true);
        expect(status.subscriptionActive).toBe(false);
    });

    it('подписка действует — доступ есть, и это не пробный период', () => {
        const status = computeBillingStatus({
            trialEndsAt: day('2026-08-01T00:00:00Z'),
            subscriptionEndsAt: day('2026-10-15T00:00:00Z'),
            subscriptionPlan: 'practice',
        }, NOW);
        expect(status.isExpired).toBe(false);
        expect(status.subscriptionActive).toBe(true);
        expect(status.trialActive).toBe(false);
    });

    it('идёт пробный период — он и назван пробным', () => {
        const status = computeBillingStatus({
            trialEndsAt: day('2026-09-25T00:00:00Z'),
            subscriptionEndsAt: null,
            subscriptionPlan: null,
        }, NOW);
        expect(status.trialActive).toBe(true);
        expect(status.subscriptionActive).toBe(false);
    });

    it('бессрочный доступ не кончается', () => {
        const status = computeBillingStatus({
            trialEndsAt: day('2099-01-01T00:00:00Z'),
            subscriptionEndsAt: null,
            subscriptionPlan: null,
        }, NOW);
        expect(status.isForever).toBe(true);
        expect(status.isExpired).toBe(false);
    });
});

/**
 * ЧТО ИМЕННО КОНЧАЕТСЯ — РЕШАЕТ ПРАВИЛО, А НЕ ЭКРАН.
 *
 * Карточка в меню и полоса над кабинетом рисовались по одному лишь числу
 * оставшихся дней, а оно не пустое и у подписки. Человек, оплативший месяц,
 * в последнюю его неделю читал «Пробный период заканчивается» и кнопку
 * «Оформить подписку» — предложение купить то, что он уже купил.
 */
describe('экран называет то состояние, в котором человек находится', () => {
    it('режим выводится из правила, а не из числа дней', () => {
        expect(layout).toContain('billing.trialActive');
        expect(layout).toContain('billing.subscriptionActive');
        expect(layout).toContain('billingMode');
    });

    it('карточка и полоса не показываются, когда режим не определён', () => {
        expect(layout).toContain('billingMode !== null');
    });

    it('«Использовано N% функций» больше нигде не обещается', () => {
        // Полоса меряла прошедшие дни и называла их функциями: не открыв ни
        // одного экрана, человек на двадцать первый день читал, что
        // израсходовал семьдесят процентов.
        expect(layoutCode).not.toContain('% функций');
    });

    it('полоса умеет сказать про подписку, а не только про триал', () => {
        const banner = read('src/components/psidairy/TrialBanner.tsx');
        expect(banner).toContain("mode === 'trial'");
        expect(banner).toContain('Подписка');
    });
});

describe('склонение дней — одно правило на продукт', () => {
    it('работает там, где короткая редакция ошибалась', () => {
        // Короткая версия (`n < 5 ? 'дня' : 'дней'`) права до десяти и
        // ошибается дальше — а пробный период живёт ровно в этом промежутке.
        expect(dayWord(21)).toBe('день');
        expect(dayWord(22)).toBe('дня');
        expect(dayWord(25)).toBe('дней');
    });

    it('11–14 остаются исключением', () => {
        for (const n of [11, 12, 13, 14]) expect(dayWord(n)).toBe('дней');
    });

    it('и на малых числах отвечает как прежде', () => {
        expect(dayWord(1)).toBe('день');
        expect(dayWord(2)).toBe('дня');
        expect(dayWord(5)).toBe('дней');
        expect(dayWord(0)).toBe('дней');
    });

    it('правило общее, а не только про дни', () => {
        expect(plural(1, 'встреча', 'встречи', 'встреч')).toBe('встреча');
        expect(plural(22, 'встреча', 'встречи', 'встреч')).toBe('встречи');
        expect(plural(13, 'встреча', 'встречи', 'встреч')).toBe('встреч');
    });

    it('копий правила в экранах не осталось', () => {
        for (const file of [
            'src/app/diary/layout.tsx',
            'src/components/psidairy/TrialBanner.tsx',
            'src/app/billing/page.tsx',
            'src/app/diary/settings/page.tsx',
        ]) {
            const source = read(file);
            expect(code(source), `${file} держит свою редакцию склонения`)
                .not.toMatch(/\?\s*'день'\s*:/);
            expect(source).toContain("from '@/lib/ru-plural'");
        }
    });
});

/**
 * П8. В СХЕМЕ НЕ ОБЕЩАЕТСЯ ШИФРОВАНИЕ, КОТОРОГО НЕТ.
 *
 * Рядом с колонками, где лежат пароль приложения Яндекса и токены Google,
 * стояла пометка «encrypted». Шифрования в репозитории нет ни одного.
 * Пометка написана для того, кто будет решать, можно ли класть сюда что-то
 * ещё, и отвечала ему «да, тут шифруется».
 */
describe('схема не обещает шифрования, которого нет', () => {
    const schema = read('prisma/schema.prisma');

    it('пометки «encrypted» у колонок не осталось', () => {
        // Слово может встречаться в объяснении — но не как пометка поля.
        const asFieldNote = schema.split('\n').filter(
            (line) => /^\s+\w+\s+\w+\??\s*\/\/.*encrypted/i.test(line),
        );
        expect(asFieldNote).toEqual([]);
    });

    it('в продукте и правда нет шифрования — иначе пометку надо возвращать', () => {
        // Сторож с двух сторон: появится шифрование — этот тест упадёт и
        // напомнит описать его в схеме.
        const src = read('src/lib/calendar/google.ts') + read('src/app/api/calendar/yandex/connect/route.ts');
        expect(src).not.toContain('createCipheriv');
        expect(src).not.toContain('createDecipheriv');
    });
});
