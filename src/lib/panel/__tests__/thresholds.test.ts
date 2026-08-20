/** Пороги: значения живут в конфиге, а не в компонентах (ТЗ §7). */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { severityFor, THRESHOLDS, UNCONFIRMED_THRESHOLDS, worstSeverity } from '../thresholds';

describe('пороги', () => {
    it('порог «ниже» срабатывает по убыванию значения', () => {
        expect(severityFor('paymentSuccess', 99)).toBe('ok');
        expect(severityFor('paymentSuccess', 90)).toBe('warning');
        expect(severityFor('paymentSuccess', 80)).toBe('serious');
    });

    it('порог «выше» срабатывает по возрастанию значения', () => {
        expect(severityFor('backupAgeHours', 9)).toBe('ok');
        expect(severityFor('backupAgeHours', 30)).toBe('warning');
        expect(severityFor('backupAgeHours', 72)).toBe('serious');
    });

    it('отсутствующее значение не превращается в «в порядке»', () => {
        expect(severityFor('paymentSuccess', null)).toBeNull();
        expect(severityFor('paymentSuccess', undefined)).toBeNull();
        expect(severityFor('paymentSuccess', Number.NaN)).toBeNull();
    });

    it('цель напоминаний — ровно 100 %: 99,9 % это уже «внимание»', () => {
        expect(THRESHOLDS.remindersOnTime.warning).toBe(100);
        expect(severityFor('remindersOnTime', 99.9)).toBe('warning');
        expect(severityFor('remindersOnTime', 100)).toBe('ok');
    });

    it('худшее состояние поднимается наверх', () => {
        expect(worstSeverity(['ok', 'warning', 'serious'])).toBe('serious');
        expect(worstSeverity(['ok', 'warning'])).toBe('warning');
        expect(worstSeverity(['ok', 'ok'])).toBe('ok');
        expect(worstSeverity([null, null])).toBeNull();
    });

    it('каждый порог помечен датой подтверждения владельцем', () => {
        // Порог без отметки считается временным. Отметка ставится рядом с
        // значением, чтобы её нельзя было потерять при правке числа.
        const src = readFileSync(path.resolve(__dirname, '../thresholds.ts'), 'utf8');
        for (const key of Object.keys(THRESHOLDS)) {
            const at = src.indexOf(`${key}: {`);
            expect(at, `порог ${key} не найден в исходнике`).toBeGreaterThan(-1);
            const preceding = src.slice(Math.max(0, at - 220), at);
            expect(
                /\/\/ подтверждено владельцем \d{2}\.\d{2}/.test(preceding),
                `порог ${key} без отметки «подтверждено владельцем DD.MM»`,
            ).toBe(true);
        }
    });

    it('неподтверждённые пороги перечислены явно — молча «согласованными» они не становятся', () => {
        // Сейчас список пуст: все восемь подтверждены 20.08.2026. Механизм
        // остаётся для новых порогов.
        for (const key of UNCONFIRMED_THRESHOLDS) {
            expect(THRESHOLDS[key]).toBeDefined();
        }
    });

    it('в компонентах панели нет магических чисел порогов', () => {
        const numbers = new Set<number>();
        for (const t of Object.values(THRESHOLDS)) {
            numbers.add(t.warning);
            numbers.add(t.serious);
        }

        const files = collect(path.resolve(__dirname, '../../../components/panel'));
        expect(files.length).toBeGreaterThan(0);

        for (const file of files) {
            const text = readFileSync(file, 'utf8');
            // Компоненты обязаны получать пороги из thresholds.ts, а не
            // сравнивать значение с зашитым числом.
            expect(
                /\b(?:value|rate|percent)\s*[<>]=?\s*\d+/.test(text),
                `${path.basename(file)}: сравнение с зашитым порогом — порог должен приходить из thresholds.ts`,
            ).toBe(false);
        }
    });
});

function collect(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...collect(full));
        else if (/\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
}
