'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';

// Default feature flags with labels
const DEFAULT_FLAGS: Record<string, { label: string; category: string }> = {
  voice_notes: { label: 'Голосовые заметки', category: 'features' },
  ai_summary: { label: 'AI резюме сессий', category: 'features' },
  ai_tags: { label: 'AI предложение тегов', category: 'features' },
  ai_interventions: { label: 'AI рекомендации интервенций', category: 'features' },
  client_notes_sharing: { label: 'Отправка заметок клиенту', category: 'features' },
  diagnostics: { label: 'Диагностика (тесты)', category: 'features' },
  telegram_vpn_proxy: {
    label: 'Telegram через VPN (server2server, mieru)',
    category: 'network',
  },
};

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== 'ADMIN') throw new Error('Forbidden');
  return session.user.id;
}

export async function getFeatureFlags() {
  // Query by the known flag keys, not a single hardcoded category — flags can
  // live under different categories (features/network/etc).
  const rows = await db.systemConfig.findMany({ where: { key: { in: Object.keys(DEFAULT_FLAGS) } } });
  const flags: Record<string, { enabled: boolean; label: string; category: string }> = {};

  // Start with defaults
  for (const [key, info] of Object.entries(DEFAULT_FLAGS)) {
    const row = rows.find(r => r.key === key);
    flags[key] = {
      enabled: row ? row.value === 'true' : false,
      label: info.label,
      category: info.category,
    };
  }
  return flags;
}

export async function setFeatureFlag(key: string, enabled: boolean) {
  await requireAdmin();
  const info = DEFAULT_FLAGS[key];
  if (!info) throw new Error(`Unknown flag: ${key}`);

  await db.systemConfig.upsert({
    where: { key },
    create: { key, value: enabled ? 'true' : 'false', label: info.label, category: info.category },
    update: { value: enabled ? 'true' : 'false' },
  });
  return { success: true };
}

// Quick check for a single flag (used by feature components)
export async function isFeatureEnabled(key: string): Promise<boolean> {
  const row = await db.systemConfig.findUnique({ where: { key } });
  return row?.value === 'true';
}

// Not exported: a 'use server' file may only export async functions. The
// client page defines a matching shape locally.
type MessagingStatus = {
  vpn: {
    configured: boolean;
    flagEnabled: boolean;
    reachable: boolean;
    latencyMs: number | null;
    effectiveRouting: 'proxy' | 'direct';
    error: string | null;
    checkedAt: string;
  };
  telegramBot: { ok: boolean; username: string | null; error: string | null };
  maxBot: { configured: boolean; ok: boolean; error: string | null };
};

/** Live health of the messaging stack for the admin panel: VPN proxy state,
 * Telegram bot reachability, MAX bot reachability. Forces a fresh probe. */
export async function getMessagingStatus(): Promise<MessagingStatus> {
  await requireAdmin();
  const { getVpnProxyStatus } = await import('@/lib/telegram-proxy');
  const vpn = await getVpnProxyStatus(true);

  // Telegram bot getMe (uses the same health-gated agent as real sends).
  let telegramBot: MessagingStatus['telegramBot'] = { ok: false, username: null, error: 'not configured' };
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgApi = process.env.TELEGRAM_API_URL || 'https://api.telegram.org';
  if (tgToken) {
    try {
      const { telegramSendAgent, nodeFetch } = await import('@/lib/telegram-proxy');
      const agent = await telegramSendAgent();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const doFetch = agent ? nodeFetch() : fetch;
      const res: any = await doFetch(`${tgApi}/bot${tgToken}/getMe`, { agent, signal: controller.signal } as any);
      clearTimeout(timer);
      const json = await res.json();
      telegramBot = { ok: Boolean(json?.ok), username: json?.result?.username || null, error: json?.ok ? null : (json?.description || `HTTP ${res.status}`) };
    } catch (e: any) {
      const raw = e?.name === 'AbortError' ? 'timeout (>6s)' : (e?.message || 'error');
      telegramBot = { ok: false, username: null, error: raw.replace(/\/bot\d+:[A-Za-z0-9_-]+/g, '/bot***') };
    }
  }

  // MAX bot getMe (direct — MAX never uses the proxy).
  let maxBot: MessagingStatus['maxBot'] = { configured: false, ok: false, error: 'not configured' };
  const maxToken = process.env.MAX_BOT_TOKEN;
  if (maxToken) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch('https://platform-api2.max.ru/me', { headers: { Authorization: maxToken }, signal: controller.signal });
      clearTimeout(timer);
      const json: any = await res.json().catch(() => null);
      maxBot = { configured: true, ok: res.ok, error: res.ok ? null : (json?.message || `HTTP ${res.status}`) };
    } catch (e: any) {
      maxBot = { configured: true, ok: false, error: e?.name === 'AbortError' ? 'timeout (>6s)' : (e?.message || 'error') };
    }
  }

  return {
    vpn: {
      configured: vpn.configured,
      flagEnabled: vpn.flagEnabled,
      reachable: vpn.reachable,
      latencyMs: vpn.latencyMs,
      effectiveRouting: vpn.effectiveRouting,
      error: vpn.error,
      checkedAt: vpn.checkedAt,
    },
    telegramBot,
    maxBot,
  };
}
