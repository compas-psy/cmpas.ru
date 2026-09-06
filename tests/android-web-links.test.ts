// Задача 22: ссылки «в веб-кабинет» из приложения ведут на существующие
// страницы.
//
// Нативного экрана синхронизации календарей в приложении нет, и рисовать
// заглушку ради пункта меню нельзя — вместо этого открывается настоящая
// веб-настройка. Но ссылка, вбитая в Kotlin, живёт отдельно от маршрутов
// Next.js: переименуют страницу — приложение молча начнёт открывать 404, и
// узнает об этом человек, который на неё нажал.
//
// Этот тест собирает ВСЕ адреса cmpas.ru/<путь>, вбитые в исходники Android,
// и проверяет, что для каждого в репозитории есть маршрут. Проверка нужна не
// одной ссылке Задачи 22, а всем сразу — их уже несколько.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import path from 'path';

const ANDROID_SRC = path.join(process.cwd(), 'android/app/src/main/java');
const APP_DIR = path.join(process.cwd(), 'src/app');

function kotlinFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return kotlinFiles(full);
        return entry.isFile() && entry.name.endsWith('.kt') ? [full] : [];
    });
}

/** Адреса вида https://cmpas.ru/<путь> без интерполяции — только буквальные. */
function hardcodedPaths(): Array<{ file: string; url: string; route: string }> {
    const found: Array<{ file: string; url: string; route: string }> = [];
    for (const file of kotlinFiles(ANDROID_SRC)) {
        const source = readFileSync(file, 'utf8');
        for (const match of source.matchAll(/https:\/\/cmpas\.ru(\/[A-Za-z0-9\-_/]*)/g)) {
            const route = match[1].replace(/\/$/, '');
            // Пустой путь — это главная, и адреса с ${…} собираются в рантайме:
            // такие проверять здесь нечем.
            if (!route) continue;
            found.push({ file: path.relative(process.cwd(), file), url: match[0], route });
        }
    }
    return found;
}

/** Есть ли в App Router страница по этому пути. */
function routeExists(route: string): boolean {
    const segments = route.split('/').filter(Boolean);
    let dir = APP_DIR;
    for (const segment of segments) {
        const direct = path.join(dir, segment);
        if (existsSync(direct) && statSync(direct).isDirectory()) {
            dir = direct;
            continue;
        }
        // Динамический сегмент: [id], [slug], [...rest].
        const dynamic = readdirSync(dir, { withFileTypes: true })
            .find((entry) => entry.isDirectory() && entry.name.startsWith('['));
        if (!dynamic) return false;
        dir = path.join(dir, dynamic.name);
    }
    return existsSync(path.join(dir, 'page.tsx')) || existsSync(path.join(dir, 'route.ts'));
}

/**
 * Известная сломанная ссылка, найденная этой проверкой при её появлении.
 *
 * `https://cmpas.ru/d/<id>` подставляется в текст сообщения клиенту при
 * отправке документа (NewActionSheet.documentMessage). Маршрута /d в
 * src/app нет вовсе — клиент получает ссылку в никуда. Это не Задача 22:
 * документы и карточка клиента — соседняя область, чинить её здесь значило
 * бы расширять задачу. Запись оставлена НАЗВАННОЙ, а не спрятана: пока она
 * тут, дыра видна, а проверка продолжает сторожить все остальные ссылки.
 */
const KNOWN_BROKEN = ['/d'];

describe('ссылки из Android в веб-кабинет', () => {
    it('в приложении вообще есть такие ссылки — иначе тест бы ничего не проверял', () => {
        expect(hardcodedPaths().length).toBeGreaterThan(0);
    });

    it('каждая ведёт на существующий маршрут', () => {
        const broken = hardcodedPaths()
            .filter((entry) => !routeExists(entry.route))
            .filter((entry) => !KNOWN_BROKEN.includes(entry.route));

        expect(broken.map((entry) => `${entry.url} (${entry.file})`)).toEqual([]);
    });

    it('список исключений не растёт молча', () => {
        // Каждая новая строка здесь — это ссылка, которая у человека
        // откроет 404. Список меняется только осознанно.
        expect(KNOWN_BROKEN).toEqual(['/d']);
        expect(routeExists('/d')).toBe(false);
    });

    it('синхронизация календарей из Задачи 22 указывает на страницу интеграций', () => {
        const links = hardcodedPaths().filter((entry) => entry.route === '/diary/integrations');

        expect(links.length).toBeGreaterThan(0);
        expect(routeExists('/diary/integrations')).toBe(true);
    });
});
