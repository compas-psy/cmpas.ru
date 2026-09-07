// Единый вход СИМПАС: провайдер добавляется, ничего не отключается.
//
// Проверяется прежде всего то, что стоит жизни чужой учётной записи:
// провайдер объявлен с allowDangerousEmailAccountLinking, то есть
// @auth/core находит человека ПО ПОЧТЕ и отдаёт вошедшему его кабинет.
// Значит неподтверждённая почта здесь — не мелкая небрежность, а прямой
// захват. Отсюда строгость: подтверждение должно быть сказано явно.

import { describe, it, expect, afterEach } from 'vitest';
import { isSimpasIdConfigured, isSimpasIdEmailTrustworthy } from '../src/lib/auth/simpasid';

const KEYS = ['SIMPASID_ISSUER', 'SIMPASID_CLIENT_ID', 'SIMPASID_CLIENT_SECRET'] as const;
const ORIGINAL = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));

function setEnv(values: Partial<Record<(typeof KEYS)[number], string | undefined>>) {
    for (const key of KEYS) {
        const value = values[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
}

describe('единый вход СИМПАС', () => {
    afterEach(() => {
        for (const key of KEYS) {
            const value = ORIGINAL[key];
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });

    describe('когда провайдер считается настроенным', () => {
        it('все три переменные заданы — настроен', () => {
            setEnv({
                SIMPASID_ISSUER: 'https://auth.cmpas.ru',
                SIMPASID_CLIENT_ID: 'practice-web',
                SIMPASID_CLIENT_SECRET: 'ключ',
            });
            expect(isSimpasIdConfigured()).toBe(true);
        });

        // Главное здесь — не «false», а то, что кнопки на входе не будет.
        // Провайдер с пустым issuer — это способ входа, который на экране
        // есть, а при нажатии падает.
        it('нет ключа — НЕ настроен, даже если остальное задано', () => {
            setEnv({
                SIMPASID_ISSUER: 'https://auth.cmpas.ru',
                SIMPASID_CLIENT_ID: 'practice-web',
                SIMPASID_CLIENT_SECRET: undefined,
            });
            expect(isSimpasIdConfigured()).toBe(false);
        });

        it('пустая строка — то же самое, что не задано', () => {
            setEnv({
                SIMPASID_ISSUER: 'https://auth.cmpas.ru',
                SIMPASID_CLIENT_ID: 'practice-web',
                SIMPASID_CLIENT_SECRET: '',
            });
            expect(isSimpasIdConfigured()).toBe(false);
        });
    });

    describe('какой почте можно верить', () => {
        it('почта есть и подтверждена — верим', () => {
            expect(isSimpasIdEmailTrustworthy({ email: 'psy@example.com', email_verified: true })).toBe(true);
        });

        it('подтверждение сказано как false — не верим', () => {
            expect(isSimpasIdEmailTrustworthy({ email: 'psy@example.com', email_verified: false })).toBe(false);
        });

        // Отсутствие claim — это НЕ подтверждение. Провайдер завтра может
        // перестать его класть, и проверка не должна молча превратиться в
        // сравнение undefined с false.
        it('подтверждения нет вовсе — не верим', () => {
            expect(isSimpasIdEmailTrustworthy({ email: 'psy@example.com' })).toBe(false);
        });

        // СИМПАС неподтверждённую почту не отдаёт вовсе: claim email
        // просто отсутствует. Значит «нет почты» здесь означает «почта не
        // подтверждена», и пускать нельзя.
        it('почты нет — не верим', () => {
            expect(isSimpasIdEmailTrustworthy({ email_verified: true })).toBe(false);
        });

        it('почта из пробелов — не верим', () => {
            expect(isSimpasIdEmailTrustworthy({ email: '   ', email_verified: true })).toBe(false);
        });

        it('профиля нет вовсе — не верим', () => {
            expect(isSimpasIdEmailTrustworthy(undefined)).toBe(false);
            expect(isSimpasIdEmailTrustworthy(null)).toBe(false);
        });

        // Строка "true" — не true. Мелочь, но именно на таких мелочах
        // проверка подлинности перестаёт быть проверкой.
        it('подтверждение строкой — не верим', () => {
            expect(isSimpasIdEmailTrustworthy({ email: 'psy@example.com', email_verified: 'true' })).toBe(false);
        });
    });
});
