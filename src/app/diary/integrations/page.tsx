'use client';

import { useState, useEffect, useCallback } from 'react';
import { Link2, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

type Integration = { id: string; provider: string; accountEmail: string | null; isActive: boolean; lastSynced: string | null; conflictsCount: number };

const providerInfo: Record<string, { name: string; color: string; icon: string }> = {
    google: { name: 'Google Calendar', color: 'bg-blue-500', icon: '📅' },
    yandex: { name: 'Яндекс Календарь', color: 'bg-red-500', icon: '📆' },
    apple: { name: 'Apple Calendar', color: 'bg-gray-800', icon: '🍎' },
};

export default function IntegrationsPage() {
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            const { getIntegrations } = await import('../actions/settings');
            const data = await getIntegrations();
            setIntegrations(data.map((d: { id: string; provider: string; accountEmail: string | null; isActive: boolean; lastSynced: Date | null; conflictsCount: number }) => ({ ...d, lastSynced: d.lastSynced ? new Date(d.lastSynced).toISOString() : null })));
        } catch { /* */ }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleConnect = (provider: string) => {
        toast.info(`Интеграция с ${providerInfo[provider]?.name || provider} — в разработке`);
    };

    const handleToggle = async (id: string, isActive: boolean) => {
        try {
            const { toggleIntegration } = await import('../actions/settings');
            await toggleIntegration(id, !isActive);
            toast.success(isActive ? 'Отключено' : 'Включено');
            fetchData();
        } catch { toast.error('Ошибка'); }
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

    const availableProviders = ['google', 'yandex', 'apple'].filter(p => !integrations.some(i => i.provider === p));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-semibold">Интеграции</h1>
                <p className="text-muted-foreground text-sm mt-1">Подключите внешние календари</p>
            </div>

            {/* Connected */}
            {integrations.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold mb-3">Подключённые</h2>
                    <div className="space-y-3">
                        {integrations.map(i => {
                            const info = providerInfo[i.provider] || { name: i.provider, color: 'bg-gray-500', icon: '📋' };
                            return (
                                <div key={i.id} className="bg-white rounded-lg border border-border p-5 flex items-center gap-4">
                                    <div className={`w-12 h-12 ${info.color} rounded-xl flex items-center justify-center text-white text-xl`}>{info.icon}</div>
                                    <div className="flex-1">
                                        <div className="font-medium">{info.name}</div>
                                        {i.accountEmail && <div className="text-sm text-muted-foreground">{i.accountEmail}</div>}
                                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                            {i.lastSynced && <span><RefreshCw className="w-3 h-3 inline mr-1" />Синхр. {new Date(i.lastSynced).toLocaleDateString('ru-RU')}</span>}
                                            {i.conflictsCount > 0 && <span className="text-destructive">{i.conflictsCount} конфликтов</span>}
                                        </div>
                                    </div>
                                    <button onClick={() => handleToggle(i.id, i.isActive)}
                                        className={`relative w-12 h-6 rounded-full transition-colors ${i.isActive ? 'bg-primary' : 'bg-muted'}`}>
                                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${i.isActive ? 'left-[26px]' : 'left-0.5'}`} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Available */}
            <div>
                <h2 className="text-lg font-semibold mb-3">Доступные интеграции</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(availableProviders.length === 0 ? ['google', 'yandex', 'apple'] : availableProviders).map(p => {
                        const info = providerInfo[p];
                        return (
                            <div key={p} className="bg-white rounded-lg border border-border p-5">
                                <div className={`w-12 h-12 ${info.color} rounded-xl flex items-center justify-center text-white text-xl mb-3`}>{info.icon}</div>
                                <h3 className="font-medium mb-1">{info.name}</h3>
                                <p className="text-xs text-muted-foreground mb-4">Синхронизация событий</p>
                                <button onClick={() => handleConnect(p)} className="w-full px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2">
                                    <Link2 className="w-4 h-4" />Подключить
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Sync Settings */}
            <div className="bg-white rounded-lg border border-border p-5">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" />Настройки синхронизации</h2>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-medium">Автоматическая синхронизация</div>
                            <div className="text-xs text-muted-foreground">Синхронизировать события автоматически</div>
                        </div>
                        <button className="relative w-12 h-6 rounded-full bg-primary"><div className="absolute top-0.5 left-[26px] w-5 h-5 bg-white rounded-full shadow" /></button>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-medium">Блокировка конфликтов</div>
                            <div className="text-xs text-muted-foreground">Блокировать слоты при конфликтах</div>
                        </div>
                        <button className="relative w-12 h-6 rounded-full bg-primary"><div className="absolute top-0.5 left-[26px] w-5 h-5 bg-white rounded-full shadow" /></button>
                    </div>
                </div>
            </div>
        </div>
    );
}
