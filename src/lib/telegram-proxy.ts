/**
 * Single source of truth for whether Telegram traffic should go through the
 * mieru VPN sidecar (TELEGRAM_PROXY) or directly.
 *
 * Hard rule: the proxy is used ONLY when BOTH the admin flag telegram_vpn_proxy
 * is ON *and* a live health probe through the proxy succeeds. If the proxy is
 * down/slow, sends fall back to DIRECT automatically. This makes the VPN purely
 * additive — a broken tunnel can never hang or break message delivery (which is
 * exactly what happened: bot sends hung ~500s on a dead proxy, breaking binding
 * and delaying MAX in notifyUser).
 */
import { isFeatureEnabled } from '@/app/admin/actions/features';

const TELEGRAM_PROXY = process.env.TELEGRAM_PROXY;
const TELEGRAM_API_URL = process.env.TELEGRAM_API_URL || 'https://api.telegram.org';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// node-fetch is needed for the `agent` option (global fetch/undici uses
// `dispatcher` instead). In the Next standalone bundle, `require('node-fetch')`
// (an ESM module) comes back as { default: fn }, so calling the require result
// directly throws "f is not a function" — which is exactly what broke the VPN
// probe. Normalize to the callable regardless of CJS/ESM interop.
let _nodeFetch: any;
export function nodeFetch(): any {
    if (_nodeFetch) return _nodeFetch;
    const mod = require('node-fetch');
    _nodeFetch = typeof mod === 'function' ? mod : (mod?.default ?? mod);
    return _nodeFetch;
}

let _agent: unknown = null;
let _agentTried = false;
function proxyAgent(): unknown {
    if (!TELEGRAM_PROXY) return undefined;
    if (!_agentTried) {
        _agentTried = true;
        try {
            const { HttpsProxyAgent } = require('https-proxy-agent');
            _agent = new HttpsProxyAgent(TELEGRAM_PROXY);
        } catch (e) {
            console.error('[tg-proxy] failed to create proxy agent:', e);
            _agent = undefined;
        }
    }
    return _agent;
}

export type VpnProxyStatus = {
    configured: boolean;      // TELEGRAM_PROXY env set
    flagEnabled: boolean;     // admin flag telegram_vpn_proxy on
    reachable: boolean;       // probe through the proxy to api.telegram.org succeeded
    latencyMs: number | null;
    checkedAt: string;
    error: string | null;
    effectiveRouting: 'proxy' | 'direct';
};

let _cache: { status: VpnProxyStatus; at: number } | null = null;
const CACHE_MS = 30_000;

export async function getVpnProxyStatus(force = false): Promise<VpnProxyStatus> {
    const now = Date.now();
    if (!force && _cache && now - _cache.at < CACHE_MS) return _cache.status;

    const configured = Boolean(TELEGRAM_PROXY);
    const flagEnabled = await isFeatureEnabled('telegram_vpn_proxy').catch(() => false);

    let reachable = false;
    let latencyMs: number | null = null;
    let error: string | null = null;

    const agent = proxyAgent();
    if (configured && agent && BOT_TOKEN) {
        const started = Date.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
            const f = nodeFetch();
            const res = await f(`${TELEGRAM_API_URL}/bot${BOT_TOKEN}/getMe`, {
                agent,
                signal: controller.signal,
            });
            reachable = res.ok;
            latencyMs = Date.now() - started;
            if (!res.ok) error = `HTTP ${res.status}`;
        } catch (e: any) {
            error = e?.name === 'AbortError' ? 'timeout (>5s)' : (e?.message || 'proxy error');
        } finally {
            clearTimeout(timer);
        }
    } else if (!configured) {
        error = 'TELEGRAM_PROXY не задан (нет секретов MIERU_* или деплой не поднял sidecar)';
    } else if (!BOT_TOKEN) {
        error = 'TELEGRAM_BOT_TOKEN не задан';
    }

    const status: VpnProxyStatus = {
        configured,
        flagEnabled,
        reachable,
        latencyMs,
        checkedAt: new Date().toISOString(),
        error,
        effectiveRouting: flagEnabled && reachable ? 'proxy' : 'direct',
    };
    _cache = { status, at: now };
    return status;
}

/**
 * The agent Telegram sends should use right now: the proxy agent only when the
 * flag is on AND the proxy is healthy; otherwise undefined (direct).
 */
export async function telegramSendAgent(): Promise<unknown> {
    const status = await getVpnProxyStatus();
    return status.effectiveRouting === 'proxy' ? proxyAgent() : undefined;
}
