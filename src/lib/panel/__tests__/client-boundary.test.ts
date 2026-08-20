/**
 * Граница сервер→клиент (React Server Components).
 *
 * Тест появился после падения экрана «Деньги» с 500 на живых данных: в
 * клиентский компонент графика передавалась функция форматирования. Ни
 * сборка, ни типы этого не ловят — падает только рантайм, и падает целиком.
 *
 * Правило: клиентские компоненты панели не принимают функции пропсами.
 * Поведение задаётся именем варианта, которое разбирается уже внутри.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';

const COMPONENTS = path.resolve(__dirname, '../../../components/panel');
const SCREENS = path.resolve(__dirname, '../../../app/admin/panel');

function files(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? files(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : [],
    );
}

/** Клиентские компоненты панели — те, что объявили 'use client'. */
function clientComponents(): { file: string; text: string; exports: string[] }[] {
    return files(COMPONENTS)
        .map((file) => ({ file, text: readFileSync(file, 'utf8') }))
        .filter(({ text }) => /^['"]use client['"]/m.test(text))
        .map(({ file, text }) => ({
            file,
            text,
            exports: [...text.matchAll(/export function (\w+)/g)].map((m) => m[1]),
        }));
}

/**
 * Достаёт пропсы каждого использования `<Name …>` из исходника.
 *
 * Регулярка тут не годится: в пропсах встречается `=>`, и любой шаблон вида
 * `[^>]*` обрывается на стрелке — ровно поэтому первая версия теста
 * пропускала ошибку, которую должна была ловить. Считаем скобки вручную.
 */
function jsxUsages(text: string, name: string): string[] {
    const out: string[] = [];
    const open = new RegExp(`<${name}[\\s/>]`, 'g');
    let m: RegExpExecArray | null;

    while ((m = open.exec(text)) !== null) {
        let i = m.index + name.length + 1;
        let depth = 0;
        let quote: string | null = null;

        for (; i < text.length; i += 1) {
            const ch = text[i];
            if (quote) {
                if (ch === quote) quote = null;
                continue;
            }
            if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
            if (ch === '{') { depth += 1; continue; }
            if (ch === '}') { depth -= 1; continue; }
            if (ch === '>' && depth === 0) break;
        }
        out.push(text.slice(m.index + name.length + 1, i));
    }
    return out;
}

describe('граница сервер→клиент', () => {
    it('клиентские компоненты не объявляют функции в пропсах', () => {
        for (const { file, text } of clientComponents()) {
            // Ищем типы пропсов вида `name?: (x) => y` в сигнатуре компонента.
            const functionProps = [...text.matchAll(/^\s{4}(\w+)\??:\s*\([^)]*\)\s*=>/gm)].map((m) => m[1]);
            expect(
                functionProps,
                `${path.basename(file)}: пропсы-функции ${functionProps.join(', ')} — их нельзя передать из серверного компонента`,
            ).toEqual([]);
        }
    });

    it('серверные экраны не передают стрелочные функции в клиентские компоненты', () => {
        const clientExports = new Set(clientComponents().flatMap((c) => c.exports));
        expect(clientExports.size).toBeGreaterThan(0);

        for (const file of files(SCREENS)) {
            const text = readFileSync(file, 'utf8');
            if (/^['"]use client['"]/m.test(text)) continue; // клиентский экран — ему можно

            for (const name of clientExports) {
                for (const props of jsxUsages(text, name)) {
                    const arrow = /\w+=\{\s*(?:async\s*)?\(?[\w\s,:{}[\]]*\)?\s*=>/.exec(props);
                    expect(
                        arrow,
                        `${path.basename(file)}: в <${name}> передаётся функция «${arrow?.[0]}» — экран упадёт в рантайме`,
                    ).toBeNull();
                }
            }
        }
    });
});
