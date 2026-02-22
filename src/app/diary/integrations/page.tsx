'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Link2, RefreshCw, ShieldCheck, ExternalLink, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Integration = {
    id: string;
    provider: string;
    accountEmail: string | null;
    isActive: boolean;
    lastSynced: string | null;
    conflictsCount: number;
};

const providerInfo: Record<string, { name: string; color: string; image?: string; icon: string; description: string }> = {
    google: {
        name: 'Google Calendar',
        color: 'bg-white',
        image: '/icons/google-calendar.svg',
        icon: '📅',
        description: 'Синхронизация через OAuth. Нажмите для авторизации через Google.'
    },
    yandex: {
        name: 'Яндекс Календарь',
        color: 'bg-[#FC3F1D]',
        image: '/icons/yandex-calendar.svg',
        icon: '📆',
        description: 'Подключение через пароль приложения Яндекс.'
    },
};

export default function IntegrationsPage() {
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState<string | null>(null);
    const [showYandexForm, setShowYandexForm] = useState(false);
    const [yandexLogin, setYandexLogin] = useState('');
    const [yandexPassword, setYandexPassword] = useState('');
    const [yandexConnecting, setYandexConnecting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [autoSync, setAutoSync] = useState(true);
    const [blockConflicts, setBlockConflicts] = useState(true);
    const [updatingSettings, setUpdatingSettings] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const { getIntegrations, getSettings } = await import('../actions/settings');
            const data = await getIntegrations();
            setIntegrations(data.map((d: { id: string; provider: string; accountEmail: string | null; isActive: boolean; lastSynced: Date | null; conflictsCount: number }) => ({
                ...d,
                lastSynced: d.lastSynced ? new Date(d.lastSynced).toISOString() : null
            })));

            const settings = await getSettings();
            if (settings) {
                setAutoSync(settings.autoSync);
                setBlockConflicts(settings.blockConflicts);
            }
        } catch { /* */ }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Handle URL params (success/error from OAuth callback)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const success = params.get('success');
        const error = params.get('error');

        if (success === 'google') {
            toast.success('Google Calendar подключён!');
            window.history.replaceState({}, '', '/diary/integrations');
            fetchData();
        }
        if (error === 'google_failed') {
            toast.error('Не удалось подключить Google Calendar');
            window.history.replaceState({}, '', '/diary/integrations');
        }
        if (error === 'denied') {
            toast.info('Авторизация отменена');
            window.history.replaceState({}, '', '/diary/integrations');
        }
    }, [fetchData]);

    const handleConnect = (provider: string) => {
        if (provider === 'google') {
            // Redirect to Google OAuth
            window.location.href = '/api/calendar/google/connect';
        } else if (provider === 'yandex') {
            setShowYandexForm(true);
        } else {
            toast.info(`Интеграция с ${providerInfo[provider]?.name || provider} — в разработке`);
        }
    };

    const handleYandexConnect = async () => {
        if (!yandexLogin || !yandexPassword) {
            toast.error('Введите логин и пароль приложения');
            return;
        }
        setYandexConnecting(true);
        try {
            const res = await fetch('/api/calendar/yandex/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login: yandexLogin, password: yandexPassword }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Яндекс Календарь подключён!');
                setShowYandexForm(false);
                setYandexLogin('');
                setYandexPassword('');
                fetchData();
            } else {
                toast.error(data.error || 'Ошибка подключения');
            }
        } catch {
            toast.error('Ошибка сети');
        }
        setYandexConnecting(false);
    };

    const handleSync = async (provider: string) => {
        setSyncing(provider);
        try {
            const res = await fetch('/api/calendar/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Синхронизировано ${data.synced} сессий`);
                fetchData();
            } else {
                toast.error(data.error || 'Ошибка синхронизации');
            }
        } catch {
            toast.error('Ошибка сети');
        }
        setSyncing(null);
    };

    const handleToggle = async (id: string, isActive: boolean) => {
        try {
            const { toggleIntegration } = await import('../actions/settings');
            await toggleIntegration(id, !isActive);
            toast.success(isActive ? 'Отключено' : 'Включено');
            fetchData();
        } catch { toast.error('Ошибка'); }
    };

    const handleDisconnect = async (id: string, provider: string) => {
        try {
            const { disconnectIntegration } = await import('../actions/settings');
            await disconnectIntegration(id);
            toast.success(`${providerInfo[provider]?.name || provider} отключён`);
            fetchData();
        } catch { toast.error('Ошибка'); }
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

    const handleToggleSetting = async (field: 'autoSync' | 'blockConflicts', currentValue: boolean) => {
        setUpdatingSettings(true);
        try {
            const { updateSettings } = await import('../actions/settings');
            const newValue = !currentValue;
            await updateSettings({ [field]: newValue });
            if (field === 'autoSync') setAutoSync(newValue);
            if (field === 'blockConflicts') setBlockConflicts(newValue);
            toast.success('Настройки сохранены');
        } catch {
            toast.error('Ошибка при сохранении');
        }
        setUpdatingSettings(false);
    };

    const connectedProviders = integrations.map(i => i.provider);
    const availableProviders = ['google', 'yandex'].filter(p => !connectedProviders.includes(p));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-semibold">Интеграции</h1>
                <p className="text-muted-foreground text-sm mt-1">Подключите внешние календари для автоматической синхронизации сессий</p>
            </div>

            {/* Connected */}
            {integrations.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold mb-3">Подключённые</h2>
                    <div className="space-y-3">
                        {integrations.map(i => {
                            const info = providerInfo[i.provider] || { name: i.provider, color: 'bg-gray-500', icon: '📋', description: '' };
                            return (
                                <div key={i.id} className="bg-white rounded-lg border border-border p-5">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 ${info.color} rounded-xl flex items-center justify-center text-white text-xl overflow-hidden shrink-0 border border-border/50`}>
                                            {info.image ? (
                                                <Image src={info.image} alt={info.name} width={48} height={48} className="w-full h-full object-cover" />
                                            ) : (
                                                info.icon
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-medium flex items-center gap-2">
                                                {info.name}
                                                {i.isActive && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                            </div>
                                            {i.accountEmail && <div className="text-sm text-muted-foreground">{i.accountEmail}</div>}
                                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                {i.lastSynced && <span><RefreshCw className="w-3 h-3 inline mr-1" />Синхр. {new Date(i.lastSynced).toLocaleDateString('ru-RU')}</span>}
                                                {i.conflictsCount > 0 && <span className="text-destructive">{i.conflictsCount} конфликтов</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleSync(i.provider)}
                                                disabled={syncing === i.provider || !i.isActive}
                                                className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-1"
                                            >
                                                {syncing === i.provider ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <RefreshCw className="w-3 h-3" />
                                                )}
                                                Синхр.
                                            </button>
                                            <button onClick={() => handleToggle(i.id, i.isActive)}
                                                className={`relative w-12 h-6 rounded-full transition-colors ${i.isActive ? 'bg-primary' : 'bg-muted'}`}>
                                                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${i.isActive ? 'left-[26px]' : 'left-0.5'}`} />
                                            </button>
                                        </div>
                                    </div>
                                    {/* Disconnect button */}
                                    <div className="mt-3 pt-3 border-t border-border flex justify-end">
                                        <button
                                            onClick={() => handleDisconnect(i.id, i.provider)}
                                            className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                                        >
                                            Отключить интеграцию
                                        </button>
                                    </div>
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
                    {availableProviders.map(p => {
                        const info = providerInfo[p] || { name: p, color: 'bg-gray-500', icon: '📋', description: '' };
                        return (
                            <div key={p} className="bg-white rounded-lg border border-border p-5">
                                <div className={`w-12 h-12 ${info.color} rounded-xl flex items-center justify-center text-white text-xl mb-3 overflow-hidden border border-border/50`}>
                                    {info.image ? (
                                        <Image src={info.image} alt={info.name} width={48} height={48} className="w-full h-full object-cover" />
                                    ) : (
                                        info.icon
                                    )}
                                </div>
                                <h3 className="font-medium mb-1">{info.name}</h3>
                                <p className="text-xs text-muted-foreground mb-4">{info.description}</p>
                                <button
                                    onClick={() => handleConnect(p)}
                                    className="w-full px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
                                >
                                    {p === 'google' ? (
                                        <><ExternalLink className="w-4 h-4" />Авторизоваться</>
                                    ) : (
                                        <><Link2 className="w-4 h-4" />Подключить</>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Yandex Connection Modal */}
            {showYandexForm && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowYandexForm(false)}>
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-[#FC3F1D] rounded-xl flex items-center justify-center text-white overflow-hidden border border-border/50">
                                <Image src="/icons/yandex-calendar.svg" alt="Yandex" width={40} height={40} className="w-full h-full object-cover" />
                            </div>
                            <h3 className="text-lg font-semibold">Яндекс Календарь</h3>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                                <div className="text-xs text-amber-800">
                                    <p className="font-medium mb-1">Используйте пароль приложения, а не основной пароль!</p>
                                    <ol className="list-decimal ml-4 space-y-1">
                                        <li>Откройте <a href="https://id.yandex.ru/security/app-passwords" target="_blank" rel="noreferrer" className="underline font-medium">Яндекс ID → Пароли приложений</a></li>
                                        <li>Нажмите «Создать пароль приложения»</li>
                                        <li>Выберите тип «Календарь (CalDAV)»</li>
                                        <li>Укажите название «Компас»</li>
                                        <li>Скопируйте пароль и вставьте ниже</li>
                                    </ol>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-sm font-medium text-foreground">Яндекс логин (email)</label>
                                <input
                                    type="email"
                                    value={yandexLogin}
                                    onChange={e => setYandexLogin(e.target.value)}
                                    placeholder="user@yandex.ru"
                                    className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground">Пароль приложения</label>
                                <div className="relative mt-1">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={yandexPassword}
                                        onChange={e => setYandexPassword(e.target.value)}
                                        placeholder="Пароль приложения от Яндекса"
                                        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-5">
                            <button
                                onClick={() => setShowYandexForm(false)}
                                className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleYandexConnect}
                                disabled={yandexConnecting || !yandexLogin || !yandexPassword}
                                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {yandexConnecting ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" />Подключаем...</>
                                ) : (
                                    <>Подключить</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sync Settings */}
            <div className="bg-white rounded-lg border border-border p-5">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" />Настройки синхронизации</h2>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-medium">Автоматическая синхронизация</div>
                            <div className="text-xs text-muted-foreground">Синхронизировать события при создании/изменении сессий</div>
                        </div>
                        <button
                            disabled={updatingSettings}
                            onClick={() => handleToggleSetting('autoSync', autoSync)}
                            className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-50 ${autoSync ? 'bg-primary' : 'bg-muted'}`}
                        >
                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoSync ? 'left-[26px]' : 'left-0.5'}`} />
                        </button>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-medium">Блокировка конфликтов</div>
                            <div className="text-xs text-muted-foreground">Блокировать слоты при конфликтах с внешним календарём</div>
                        </div>
                        <button
                            disabled={updatingSettings}
                            onClick={() => handleToggleSetting('blockConflicts', blockConflicts)}
                            className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-50 ${blockConflicts ? 'bg-primary' : 'bg-muted'}`}
                        >
                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${blockConflicts ? 'left-[26px]' : 'left-0.5'}`} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
