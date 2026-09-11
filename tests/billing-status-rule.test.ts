import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { computeBillingStatus } from '@/lib/billing/status';

/**
 * «Подписка активна» — это про СРОК, а не про факт оплаты когда-то.
 *
 * Правило переехало в общий модуль ровно потому, что вывод делал экран:
 * заплатил в мае — в сентябре крупная зелёная строка «Подписка активна» и
 * дата из прошлого рядом. Теперь вывод один на веб и приложение, и
 * проверяется он здесь, а не в двух местах по-разному.
 */

const MAY = new Date('2026-05-01T00:00:00Z');
const SEPTEMBER = new Date('2026-09-11T12:00:00Z');

describe('состояние оплаты', () => {
    it('оплаченная и не истёкшая — активна', () => {
        const status = computeBillingStatus(
            { trialEndsAt: null, subscriptionEndsAt: new Date('2026-10-01T00:00:00Z'), subscriptionPlan: 'practice' },
            SEPTEMBER,
        );
        expect(status.subscriptionActive).toBe(true);
        expect(status.isExpired).toBe(false);
    });

    it('оплаченная в мае и кончившаяся — НЕ активна', () => {
        const status = computeBillingStatus(
            { trialEndsAt: null, subscriptionEndsAt: MAY, subscriptionPlan: 'practice' },
            SEPTEMBER,
        );
        expect(status.subscriptionActive).toBe(false);
        expect(status.isExpired).toBe(true);
    });

    it('идёт пробный период: подписки нет, срок триала не вышел', () => {
        const status = computeBillingStatus(
            { trialEndsAt: new Date('2026-09-16T12:00:00Z'), subscriptionEndsAt: null, subscriptionPlan: null },
            SEPTEMBER,
        );
        expect(status.trialActive).toBe(true);
        expect(status.subscriptionActive).toBe(false);
        expect(status.daysLeft).toBe(5);
    });

    it('бессрочный доступ не считается ни истёкшим, ни пробным', () => {
        const status = computeBillingStatus(
            { trialEndsAt: new Date('2099-01-01T00:00:00Z'), subscriptionEndsAt: null, subscriptionPlan: null },
            SEPTEMBER,
        );
        expect(status.isForever).toBe(true);
        expect(status.isExpired).toBe(false);
        expect(status.trialActive).toBe(false);
        // Считать дни до 2099 года бессмысленно — и человеку, и нам.
        expect(status.daysLeft).toBeNull();
    });

    it('действующая подписка перекрывает истёкший триал', () => {
        const status = computeBillingStatus(
            { trialEndsAt: MAY, subscriptionEndsAt: new Date('2026-12-01T00:00:00Z'), subscriptionPlan: 'practice' },
            SEPTEMBER,
        );
        expect(status.subscriptionActive).toBe(true);
        expect(status.isExpired).toBe(false);
    });
});

describe('оба клиента считают одним кодом', () => {
    const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf-8');

    it('веб и приложение зовут общий модуль, а не считают сами', () => {
        // Два вычисления «активна ли подписка» в двух местах рано или поздно
        // разойдутся, и разойдутся молча.
        for (const path of ['src/app/api/billing/status/route.ts', 'src/app/api/mobile/billing/route.ts']) {
            const source = read(path);
            expect(source, `${path} не использует общий модуль`).toContain("from '@/lib/billing/status'");
            expect(source, `${path} считает срок сам`).not.toContain('getFullYear()');
        }
    });

    it('подсказки адресов у приложения закрыты ключом приложения, а не веб-сессией', () => {
        const mobile = read('src/app/api/mobile/dadata/route.ts');
        expect(mobile).toContain('authenticateMobileRequest');
        // Открытая ручка подсказок — это чужой счёт: они платные и считаются
        // по запросам.
        expect(mobile).toContain('unauthorizedResponse');
        expect(mobile).toContain("from '@/lib/dadata/reply'");
    });
});
