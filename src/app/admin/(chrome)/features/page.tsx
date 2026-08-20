'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ToggleRight, ToggleLeft, RefreshCw, ShieldCheck, ShieldAlert, Send, MessageSquare } from 'lucide-react';

type FeatureFlag = { enabled: boolean; label: string; category: string };

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

const CATEGORY_TITLES: Record<string, string> = {
  features: 'Функции',
  network: 'Сеть и подключение',
};

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />;
}

export default function FeaturesPage() {
  const [flags, setFlags] = useState<Record<string, FeatureFlag>>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [msgStatus, setMsgStatus] = useState<MessagingStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const load = useCallback(async () => {
    try {
      const { getFeatureFlags } = await import('@/app/admin/actions/features');
      const data = await getFeatureFlags();
      setFlags(data);
    } catch { toast.error('Ошибка загрузки'); }
    setLoading(false);
  }, []);

  const loadStatus = useCallback(async () => {
    setCheckingStatus(true);
    try {
      const { getMessagingStatus } = await import('@/app/admin/actions/features');
      setMsgStatus(await getMessagingStatus());
    } catch { toast.error('Не удалось проверить статус мессенджеров'); }
    setCheckingStatus(false);
  }, []);

  useEffect(() => { load(); loadStatus(); }, [load, loadStatus]);

  const toggle = async (key: string, enabled: boolean) => {
    setToggling(key);
    try {
      const { setFeatureFlag } = await import('@/app/admin/actions/features');
      await setFeatureFlag(key, enabled);
      setFlags(prev => ({ ...prev, [key]: { ...prev[key], enabled } }));
      toast.success(`${flags[key]?.label}: ${enabled ? 'Включено' : 'Выключено'}`);
      if (key === 'telegram_vpn_proxy') loadStatus();
    } catch { toast.error('Ошибка'); }
    setToggling(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const categories = Array.from(new Set(Object.values(flags).map(f => f.category)));

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Управление функциями</h1>
          <p className="text-sm text-muted-foreground mt-1">Включайте и отключайте функционал платформы</p>
        </div>
        <button onClick={load} className="p-1.5 rounded-lg hover:bg-muted"><RefreshCw className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      {/* Messaging / VPN health */}
      <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-sage-50/50 flex items-center justify-between">
          <span className="text-sm font-bold text-foreground">Статус мессенджеров и VPN</span>
          <button onClick={loadStatus} disabled={checkingStatus} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${checkingStatus ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="divide-y divide-border">
          {/* VPN */}
          <div className="px-5 py-4 flex items-start gap-3">
            {msgStatus?.vpn.effectiveRouting === 'proxy'
              ? <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              : <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />}
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">VPN (mieru) для Telegram</div>
              {!msgStatus ? (
                <div className="text-xs text-muted-foreground mt-1">Проверка…</div>
              ) : !msgStatus.vpn.configured ? (
                <div className="text-xs text-muted-foreground mt-1">Не настроен: {msgStatus.vpn.error || 'нет TELEGRAM_PROXY'}</div>
              ) : (
                <div className="text-xs mt-1 space-y-0.5">
                  <div className="flex items-center gap-2"><StatusDot ok={msgStatus.vpn.flagEnabled} /> Флаг: {msgStatus.vpn.flagEnabled ? 'включён' : 'выключен'}</div>
                  <div className="flex items-center gap-2"><StatusDot ok={msgStatus.vpn.reachable} /> Туннель: {msgStatus.vpn.reachable ? `доступен${msgStatus.vpn.latencyMs != null ? ` (${msgStatus.vpn.latencyMs} мс)` : ''}` : `недоступен${msgStatus.vpn.error ? ` — ${msgStatus.vpn.error}` : ''}`}</div>
                  <div className="text-muted-foreground">Трафик Telegram идёт: <b className="text-foreground">{msgStatus.vpn.effectiveRouting === 'proxy' ? 'через VPN' : 'напрямую'}</b>{msgStatus.vpn.flagEnabled && !msgStatus.vpn.reachable ? ' (VPN включён, но недоступен — автоматически используется прямое соединение)' : ''}</div>
                </div>
              )}
            </div>
          </div>
          {/* Telegram bot */}
          <div className="px-5 py-4 flex items-center gap-3">
            <Send className="w-5 h-5 text-[#2F6B5A] shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">Telegram-бот</div>
              <div className="text-xs mt-0.5 flex items-center gap-2">
                {msgStatus ? <StatusDot ok={msgStatus.telegramBot.ok} /> : null}
                <span className="text-muted-foreground">{!msgStatus ? 'Проверка…' : msgStatus.telegramBot.ok ? `онлайн${msgStatus.telegramBot.username ? ` · @${msgStatus.telegramBot.username}` : ''}` : `недоступен — ${msgStatus.telegramBot.error}`}</span>
              </div>
            </div>
          </div>
          {/* MAX bot */}
          <div className="px-5 py-4 flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-[#2F6B5A] shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">MAX-бот</div>
              <div className="text-xs mt-0.5 flex items-center gap-2">
                {msgStatus ? <StatusDot ok={msgStatus.maxBot.ok} /> : null}
                <span className="text-muted-foreground">{!msgStatus ? 'Проверка…' : !msgStatus.maxBot.configured ? 'не настроен (нет MAX_BOT_TOKEN)' : msgStatus.maxBot.ok ? 'онлайн' : `недоступен — ${msgStatus.maxBot.error}`}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {categories.map(category => (
        <div key={category} className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-sage-50/50">
            <span className="text-sm font-bold text-foreground">{CATEGORY_TITLES[category] || category}</span>
          </div>
          <div className="divide-y divide-border">
            {Object.entries(flags).filter(([, flag]) => flag.category === category).map(([key, flag]) => (
              <div key={key} className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="text-sm font-semibold text-foreground">{flag.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{key}</div>
                </div>
                <button
                  onClick={() => toggle(key, !flag.enabled)}
                  disabled={toggling === key}
                  className="transition-colors"
                >
                  {flag.enabled ? (
                    <ToggleRight className="w-10 h-10 text-primary" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-muted-foreground/40" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
        <strong>Важно:</strong> отключённые функции будут скрыты из интерфейса для всех пользователей.
        Данные при этом не удаляются. Переключатель «Telegram через VPN» применяется мгновенно, без перезапуска сервера.
      </div>
    </div>
  );
}
