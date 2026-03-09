'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Link2, RefreshCw, ShieldCheck, ExternalLink, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, MonitorPlay } from 'lucide-react';
import { toast } from 'sonner';

type Integration = {
    id: string;
    provider: string;
    accountEmail: string | null;
    isActive: boolean;
    lastSynced: string | null;
    conflictsCount: number;
    syncFrom: boolean;
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
            const [integrationsRes, settingsRes] = await Promise.all([getIntegrations(), getSettings()]);

            if (integrationsRes.success && integrationsRes.data) {
                setIntegrations(integrationsRes.data.map((d: any) => ({
                    ...d,
                    lastSynced: d.lastSynced ? new Date(d.lastSynced).toISOString() : null
                })));
            } else if (!integrationsRes.success) {
                toast.error(integrationsRes.error || 'Ошибка при загрузке интеграций');
            }

            if (settingsRes.success && settingsRes.data) {
                const s = settingsRes.data;
                setAutoSync(s.autoSync);
                setBlockConflicts(s.blockConflicts);
            } else if (!settingsRes.success) {
                toast.error(settingsRes.error || 'Ошибка при загрузке настроек');
            }
        } catch (e: any) {
            console.error('fetchData error:', e);
        }
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

    const handleToggleSyncFrom = async (id: string, syncFrom: boolean) => {
        try {
            const { toggleIntegrationSyncFrom } = await import('../actions/settings');
            await toggleIntegrationSyncFrom(id, !syncFrom);
            toast.success(!syncFrom ? 'Импорт событий включён' : 'Импорт событий отключён');
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
        <div className="space-y-8 pb-12 max-w-3xl mx-auto">
            <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Интеграции</h1>
                <p className="text-muted-foreground text-base mt-2">Календари и сервисы видеоконференций</p>
            </div>

            {/* Section: Calendars */}
            <div className="flex items-center gap-3 mt-2">
                <div className="w-8 h-8 rounded-xl border-2 border-primary/30 text-primary bg-transparent flex items-center justify-center"><RefreshCw className="w-4 h-4" /></div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Календари</h2>
            </div>

            {/* Connected */}
            {integrations.length > 0 && (
                <div className="bg-card rounded-3xl border border-border p-6 shadow-sm overflow-hidden">
                    <h2 className="text-xl font-semibold mb-5 flex items-center gap-3 text-foreground tracking-tight">Подключённые</h2>
                    <div className="space-y-4">
                        {integrations.map(i => {
                            const info = providerInfo[i.provider] || { name: i.provider, color: 'bg-gray-500', icon: '📋', description: '' };
                            return (
                                <div key={i.id} className="bg-background rounded-2xl border border-border p-5 shadow-sm hover:border-primary/30 transition-colors">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                        <div className={`w-14 h-14 ${info.color} rounded-2xl flex items-center justify-center text-white text-xl overflow-hidden shrink-0 border border-border/50 shadow-sm`}>
                                            {info.image ? (
                                                <Image src={info.image} alt={info.name} width={56} height={56} className="w-full h-full object-cover" />
                                            ) : (
                                                info.icon
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold text-base text-foreground flex items-center gap-2">
                                                {info.name}
                                                {i.isActive && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                                            </div>
                                            {i.accountEmail && <div className="text-sm font-medium text-muted-foreground mt-0.5">{i.accountEmail}</div>}
                                            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-semibold text-muted-foreground">
                                                {i.lastSynced && <span><RefreshCw className="w-3.5 h-3.5 inline mr-1.5" />Синхр. {new Date(i.lastSynced).toLocaleDateString('ru-RU')}</span>}
                                                {i.conflictsCount > 0 && <span className="text-destructive bg-destructive/10 px-2 py-1 rounded-md">{i.conflictsCount} конфликтов</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-3 mt-4 sm:mt-0 w-full sm:w-auto">
                                            <button
                                                onClick={() => handleSync(i.provider)}
                                                disabled={syncing === i.provider || !i.isActive}
                                                className="px-4 py-2 text-sm font-semibold bg-secondary text-secondary-foreground rounded-xl hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 flex-1 sm:flex-none"
                                            >
                                                {syncing === i.provider ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <RefreshCw className="w-4 h-4" />
                                                )}
                                                Синхр.
                                            </button>
                                            <button onClick={() => handleToggle(i.id, i.isActive)}
                                                className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ${i.isActive ? 'bg-primary' : 'bg-muted'}`}>
                                                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${i.isActive ? 'left-[30px]' : 'left-1'}`} />
                                            </button>
                                        </div>
                                    </div>
                                    {/* Import Events Toggle */}
                                    {i.isActive && (
                                        <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between">
                                            <div>
                                                <div className="text-sm font-bold text-foreground">Импортировать события</div>
                                                <div className="text-xs font-medium text-muted-foreground mt-0.5">Блокировать свободное время событиями из этого календаря</div>
                                            </div>
                                            <button
                                                onClick={() => handleToggleSyncFrom(i.id, i.syncFrom)}
                                                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${i.syncFrom ? 'bg-primary' : 'bg-muted'}`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-transform ${i.syncFrom ? 'left-[22px]' : 'left-1'}`} />
                                            </button>
                                        </div>
                                    )}
                                    {/* Disconnect button */}
                                    <div className="mt-4 pt-4 border-t border-border/40 flex justify-end">
                                        <button
                                            onClick={() => handleDisconnect(i.id, i.provider)}
                                            className="text-sm font-semibold text-destructive/80 hover:text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-lg transition-colors"
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
            <div className="bg-card rounded-3xl border border-border p-6 shadow-sm overflow-hidden">
                <h2 className="text-xl font-semibold mb-5 flex items-center gap-3 text-foreground tracking-tight">Доступные интеграции</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {availableProviders.map(p => {
                        const info = providerInfo[p] || { name: p, color: 'bg-gray-500', icon: '📋', description: '' };
                        return (
                            <div key={p} className="bg-background rounded-2xl border border-border p-6 hover:border-primary/30 transition-colors shadow-sm flex flex-col h-full">
                                <div className={`w-14 h-14 ${info.color} rounded-2xl flex items-center justify-center text-white text-xl mb-4 overflow-hidden border border-border/50 shadow-sm`}>
                                    {info.image ? (
                                        <Image src={info.image} alt={info.name} width={56} height={56} className="w-full h-full object-cover" />
                                    ) : (
                                        info.icon
                                    )}
                                </div>
                                <h3 className="font-bold text-lg text-foreground mb-2">{info.name}</h3>
                                <p className="text-sm font-medium text-muted-foreground mb-6 flex-1">{info.description}</p>
                                <button
                                    onClick={() => handleConnect(p)}
                                    className="w-full px-5 py-3 min-h-[44px] bg-primary text-primary-foreground rounded-xl text-sm font-semibold shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                                >
                                    {p === 'google' ? (
                                        <><ExternalLink className="w-5 h-5" />Авторизоваться</>
                                    ) : (
                                        <><Link2 className="w-5 h-5" />Подключить</>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Section: Video Conferencing */}
            <div className="flex items-center gap-3 mt-4">
                <div className="w-8 h-8 rounded-xl border-2 border-accent/30 text-accent bg-transparent flex items-center justify-center"><MonitorPlay className="w-4 h-4" /></div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Видеоконференции</h2>
            </div>

            <div className="bg-card rounded-3xl border border-border p-6 shadow-sm overflow-hidden">
                <p className="text-sm font-medium text-muted-foreground mb-5">Подключите сервис видеоконференций для автоматического создания ссылок на встречи</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        { name: 'Zoom', image: '/images/zoom.svg', color: 'bg-[#2D8CFF]', desc: 'Автоматическое создание Zoom-встреч' },
                        { name: 'Google Meet', image: '/images/google meet.svg', color: 'bg-white', desc: 'Встречи через Google Meet' },
                        { name: 'Яндекс Телемост', image: '/images/telemost.svg', color: 'bg-white', desc: 'Встречи через Яндекс Телемост' },
                    ].map(vc => (
                        <div key={vc.name} className="bg-background rounded-2xl border border-border p-5 flex flex-col items-center text-center relative overflow-hidden">
                            <div className="absolute top-3 right-3">
                                <span className="text-[10px] font-bold bg-accent/10 text-accent px-2 py-1 rounded-lg">Скоро</span>
                            </div>
                            <div className={`w-12 h-12 ${vc.color} rounded-2xl flex items-center justify-center text-white text-xl mb-3 shadow-sm overflow-hidden border border-border/50`}>
                                <Image src={vc.image} alt={vc.name} width={48} height={48} className="w-full h-full object-contain p-1" />
                            </div>
                            <h3 className="font-bold text-sm text-foreground mb-1">{vc.name}</h3>
                            <p className="text-xs font-medium text-muted-foreground mb-4">{vc.desc}</p>
                            <button disabled className="w-full px-4 py-2.5 min-h-[40px] bg-muted text-muted-foreground rounded-xl text-sm font-semibold cursor-not-allowed opacity-60">
                                В разработке
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Yandex Connection Modal */}
            {showYandexForm && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowYandexForm(false)}>
                    <div className="bg-card rounded-3xl shadow-2xl max-w-md w-full p-8" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-[#FC3F1D] rounded-2xl flex items-center justify-center text-white overflow-hidden border border-border/50 shadow-sm">
                                <Image src="/icons/yandex-calendar.svg" alt="Yandex" width={48} height={48} className="w-full h-full object-cover" />
                            </div>
                            <h3 className="text-2xl font-bold tracking-tight text-foreground">Яндекс Календарь</h3>
                        </div>

                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="text-sm text-amber-800 dark:text-amber-400">
                                    <p className="font-bold mb-2">Требуется пароль приложения</p>
                                    <ol className="list-decimal ml-5 space-y-1.5 font-medium">
                                        <li>Перейдите в <a href="https://id.yandex.ru/security/app-passwords" target="_blank" rel="noreferrer" className="underline font-bold text-amber-700 dark:text-amber-300">Пароли приложений</a> Яндекс ID</li>
                                        <li>Создайте пароль типа «Календарь»</li>
                                        <li>Используйте его для входа ниже</li>
                                    </ol>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-semibold text-foreground/80 ml-1">Яндекс логин (email)</label>
                                <input
                                    type="email"
                                    value={yandexLogin}
                                    onChange={e => setYandexLogin(e.target.value)}
                                    placeholder="user@yandex.ru"
                                    className="w-full mt-2 px-4 py-3 min-h-[48px] border border-border rounded-xl bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring/50 transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-foreground/80 ml-1">Пароль приложения</label>
                                <div className="relative mt-2">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={yandexPassword}
                                        onChange={e => setYandexPassword(e.target.value)}
                                        placeholder="Пароль приложения от Яндекса"
                                        className="w-full px-4 py-3 min-h-[48px] border border-border rounded-xl bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring/50 pr-12 transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 mt-8">
                            <button
                                onClick={() => setShowYandexForm(false)}
                                className="w-full sm:w-1/2 px-4 py-3 min-h-[48px] bg-secondary text-secondary-foreground rounded-xl text-sm font-semibold hover:bg-secondary/80 transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleYandexConnect}
                                disabled={yandexConnecting || !yandexLogin || !yandexPassword}
                                className="w-full sm:w-1/2 px-4 py-3 min-h-[48px] bg-primary text-primary-foreground rounded-xl text-sm font-semibold shadow-sm hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                                {yandexConnecting ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" />Вход...</>
                                ) : (
                                    <>Подключить</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sync Settings */}
            <div className="bg-card rounded-3xl border border-border p-6 shadow-sm overflow-hidden">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-3 text-foreground tracking-tight">
                    <div className="w-10 h-10 rounded-2xl border-2 border-primary/30 text-primary bg-transparent flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    Настройки синхронизации
                </h2>
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-base font-semibold text-foreground">Автоматическая синхронизация</div>
                            <div className="text-sm font-medium text-muted-foreground mt-1">Синхронизировать события при создании или изменении</div>
                        </div>
                        <button
                            disabled={updatingSettings}
                            onClick={() => handleToggleSetting('autoSync', autoSync)}
                            className={`relative w-14 h-8 rounded-full transition-colors shrink-0 disabled:opacity-50 ${autoSync ? 'bg-primary' : 'bg-muted'}`}
                        >
                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${autoSync ? 'left-[30px]' : 'left-1'}`} />
                        </button>
                    </div>
                    <div className="h-px bg-border/50" />
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-base font-semibold text-foreground">Блокировка конфликтов</div>
                            <div className="text-sm font-medium text-muted-foreground mt-1">Блокировать слоты при конфликтах с внешним календарём</div>
                        </div>
                        <button
                            disabled={updatingSettings}
                            onClick={() => handleToggleSetting('blockConflicts', blockConflicts)}
                            className={`relative w-14 h-8 rounded-full transition-colors shrink-0 disabled:opacity-50 ${blockConflicts ? 'bg-primary' : 'bg-muted'}`}
                        >
                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${blockConflicts ? 'left-[30px]' : 'left-1'}`} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
