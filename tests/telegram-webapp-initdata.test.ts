// Task 3 (PRAKTIKA MVP): подлинность личности в Telegram Mini App.
// window.Telegram.WebApp.initDataUnsafe.user полностью подконтролен клиенту —
// доверять ему для резолва clientId означало бы разрешить любому открывшему
// /bot/client с поддельным initDataUnsafe читать чужие записи. Единственный
// источник правды — initData (подписанная строка), проверяемая HMAC на
// сервере по алгоритму Telegram.

import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { verifyTelegramWebAppInitData } from '../src/lib/telegram-webapp';

const BOT_TOKEN = 'test-bot-token-123';

function signInitData(fields: Record<string, string>, botToken = BOT_TOKEN): string {
    const params = new URLSearchParams(fields);
    const dataCheckString = Array.from(params.entries())
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    params.set('hash', hash);
    return params.toString();
}

function validFields(overrides: Record<string, string> = {}) {
    const authDate = String(Math.floor(Date.now() / 1000) - 10);
    return {
        auth_date: authDate,
        query_id: 'AAG123',
        user: JSON.stringify({ id: 555, first_name: 'Клиент' }),
        ...overrides,
    };
}

describe('verifyTelegramWebAppInitData', () => {
    it('верно подписанный initData с валидным auth_date — возвращает пользователя', () => {
        const initData = signInitData(validFields());
        const user = verifyTelegramWebAppInitData(initData, BOT_TOKEN);
        expect(user).toEqual({ id: 555, first_name: 'Клиент' });
    });

    it('подписано другим (неверным) токеном бота — отклоняется', () => {
        const initData = signInitData(validFields(), 'wrong-bot-token');
        expect(verifyTelegramWebAppInitData(initData, BOT_TOKEN)).toBeNull();
    });

    it('подделанный user (после подписи) — отклоняется, а не доверяется как есть', () => {
        const initData = signInitData(validFields());
        const tampered = initData.replace(
            encodeURIComponent(JSON.stringify({ id: 555, first_name: 'Клиент' })),
            encodeURIComponent(JSON.stringify({ id: 999, first_name: 'Чужой' })),
        );
        expect(verifyTelegramWebAppInitData(tampered, BOT_TOKEN)).toBeNull();
    });

    it('просроченный auth_date — отклоняется', () => {
        const staleAuthDate = String(Math.floor(Date.now() / 1000) - 90000); // > 24ч
        const initData = signInitData(validFields({ auth_date: staleAuthDate }));
        expect(verifyTelegramWebAppInitData(initData, BOT_TOKEN)).toBeNull();
    });

    it('auth_date из будущего (за пределами допуска на рассинхрон часов) — отклоняется', () => {
        const futureAuthDate = String(Math.floor(Date.now() / 1000) + 3600);
        const initData = signInitData(validFields({ auth_date: futureAuthDate }));
        expect(verifyTelegramWebAppInitData(initData, BOT_TOKEN)).toBeNull();
    });

    it('нет hash — отклоняется', () => {
        const params = new URLSearchParams(validFields());
        expect(verifyTelegramWebAppInitData(params.toString(), BOT_TOKEN)).toBeNull();
    });

    it('нет user — отклоняется', () => {
        const { user: _user, ...rest } = validFields();
        const initData = signInitData(rest);
        expect(verifyTelegramWebAppInitData(initData, BOT_TOKEN)).toBeNull();
    });

    it('токен бота не задан на сервере — отклоняется (fail-closed, не fail-open)', () => {
        const initData = signInitData(validFields());
        expect(verifyTelegramWebAppInitData(initData, undefined)).toBeNull();
    });

    it('пустая строка initData — отклоняется', () => {
        expect(verifyTelegramWebAppInitData('', BOT_TOKEN)).toBeNull();
    });
});
