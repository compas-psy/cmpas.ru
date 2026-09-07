// Единый вход СИМПАС: провайдер добавляется, ничего не отключается.
//
// Проверяется прежде всего то, что стоит жизни чужой учётной записи:
// провайдер объявлен с allowDangerousEmailAccountLinking, то есть
// @auth/core находит человека ПО ПОЧТЕ и отдаёт вошедшему его кабинет.
// Значит неподтверждённая почта здесь — не мелкая небрежность, а прямой
// захват. Отсюда строгость: подтверждение должно быть сказано явно.

import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { isSimpasIdConfigured, isSimpasIdEmailTrustworthy, isAccountProvider, providerDisplayName } from '../src/lib/auth/simpasid';

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

    // Проверка «у человека уже есть аккаунт, отправь его входить туда»
    // живёт в ДВУХ местах: на экране входа (api/auth/check-email) и в
    // самой отправке письма (auth.ts). Они разошлись: экран считал
    // аккаунтом любой провайдер кроме nodemailer, отправка письма —
    // только yandex. Пока провайдера было два, разница ничего не значила;
    // с третьим один и тот же вопрос получал бы два разных ответа в
    // зависимости от того, через какую дверь человек вошёл.
    describe('что считается аккаунтом', () => {
        it('вход по ссылке аккаунтом не считается', () => {
            expect(isAccountProvider('nodemailer')).toBe(false);
        });

        it('и Яндекс, и СИМПАС считаются — правило одно на всех', () => {
            expect(isAccountProvider('yandex')).toBe(true);
            expect(isAccountProvider('simpasid')).toBe(true);
        });
    });

    // Экран входа показывает это имя человеку в лицо: «Этот email связан
    // с аккаунтом X. Войдите через X». Пока провайдер был один, X всегда
    // был «Яндекс»; с simpasid человек увидел бы латиницей строку из
    // нашей конфигурации.
    describe('как способ входа называется человеку', () => {
        it('провайдеры названы по-русски', () => {
            expect(providerDisplayName('yandex')).toBe('Яндекс');
            expect(providerDisplayName('simpasid')).toBe('СИМПАС');
        });

        it('незнакомый провайдер не роняет экран, а показывается как есть', () => {
            expect(providerDisplayName('vk')).toBe('vk');
        });
    });

    // Так это сломалось на бою 07.09.2026. Ключ на сервере был, приложение
    // перезапущено — а кнопки не появилось и появиться не могло: Next.js
    // пререндерил /auth во время `next build`, ВНУТРИ сборочного образа,
    // где переменных единого входа нет. Ответ «не настроен» запёкся в
    // разметку. Снаружи неотличимо от «ключ не доехал».
    //
    // Проверяется исходник, а не поведение: узнать режим рендера из
    // модуля нельзя, его читает сборщик. Строка одна, и потерять её
    // легко — например при возврате страницы к статике «ради скорости».
    describe('страница входа считается на каждый запрос', () => {
        const page = readFileSync(path.join(process.cwd(), 'src/app/auth/page.tsx'), 'utf8');

        it('объявлен force-dynamic', () => {
            expect(page).toMatch(/export const dynamic = ["']force-dynamic["']/);
        });

        it('состав экрана берётся из настройки сервера, а не из сборки', () => {
            expect(page).toContain('isSimpasIdConfigured()');
        });
    });
});