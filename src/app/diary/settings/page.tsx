'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, Clock, Video, MapPin, AlertCircle, Eye, CreditCard, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import AddressAutocomplete from '@/components/ui/address-autocomplete';

type Settings = {
    timezone: string;
    defaultSessionDuration: number;
    sessionBreak: number;
    onlineSessionLink: string;
    officeAddress: string;
    cancellationHours: number;
    cancellationFee: number;
    cancellationText: string;
    notifyTelegram: boolean;
    notifyAds: boolean;
    blockConflicts: boolean;
};

type Address = {
    id: string;
    name: string;
    address: string;
};

const timezones = [
    { value: 'Pacific/Midway', label: 'Мидуэй (GMT-11)' },
    { value: 'Pacific/Honolulu', label: 'Гавайи (GMT-10)' },
    { value: 'America/Anchorage', label: 'Аляска (GMT-9)' },
    { value: 'America/Los_Angeles', label: 'Лос-Анджелес (GMT-8)' },
    { value: 'America/Denver', label: 'Денвер (GMT-7)' },
    { value: 'America/Chicago', label: 'Чикаго (GMT-6)' },
    { value: 'America/New_York', label: 'Нью-Йорк (GMT-5)' },
    { value: 'America/Caracas', label: 'Каракас (GMT-4)' },
    { value: 'America/Argentina/Buenos_Aires', label: 'Буэнос-Айрес (GMT-3)' },
    { value: 'Atlantic/South_Georgia', label: 'Южная Георгия (GMT-2)' },
    { value: 'Atlantic/Azores', label: 'Азорские острова (GMT-1)' },
    { value: 'Europe/London', label: 'Лондон (GMT+0)' },
    { value: 'Europe/Berlin', label: 'Берлин (GMT+1)' },
    { value: 'Europe/Kyiv', label: 'Киев (GMT+2)' },
    { value: 'Europe/Istanbul', label: 'Стамбул (GMT+3)' },
    { value: 'Europe/Moscow', label: 'Москва (GMT+3)' },
    { value: 'Europe/Minsk', label: 'Минск (GMT+3)' },
    { value: 'Asia/Tbilisi', label: 'Тбилиси (GMT+4)' },
    { value: 'Asia/Dubai', label: 'Дубай (GMT+4)' },
    { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (GMT+5)' },
    { value: 'Asia/Tashkent', label: 'Ташкент (GMT+5)' },
    { value: 'Asia/Almaty', label: 'Алматы (GMT+6)' },
    { value: 'Asia/Omsk', label: 'Омск (GMT+6)' },
    { value: 'Asia/Novosibirsk', label: 'Новосибирск (GMT+7)' },
    { value: 'Asia/Bangkok', label: 'Бангкок (GMT+7)' },
    { value: 'Asia/Krasnoyarsk', label: 'Красноярск (GMT+7)' },
    { value: 'Asia/Irkutsk', label: 'Иркутск (GMT+8)' },
    { value: 'Asia/Shanghai', label: 'Пекин, Шанхай (GMT+8)' },
    { value: 'Asia/Makassar', label: 'Бали (GMT+8)' },
    { value: 'Asia/Tokyo', label: 'Токио (GMT+9)' },
    { value: 'Asia/Yakutsk', label: 'Якутск (GMT+9)' },
    { value: 'Australia/Sydney', label: 'Сидней (GMT+10)' },
    { value: 'Asia/Vladivostok', label: 'Владивосток (GMT+10)' },
    { value: 'Asia/Magadan', label: 'Магадан (GMT+11)' },
    { value: 'Asia/Kamchatka', label: 'Камчатка (GMT+12)' },
    { value: 'Pacific/Auckland', label: 'Окленд (GMT+12)' },
];

export default function SettingsPage() {
    const [settings, setSettings] = useState<Settings>({
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        defaultSessionDuration: 50,
        sessionBreak: 15,
        onlineSessionLink: '',
        officeAddress: '',
        cancellationHours: 24,
        cancellationFee: 50,
        cancellationText: '',
        notifyTelegram: true,
        notifyAds: false,
        blockConflicts: true,
    });
    const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [newAddress, setNewAddress] = useState({ name: '', address: '' });
    const [addingAddress, setAddingAddress] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const fetchSettings = useCallback(async () => {
        try {
            const { getSettings, getAddresses } = await import('../actions/settings');
            const [settingsRes, addrsRes, trialRes] = await Promise.all([
                getSettings(),
                getAddresses(),
                fetch('/api/billing/status').then(r => r.json()).catch(() => null),
            ]);
            if (trialRes?.daysLeft !== undefined) setTrialDaysLeft(trialRes.daysLeft);

            if (settingsRes.success && settingsRes.data) {
                const data = settingsRes.data;
                setSettings({
                    timezone: data.timezone,
                    defaultSessionDuration: data.defaultSessionDuration,
                    sessionBreak: data.sessionBreak ?? 15,
                    onlineSessionLink: data.onlineSessionLink || '',
                    officeAddress: data.officeAddress || '',
                    cancellationHours: data.cancellationHours,
                    cancellationFee: data.cancellationFee,
                    cancellationText: data.cancellationText || '',
                    notifyTelegram: (data as any).notifyTelegram !== false,
                    notifyAds: settings.notifyAds,
                    blockConflicts: (data as any).blockConflicts !== false,
                });
            } else if (!settingsRes.success) {
                toast.error(settingsRes.error || 'Ошибка при загрузке настроек');
            }

            const { getAdsConsentForUser } = await import('../actions/settings');
            const adsRes = await getAdsConsentForUser();
            if (adsRes.success) {
                setSettings(s => ({ ...s, notifyAds: !!adsRes.isAccepted }));
            }

            if (addrsRes.success && addrsRes.data) {
                setAddresses(addrsRes.data);
            } else if (!addrsRes.success) {
                toast.error(addrsRes.error || 'Ошибка при загрузке адресов');
            }
        } catch (e: any) {
            console.error('fetchSettings error:', e);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchSettings(); }, [fetchSettings]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const { updateSettings, toggleAdsConsentForUser } = await import('../actions/settings');
            await Promise.all([
                updateSettings(settings),
                toggleAdsConsentForUser(settings.notifyAds)
            ]);
            toast.success('Настройки сохранены');
        } catch { toast.error('Ошибка при сохранении'); }
        setSaving(false);
    };

    const handleAddAddress = async () => {
        if (!newAddress.name || !newAddress.address) return;
        setAddingAddress(true);
        try {
            const { createAddress } = await import('../actions/settings');
            await createAddress(newAddress);
            toast.success('Кабинет добавлен');
            setNewAddress({ name: '', address: '' });
            fetchSettings();
        } catch {
            toast.error('Ошибка добавления');
        }
        setAddingAddress(false);
    };

    const handleDeleteAddress = async (id: string) => {
        try {
            const { deleteAddress } = await import('../actions/settings');
            await deleteAddress(id);
            toast.success('Кабинет удален');
            fetchSettings();
        } catch {
            toast.error('Ошибка удаления');
        }
    };

    const [activeTab, setActiveTab] = useState('profile');

    const tabs = [
        { id: 'profile', icon: '👤', label: 'Профиль' },
        { id: 'time', icon: '🕐', label: 'Время и язык' },
        { id: 'offices', icon: '📍', label: 'Офлайн-кабинеты' },
        { id: 'cancellation', icon: '⚠️', label: 'Правила отмены' },
        { id: 'billing', icon: '💳', label: 'Подписка' },
        { id: 'security', icon: '🔒', label: 'Безопасность' },
        { id: 'export', icon: '📦', label: 'Экспорт данных' },
    ];

    if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="pb-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Настройки</h1>
                    <p className="text-muted-foreground text-sm mt-1">Управляйте параметрами кабинета и расписания</p>
                </div>
                <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-forest-700 transition-all text-sm font-bold shadow-card active:scale-[0.97] disabled:opacity-50">
                    <Save className="w-4 h-4" />{saving ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Left: Sidebar Tabs */}
                <div className="w-full lg:w-[220px] shrink-0">
                    <nav className="bg-card border border-border rounded-2xl p-2 shadow-card space-y-0.5 lg:sticky lg:top-4">
                        {tabs.map(t => (
                            <button key={t.id} onClick={() => setActiveTab(t.id)}
                                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all text-left ${activeTab === t.id ? 'bg-primary/10 text-forest-700' : 'text-muted-foreground hover:bg-sage-50 hover:text-foreground'}`}>
                                <span className="text-[15px]">{t.icon}</span>
                                {t.label}
                                {t.id === activeTab && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Right: Content */}
                <div className="flex-1 min-w-0 space-y-5">

                    {activeTab === 'profile' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* Profile Card */}
                            <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
                                <div className="flex items-center justify-between mb-5">
                                    <h2 className="text-lg font-bold text-foreground">Профиль кабинета</h2>
                                    <button className="text-[13px] font-semibold text-primary hover:text-forest-800 transition-colors">Редактировать</button>
                                </div>
                                <div className="flex items-center gap-4 mb-5">
                                    <div className="w-14 h-14 rounded-full bg-sage-100 flex items-center justify-center text-xl font-bold text-forest-700 border-2 border-sage-200 uppercase shrink-0">ИМ</div>
                                    <div>
                                        <div className="text-[16px] font-bold text-foreground">Мартынов Илья <span className="text-[11px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded ml-1">Основной</span></div>
                                        <div className="text-[13px] text-muted-foreground">Психолог, гештальт-терапевт</div>
                                    </div>
                                </div>
                                <div className="space-y-2 text-[13px]">
                                    <div className="flex items-center gap-3 text-muted-foreground"><span className="font-semibold text-foreground/70 w-24">ИНН</span> —</div>
                                    <div className="flex items-center gap-3 text-muted-foreground"><span className="font-semibold text-foreground/70 w-24">Публичная ссылка</span> <a href="#" className="text-primary hover:underline">compas.ru/...</a></div>
                                </div>
                            </div>

                            {/* Billing Widget */}
                            <Link href="/billing" className="block bg-card border border-border rounded-2xl p-5 shadow-card hover:border-primary/40 transition-all group">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[15px] font-bold text-foreground">Подписка и оплата</p>
                                        <p className="text-[13px] text-muted-foreground">
                                            {trialDaysLeft === null ? 'Пробный период' : trialDaysLeft > 0 ? `Осталось ${trialDaysLeft} дн.` : 'Завершён'}
                                        </p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                            </Link>
                        </div>
                    )}

                    {activeTab === 'time' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <div className="bg-card rounded-2xl border border-border p-6 shadow-card lg:col-span-2">
                                <h2 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2"><Clock className="w-5 h-5 text-muted-foreground" /> Время и язык</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[13px] font-semibold text-muted-foreground mb-2">Часовой пояс</label>
                                        <select value={settings.timezone} onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))}
                                            className="w-full px-4 py-3 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none text-sm font-medium">
                                            {timezones.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                                            {!timezones.some(tz => tz.value === settings.timezone) && <option value={settings.timezone}>{settings.timezone}</option>}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-semibold text-muted-foreground mb-2">Формат времени</label>
                                        <select value={(settings as any).timeFormat !== '12h' ? '24h' : '12h'} onChange={e => setSettings(s => ({ ...s, timeFormat: e.target.value } as any))}
                                            className="w-full px-4 py-3 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none text-sm font-medium">
                                            <option value="24h">24 часа (14:00)</option><option value="12h">AM/PM (2:00 PM)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-semibold text-muted-foreground mb-2">Формат даты</label>
                                        <select value={(settings as any).dateFormat === 'MM/dd/yyyy' ? 'MM/dd/yyyy' : 'dd.MM.yyyy'} onChange={e => setSettings(s => ({ ...s, dateFormat: e.target.value } as any))}
                                            className="w-full px-4 py-3 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none text-sm font-medium">
                                            <option value="dd.MM.yyyy">ДД.ММ.ГГГГ</option><option value="MM/dd/yyyy">ММ/ДД/ГГГГ</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-semibold text-muted-foreground mb-2">Начало недели</label>
                                        <select value={(settings as any).weekStartsOn === 'sunday' ? 'sunday' : 'monday'} onChange={e => setSettings(s => ({ ...s, weekStartsOn: e.target.value } as any))}
                                            className="w-full px-4 py-3 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none text-sm font-medium">
                                            <option value="monday">Понедельник</option><option value="sunday">Воскресенье</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-card rounded-2xl border border-border p-6 shadow-card">
                                <h2 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2"><Video className="w-5 h-5 text-muted-foreground" /> Форматы сессий</h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[13px] font-semibold text-muted-foreground mb-2">Длительность по умолчанию</label>
                                        <select value={settings.defaultSessionDuration} onChange={e => setSettings(s => ({ ...s, defaultSessionDuration: Number(e.target.value) }))}
                                            className="w-full px-4 py-3 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none text-sm font-medium">
                                            <option value={50}>50 минут</option><option value={60}>60 минут</option><option value={80}>80 минут</option><option value={90}>90 минут</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-semibold text-muted-foreground mb-2">Перерыв по умолчанию</label>
                                        <select value={settings.sessionBreak} onChange={e => setSettings(s => ({ ...s, sessionBreak: Number(e.target.value) }))}
                                            className="w-full px-4 py-3 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none text-sm font-medium">
                                            <option value={0}>Без перерыва</option><option value={10}>10 минут</option><option value={15}>15 минут</option><option value={30}>30 минут</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-card rounded-2xl border border-border p-6 shadow-card">
                                <h2 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2"><Video className="w-5 h-5 text-muted-foreground" /> Ссылка и уведомления</h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[13px] font-semibold text-muted-foreground mb-2">Ссылка для онлайн-сессий</label>
                                        <input type="text" value={settings.onlineSessionLink} onChange={e => setSettings(s => ({ ...s, onlineSessionLink: e.target.value }))}
                                            placeholder="https://zoom.us/j/..." className="w-full px-4 py-3 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none text-sm" />
                                    </div>
                                    <div className="space-y-3 pt-2">
                                        {[
                                            { key: 'notifyTelegram', label: 'Telegram уведомления психологу', desc: 'Получать напоминания о предстоящих сессиях (за 24 часа)', checked: settings.notifyTelegram },
                                            { key: 'blockConflicts', label: 'Блокировать занятые слоты из календаря', desc: 'События из Google / Яндекс Календаря автоматически закрывают время', checked: settings.blockConflicts },
                                            { key: 'notifyAds', label: 'Согласие на рекламные рассылки', desc: 'Получать подборки статей, анонсы и программы от партнеров', checked: settings.notifyAds },
                                        ].map(opt => (
                                            <label key={opt.key} className="flex items-start gap-3 cursor-pointer group">
                                                <div className={`w-10 h-[22px] rounded-full transition-colors shrink-0 mt-0.5 relative cursor-pointer ${opt.checked ? 'bg-primary' : 'bg-border'}`}
                                                    onClick={() => setSettings(s => ({ ...s, [opt.key]: !opt.checked } as any))}>
                                                    <div className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${opt.checked ? 'translate-x-[20px]' : 'translate-x-[2px]'}`} />
                                                </div>
                                                <div>
                                                    <div className="text-[13px] font-bold text-foreground">{opt.label}</div>
                                                    <div className="text-[11px] text-muted-foreground">{opt.desc}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'offices' && (
                        <div className="bg-card rounded-2xl border border-border p-6 shadow-card">
                            <h2 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2"><MapPin className="w-5 h-5 text-muted-foreground" /> Офлайн-кабинеты</h2>
                            <div className="space-y-4">
                                {addresses.length === 0 ? (
                                    <div className="bg-muted/30 rounded-2xl p-6 text-center border border-dashed border-border"><p className="text-sm text-muted-foreground">У вас пока нет добавленных кабинетов</p></div>
                                ) : (
                                    <div className="space-y-3">
                                        {addresses.map(a => (
                                            <div key={a.id} className={`flex justify-between items-center p-4 bg-background border rounded-2xl group ${(a as any).isPrimary ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <button onClick={async () => { try { const { setPrimaryAddress } = await import('../actions/settings'); await setPrimaryAddress(a.id); toast.success('Основной кабинет'); fetchSettings(); } catch { toast.error('Ошибка'); } }}
                                                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${(a as any).isPrimary ? 'border-primary bg-primary' : 'border-muted-foreground/40 hover:border-primary'}`}>
                                                        {(a as any).isPrimary && <div className="w-2 h-2 rounded-full bg-white" />}
                                                    </button>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-sm text-foreground flex items-center gap-2">{a.name}{(a as any).isPrimary && <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">Основной</span>}</p>
                                                        <p className="text-sm text-muted-foreground truncate">{a.address}</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleDeleteAddress(a.id)} className="text-destructive text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 rounded-lg hover:bg-red-50 ml-2">⋮</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex flex-col md:flex-row gap-3 pt-4 border-t border-border/50">
                                    <input type="text" value={newAddress.name} onChange={e => setNewAddress(a => ({ ...a, name: e.target.value }))} placeholder="Название кабинета" className="flex-1 px-4 py-3 text-sm border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none" />
                                    <div className="flex-[2]"><AddressAutocomplete value={newAddress.address} onChange={(val) => setNewAddress(a => ({ ...a, address: val }))} className="w-full px-4 py-3 text-sm border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Адрес кабинета" /></div>
                                    <button onClick={handleAddAddress} disabled={addingAddress || !newAddress.name || !newAddress.address}
                                        className="px-6 py-3 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-forest-700 transition-all disabled:opacity-50">Добавить</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'cancellation' && (
                        <div className="bg-card rounded-2xl border border-border p-6 shadow-card">
                            <h2 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-muted-foreground" /> Правила отмены</h2>
                            <div className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="block text-[13px] font-semibold text-muted-foreground mb-2">Без штрафа до (часов)</label>
                                        <input type="number" value={settings.cancellationHours} onChange={e => setSettings(s => ({ ...s, cancellationHours: Number(e.target.value) }))} className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm" min={0} /></div>
                                    <div><label className="block text-[13px] font-semibold text-muted-foreground mb-2">Удержание при поздней отмене (%)</label>
                                        <input type="number" value={settings.cancellationFee} onChange={e => setSettings(s => ({ ...s, cancellationFee: Number(e.target.value) }))} className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm" min={0} max={100} /></div>
                                </div>
                                <div><label className="block text-[13px] font-semibold text-muted-foreground mb-2">Текст правил для клиента</label>
                                    <textarea value={settings.cancellationText || ''} onChange={e => setSettings(s => ({ ...s, cancellationText: e.target.value }))} rows={4}
                                        className="w-full px-4 py-3 bg-background border border-border rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none text-sm resize-none" placeholder="Опишите ваши условия отмены..." /></div>
                                <button onClick={() => setShowPreview(!showPreview)} className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-forest-800"><Eye className="w-4 h-4" />{showPreview ? 'Скрыть' : 'Предпросмотр'}</button>
                                {showPreview && (
                                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5"><h4 className="font-bold text-sm mb-2">Отмена сеанса</h4><p className="text-sm text-foreground/80 leading-relaxed">{settings.cancellationText || `Бесплатная отмена за ${settings.cancellationHours}ч. При поздней отмене удержание ${settings.cancellationFee}%.`}</p></div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div className="bg-card rounded-2xl border border-border p-6 shadow-card">
                            <h2 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2"><CreditCard className="w-5 h-5 text-muted-foreground" /> Подписка</h2>
                            <Link href="/billing" className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-sage-50 transition-colors">
                                <div><div className="text-[14px] font-bold">Пробный период</div><div className="text-[12px] text-muted-foreground">{trialDaysLeft !== null ? `Осталось ${trialDaysLeft} дней` : 'Загрузка...'}</div></div>
                                <span className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold">Выбрать тариф</span>
                            </Link>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="bg-card rounded-2xl border border-border p-6 shadow-card"><h2 className="text-lg font-bold text-foreground mb-5">🔒 Безопасность</h2><p className="text-sm text-muted-foreground">Управление доступом — в разработке.</p></div>
                    )}

                    {activeTab === 'export' && (
                        <div className="bg-card rounded-2xl border border-border p-6 shadow-card"><h2 className="text-lg font-bold text-foreground mb-5">📦 Экспорт данных</h2><p className="text-sm text-muted-foreground">Выгрузка данных — в разработке.</p></div>
                    )}

                </div>
            </div>
        </div>
    );
}
