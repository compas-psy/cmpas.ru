import { NextResponse } from 'next/server';

/**
 * Diagnostic endpoint to check Telegram API connectivity from the server.
 * GET /api/telegram/diagnostic
 */
export async function GET() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const apiUrl = process.env.TELEGRAM_API_URL || 'https://api.telegram.org';
    const proxy = process.env.TELEGRAM_PROXY;

    const results: Record<string, any> = {
        timestamp: new Date().toISOString(),
        config: {
            tokenSet: !!token,
            apiUrl,
            proxySet: !!proxy,
        },
        tests: {},
    };

    // Test 1: DNS resolution of api.telegram.org
    try {
        const dns = require('dns').promises;
        const resolved = await dns.resolve4('api.telegram.org');
        results.tests.dns = { ok: true, ips: resolved };
    } catch (e: any) {
        results.tests.dns = { ok: false, error: e.message };
    }

    // Test 2: Direct fetch to api.telegram.org/bot.../getMe
    if (token) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
            const res = await fetch(`${apiUrl}/bot${token}/getMe`, {
                signal: controller.signal,
            });
            const data = await res.json();
            results.tests.getMe = { ok: data.ok, status: res.status, botName: data.result?.username };
        } catch (e: any) {
            results.tests.getMe = { ok: false, error: e.name === 'AbortError' ? 'Timeout (5s)' : e.message };
        } finally {
            clearTimeout(timeout);
        }
    }

    // Test 3: Direct fetch to Telegram IP (149.154.167.220)
    if (token) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
            const res = await fetch(`https://149.154.167.220/bot${token}/getMe`, {
                signal: controller.signal,
                // @ts-expect-error - Node.js specific option
                rejectUnauthorized: false,
            });
            results.tests.directIp = { ok: true, status: res.status };
        } catch (e: any) {
            results.tests.directIp = { ok: false, error: e.name === 'AbortError' ? 'Timeout (5s)' : e.message };
        } finally {
            clearTimeout(timeout);
        }
    }

    // Test 4: Generic internet connectivity (google.com)
    {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
            const res = await fetch('https://www.google.com', { signal: controller.signal });
            results.tests.internet = { ok: true, status: res.status };
        } catch (e: any) {
            results.tests.internet = { ok: false, error: e.name === 'AbortError' ? 'Timeout (5s)' : e.message };
        } finally {
            clearTimeout(timeout);
        }
    }

    // Test 5: MAX API connectivity (platform-api2.max.ru)
    const maxToken = process.env.MAX_BOT_TOKEN;
    if (maxToken) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
            const res = await fetch('https://platform-api2.max.ru/me', {
                signal: controller.signal,
                headers: { 'Authorization': maxToken },
            });
            const data = await res.json();
            results.tests.maxApi = { ok: !!data.user_id, status: res.status, botName: data.name };
        } catch (e: any) {
            results.tests.maxApi = { ok: false, error: e.name === 'AbortError' ? 'Timeout (5s)' : e.message };
        } finally {
            clearTimeout(timeout);
        }
    }

    return NextResponse.json(results);
}
