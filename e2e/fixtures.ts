import { readFileSync } from 'node:fs';
import { test as base, type Page } from '@playwright/test';

/** Синтетические данные из scripts/e2e-seed.cjs: настоящих людей в прогоне нет. */
/**
 * Подписанные ссылки, которые посев выдал этому прогону: перенос, отмена и
 * персональная ссылка известного клиента. Продукт раздаёт их сообщениями
 * бота, а не голыми идентификаторами, поэтому сквозной прогон ходит теми же.
 */
export const TOKENS: { rescheduleSessionId: string; rescheduleToken: string; cancelToken: string; knownClientToken: string } =
    JSON.parse(readFileSync(process.env.E2E_TOKENS_FILE || '/tmp/t27/e2e-tokens.json', 'utf8'));

export const SEED = {
    psychologistA: 't27-psy-a',
    psychologistB: 't27-psy-b',
    sessionA: process.env.E2E_SESSION_A || 't27-session-a',
    sessionB: process.env.E2E_SESSION_B || 't27-session-b',
    slug: 'maria-sokolova',
    clientLongName: 'Анастасия Владимировна Ковалевская',
    clientNoConsent: 'Клиент Без Согласия',
    sessionTodayOnline: 't27-sess-today-1',
    sessionPastNoNote: 't27-sess-past-nonote',
    sessionPastUnpaid: 't27-sess-past-unpaid',
};

export async function signIn(page: Page, token: string) {
    const url = new URL(process.env.E2E_BASE_URL || 'http://localhost:3100');
    await page.context().addCookies([{
        name: 'authjs.session-token', value: token,
        domain: url.hostname, path: '/', httpOnly: true, sameSite: 'Lax',
    }]);
}

export const test = base;
export { expect } from '@playwright/test';
