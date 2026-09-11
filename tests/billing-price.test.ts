// Цена подписки — одна на весь продукт.
//
// Проверяется не арифметика, а то, чего не проверит ни один обычный тест:
// что цену не вписали руками ещё раз. До общего места она жила в пяти
// файлах — витрина, лендинг, разметка для поисковиков, справка — и,
// отдельно от них, сумма списания у эквайринга.
//
// Опасно здесь не «на витрине старая цена». Опасно, что витрина и списание
// разъедутся: кнопка обещает одну сумму, банк снимает другую. Человек
// увидит это на странице оплаты, и объяснять будет нечем.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { PRACTICE_PRICE_RUB, PRACTICE_PRICE_KOPECKS, PRACTICE_PRICE_LABEL } from '@/lib/billing/pricing';
import { PLANS } from '@/lib/tinkoff';

const SRC = join(process.cwd(), 'src');
const PRICING_MODULE = join('src', 'lib', 'billing', 'pricing.ts');

function sourceFiles(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            if (entry === 'node_modules' || entry === '__tests__') continue;
            sourceFiles(full, acc);
        } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')) {
            acc.push(full);
        }
    }
    return acc;
}

describe('цена подписки', () => {
    it('рубли и копейки — одно число, а не два', () => {
        expect(PRACTICE_PRICE_KOPECKS).toBe(PRACTICE_PRICE_RUB * 100);
    });

    // САМАЯ ВАЖНАЯ ПРОВЕРКА ФАЙЛА.
    //
    // Витрина показывает рубли, банку уходят копейки. Разойдись они — узнает
    // об этом человек на странице оплаты.
    it('банку уходит ровно та сумма, которую показывает витрина', () => {
        expect(PLANS.practice.price).toBe(PRACTICE_PRICE_KOPECKS);
    });

    it('подпись собирается из числа, а не набирается руками', () => {
        // В подписи стоит НЕРАЗРЫВНЫЙ пробел разряда («1 490 ₽»): число не
        // должно переноситься отдельно от знака рубля. Поэтому сравниваем
        // цифры, выкинув любые пробелы, а не строку целиком.
        const digits = PRACTICE_PRICE_LABEL.replace(/[^\d]/g, '');
        expect(digits).toBe(String(PRACTICE_PRICE_RUB));
        expect(PRACTICE_PRICE_LABEL.endsWith('₽')).toBe(true);
    });

    it('цена не вписана числом больше нигде в исходниках', () => {
        // Ищем «<число> ₽» и голое число рядом со знаком рубля: ровно те
        // формы, в которых цена жила по файлам до общего места.
        const withPrice = /(\b\d{3,5}\s*₽)|(₽\s*\d{3,5}\b)/;
        const offenders: string[] = [];

        for (const file of sourceFiles(SRC)) {
            const rel = file.slice(process.cwd().length + 1);
            if (rel === PRICING_MODULE) continue;
            const text = readFileSync(file, 'utf8');
            for (const line of text.split('\n')) {
                // Строку с подстановкой из общего места пропускаем: она и
                // есть правильный способ показать цену.
                if (line.includes('PRACTICE_PRICE')) continue;
                if (withPrice.test(line)) offenders.push(`${rel}: ${line.trim()}`);
            }
        }

        expect(offenders, `цена вписана мимо src/lib/billing/pricing.ts:\n${offenders.join('\n')}`).toEqual([]);
    });
});
