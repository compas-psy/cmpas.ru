/**
 * Цвета берутся только из токенов (ТЗ §9).
 *
 * Единственное место, где допустимы hex-значения, — служебный токен-слой
 * `src/app/admin/panel/panel.css`. Всё остальное обязано ходить через var(--…),
 * иначе тёмная тема и печать разъедутся молча.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

const COMPONENTS = path.resolve(__dirname, '../../../components/panel');
const SCREENS = path.resolve(__dirname, '../../../app/admin/panel');
const TOKEN_FILE = path.join(SCREENS, 'panel.css');

const HEX = /#[0-9a-fA-F]{3,8}\b/g;

function collect(dir: string, exts = /\.(tsx?|css)$/): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...collect(full, exts));
        else if (exts.test(entry)) out.push(full);
    }
    return out;
}

describe('токены панели', () => {
    it('ни одного hex-значения вне токен-слоя', () => {
        const files = [...collect(COMPONENTS), ...collect(SCREENS)].filter((f) => f !== TOKEN_FILE);
        expect(files.length).toBeGreaterThan(0);

        for (const file of files) {
            const found = readFileSync(file, 'utf8').match(HEX) ?? [];
            expect(found, `${path.relative(process.cwd(), file)}: hex-цвет мимо токенов: ${found.join(', ')}`).toEqual([]);
        }
    });

    it('токен-слой объявляет обе темы и все шесть слотов палитры', () => {
        const css = readFileSync(TOKEN_FILE, 'utf8');
        expect(css).toContain('[data-panel]');
        expect(css).toContain("[data-panel][data-theme='dark']");
        for (const slot of ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6']) {
            // Слот объявлен и переопределён в тёмной теме — тёмная тема не
            // автоматическая инверсия, а свой набор шагов.
            const occurrences = css.split(`${slot}:`).length - 1;
            expect(occurrences, `${slot} объявлен ${occurrences} раз(а), ожидалось 2`).toBe(2);
        }
    });

    it('все пять цветов состояний объявлены в обеих темах', () => {
        const css = readFileSync(TOKEN_FILE, 'utf8');
        for (const state of ['ok', 'wa', 'se', 'br', 'un']) {
            for (const part of ['bg', 'fg', 'br']) {
                const token = `--${state}-${part}:`;
                expect(css.split(token).length - 1, `${token} объявлен не дважды`).toBe(2);
            }
        }
    });

    it('мобильный вид сделан медиазапросом, а не переключателем', () => {
        const css = readFileSync(TOKEN_FILE, 'utf8');
        expect(css).toContain('@media (max-width: 720px)');
        expect(css).not.toContain('data-view="mobile"');
    });
});
