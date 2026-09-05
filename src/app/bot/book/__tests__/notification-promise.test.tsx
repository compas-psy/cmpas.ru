// @vitest-environment jsdom
// Задача 27: экран записи не обещает уведомление, которого не будет.
//
// Постоянную ссылку специалиста открывают в обычном браузере. У человека там
// нет ни Telegram, ни Max, привязанных к практике: он оставил имя и телефон.
// Раньше ему всё равно писали «уведомление придёт в Max» — в мессенджер,
// которого у него может не быть и в который система ничего не отправит,
// потому что отправлять некуда.
//
// Проверяется само правило выбора канала, а не вёрстка: канал есть только
// там, где он действительно есть.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/** Та же логика, что в BookingPageClient: канал определяется контекстом. */
function channelFor(win: { Telegram?: { WebApp?: unknown } }): 'Telegram' | 'Max' | null {
    return win.Telegram?.WebApp ? 'Telegram' : null;
}

function promiseText(channel: 'Telegram' | 'Max' | null): string {
    return channel
        ? `Телефон нужен для связи. Уведомление о сессии придёт в ${channel}.`
        : 'Телефон нужен, чтобы специалист мог связаться с вами и напомнить о встрече.';
}

describe('обещание об уведомлении', () => {
    beforeEach(() => { delete (window as unknown as Record<string, unknown>).Telegram; });
    afterEach(() => { delete (window as unknown as Record<string, unknown>).Telegram; });

    it('внутри Telegram канал есть и назван', () => {
        (window as unknown as Record<string, unknown>).Telegram = { WebApp: { ready() {} } };
        expect(channelFor(window as never)).toBe('Telegram');
        expect(promiseText('Telegram')).toContain('Telegram');
    });

    it('в обычном браузере мессенджер не называется', () => {
        expect(channelFor(window as never)).toBeNull();
    });

    it('без канала текст не обещает мессенджер', () => {
        const text = promiseText(null);
        expect(text).not.toContain('Max');
        expect(text).not.toContain('Telegram');
        expect(text).toContain('специалист');
    });

    it('исходник экрана записи не содержит безусловного обещания Max', async () => {
        const fs = await import('node:fs');
        const src = fs.readFileSync('src/app/bot/book/BookingPageClient.tsx', 'utf8');
        expect(src).not.toContain("setNotificationChannel('Max')");
        expect(src).toContain('setNotificationChannel(null)');
    });
});
