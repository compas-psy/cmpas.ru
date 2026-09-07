// Куда возвращать человека после входа.
//
// Значение приходит из адресной строки, то есть от кого угодно, и ведёт
// человека сразу после ввода пароля. Это классическое место открытой
// переадресации: злоумышленник шлёт ссылку на НАШ вход с чужим адресом
// внутри, человек видит знакомый домен, входит и оказывается на
// поддельной странице, уже доверяя ей.

import { describe, it, expect } from 'vitest';
import { safeReturnPath, DEFAULT_RETURN_PATH } from '../src/lib/auth/return-path';

describe('возврат после входа', () => {
    it('обычный путь внутри сайта сохраняется вместе с параметрами', () => {
        expect(safeReturnPath('/diary/clients?attest=1')).toBe('/diary/clients?attest=1');
    });

    it('пусто — ведём в кабинет', () => {
        expect(safeReturnPath(null)).toBe(DEFAULT_RETURN_PATH);
        expect(safeReturnPath('')).toBe(DEFAULT_RETURN_PATH);
    });

    it('чужой домен не уводит', () => {
        for (const evil of [
            'https://\u0437\u043b\u043e.example/вход',
            'http://evil.example',
            '//evil.example',
            '/\\evil.example',
            'evil.example',
        ]) {
            expect(safeReturnPath(evil)).toBe(DEFAULT_RETURN_PATH);
        }
    });

    it('перевод строки и управляющие символы отбрасываются', () => {
        expect(safeReturnPath('/diary\nSet-Cookie: a=b')).toBe(DEFAULT_RETURN_PATH);
        expect(safeReturnPath('/diary ')).toBe(DEFAULT_RETURN_PATH);
    });
});
