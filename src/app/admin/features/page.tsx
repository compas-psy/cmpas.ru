'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ToggleRight, ToggleLeft, RefreshCw } from 'lucide-react';

type FeatureFlag = { enabled: boolean; label: string; category: string };

const CATEGORY_TITLES: Record<string, string> = {
  features: 'Функции',
  network: 'Сеть и подключение',
};

export default function FeaturesPage() {
  const [flags, setFlags] = useState<Record<string, FeatureFlag>>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { getFeatureFlags } = await import('../actions/features');
      const data = await getFeatureFlags();
      setFlags(data);
    } catch { toast.error('Ошибка загрузки'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (key: string, enabled: boolean) => {
    setToggling(key);
    try {
      const { setFeatureFlag } = await import('../actions/features');
      await setFeatureFlag(key, enabled);
      setFlags(prev => ({ ...prev, [key]: { ...prev[key], enabled } }));
      toast.success(`${flags[key]?.label}: ${enabled ? 'Включено' : 'Выключено'}`);
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
