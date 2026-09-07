// Ссылка из бота должна доводить до цели и того, кто не залогинен.
//
// Из мессенджера ссылку открывают в отдельном браузере, где сессии
// обычно нет. Было так: layout кабинета отправлял на /auth, ничего не
// запомнив, а /auth после входа всегда вёл на /diary. Человек делал всё
// правильно — открыл ссылку, ввёл пароль — и попадал на «Сегодня», где
// его ни о чём не спрашивают. Со стороны это тот же обман, что и раньше,
// только на шаг позже.
//
// Цепочка живёт в трёх файлах и рвётся в любом из них молча, поэтому
// сторож держит их вместе.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const read = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');
const PROXY = read('src/proxy.ts');
const LAYOUT = read('src/app/diary/layout.tsx');
const AUTH = read('src/app/auth/page.tsx');

describe('ссылка переживает вход', () => {
    it('адрес запроса кладётся в заголовок — иначе layout его не знает', () => {
        // Серверный layout своего адреса не получает: Next его не передаёт.
        expect(PROXY).toContain("set('x-pathname'");
        expect(PROXY).toContain('request.nextUrl.search');
    });

    it('layout отправляет на вход, запомнив, куда шли', () => {
        expect(LAYOUT).toContain("get('x-pathname')");
        expect(LAYOUT).toContain('next=');
        // Обе развилки — нет сессии и нет пользователя в базе — ведут на
        // один и тот же путь: разъехавшись, они дали бы потерю адреса в
        // одном случае из двух, что ловится ещё хуже.
        expect(LAYOUT).not.toMatch(/redirect\('\/auth'\)/);
    });

    it('вход возвращает по запомненному адресу, а не всегда в кабинет', () => {
        expect(AUTH).toContain('returnPath()');
        expect(AUTH).not.toContain('callbackUrl: "/diary"');
    });

    it('значение из адресной строки проходит строгий разбор', () => {
        // Без этого «куда вернуться» — открытая переадресация.
        expect(AUTH).toContain('safeReturnPath');
        expect(LAYOUT).toContain('safeReturnPath');
    });
});
