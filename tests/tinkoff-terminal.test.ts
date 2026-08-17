import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TinkoffNotification } from '@/lib/tinkoff';

const SITE_KEY = '1775405621806DEMO';
const SITE_PASSWORD = 'MwTygrFgyCLUQcFu';

async function freshTinkoff() {
    vi.resetModules();
    return import('@/lib/tinkoff');
}

function notificationOf(fields: Omit<TinkoffNotification, 'Token'>): TinkoffNotification {
    return { ...fields, Token: '' };
}

describe('tinkoff two-terminal resolution (charter/13_TRACKING_PLAN.md §1)', () => {
    beforeEach(() => {
        delete process.env.TINKOFF_TERMINAL_KEY;
        delete process.env.TINKOFF_PASSWORD;
        delete process.env.TINKOFF_APP_TERMINAL_KEY;
        delete process.env.TINKOFF_APP_PASSWORD;
    });

    it('resolves the default site terminal', async () => {
        const { resolveTerminal } = await freshTinkoff();
        expect(resolveTerminal(SITE_KEY)?.terminal).toBe('site');
    });

    it('returns null for an unrecognized TerminalKey', async () => {
        const { resolveTerminal } = await freshTinkoff();
        expect(resolveTerminal('unknown-key')).toBeNull();
    });

    it('does not resolve an app terminal until both key and password are configured', async () => {
        process.env.TINKOFF_APP_TERMINAL_KEY = 'app-key';
        const { resolveTerminal } = await freshTinkoff();
        expect(resolveTerminal('app-key')).toBeNull();
    });

    it('resolves the app terminal once both env vars are set', async () => {
        process.env.TINKOFF_APP_TERMINAL_KEY = 'app-key';
        process.env.TINKOFF_APP_PASSWORD = 'app-password';
        const { resolveTerminal } = await freshTinkoff();
        expect(resolveTerminal('app-key')?.terminal).toBe('app');
    });

    it('verifies a correctly signed site-terminal notification', async () => {
        const { generateToken, verifyNotificationToken } = await freshTinkoff();
        const notification = notificationOf({
            TerminalKey: SITE_KEY, OrderId: 'order1', Success: true,
            Status: 'CONFIRMED', PaymentId: 123, Amount: 1000,
        });
        notification.Token = generateToken(notification, SITE_PASSWORD);
        expect(verifyNotificationToken(notification)).toBe(true);
    });

    it('rejects a notification tampered with after signing', async () => {
        const { generateToken, verifyNotificationToken } = await freshTinkoff();
        const notification = notificationOf({ TerminalKey: SITE_KEY, OrderId: 'order1', Success: true, Status: 'CONFIRMED', PaymentId: 123, Amount: 1000 });
        notification.Token = generateToken(notification, SITE_PASSWORD);
        notification.Amount = 999999;
        expect(verifyNotificationToken(notification)).toBe(false);
    });

    it('rejects a notification from an unconfigured terminal', async () => {
        const { generateToken, verifyNotificationToken } = await freshTinkoff();
        const notification = notificationOf({ TerminalKey: 'not-configured', OrderId: 'order1', Success: true, Status: 'CONFIRMED', PaymentId: 123, Amount: 1000 });
        notification.Token = generateToken(notification, 'whatever-password');
        expect(verifyNotificationToken(notification)).toBe(false);
    });

    it('verifies the app terminal against its own password, not the site password', async () => {
        process.env.TINKOFF_APP_TERMINAL_KEY = 'app-key';
        process.env.TINKOFF_APP_PASSWORD = 'app-password';
        const { generateToken, verifyNotificationToken } = await freshTinkoff();
        const notification = notificationOf({ TerminalKey: 'app-key', OrderId: 'order2', Success: true, Status: 'CONFIRMED', PaymentId: 456, Amount: 500 });

        notification.Token = generateToken(notification, 'app-password');
        expect(verifyNotificationToken(notification)).toBe(true);

        notification.Token = generateToken(notification, SITE_PASSWORD);
        expect(verifyNotificationToken(notification)).toBe(false);
    });
});
