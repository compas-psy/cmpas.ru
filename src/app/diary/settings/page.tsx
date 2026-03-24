'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, Clock, Video, MapPin, AlertCircle, Eye } from 'lucide-react';
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
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [newAddress, setNewAddress] = useState({ name: '', address: '' });
    const [addingAddress, setAddingAddress] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const fetchSettings = useCallback(async () => {
        try {
            const { getSettings, getAddresses } = await import('../actions/settings');
            const [settingsRes, addrsRes] = await Promise.all([getSettings(), getAddresses()]);

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

    if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-5 pb-8 max-w-3xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground">Настройки</h1>
                    <p className="text-muted-foreground text-sm mt-1">Параметры вашего кабинета и расписания</p>
                </div>
                <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all text-sm font-semibold shadow-sm active:scale-[0.98] disabled:opacity-50">
                    <Save className="w-4 h-4" />{saving ? 'Сохранение...' : 'Сохранить'}
                </button>
            </div>

            {/* Timezone */}
            <div className="bg-card rounded-3xl border border-border p-4 md:p-6 shadow-sm overflow-hidden">
                <h2 className="text-base md:text-xl font-semibold mb-4 flex items-center gap-2.5 text-foreground tracking-tight">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-2xl border-2 border-primary/30 text-primary bg-transparent flex items-center justify-center">
                        <Clock className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    Часовой пояс
                </h2>
                <div className="space-y-3">
                    <label className="text-sm font-semibold text-foreground/80 ml-1">Текущий часовой пояс</label>
                    <select value={settings.timezone} onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))}
                        className="w-full px-4 py-3 min-h-[48px] border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm font-medium text-foreground transition-all">
                        {timezones.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                        {/* Если текущий TZ не в списке, показать его */}
                        {!timezones.some(tz => tz.value === settings.timezone) && (
                            <option value={settings.timezone}>{settings.timezone}</option>
                        )}
                    </select>
                    <button
                        type="button"
                        onClick={() => {
                            const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
                            setSettings(s => ({ ...s, timezone: detected }));
                            toast.success(`Определён: ${detected}`);
                        }}
                        className="text-sm font-semibold text-primary hover:text-primary/70 transition-colors flex items-center gap-1.5 ml-1"
                    >
                        <Clock className="w-3.5 h-3.5" /> Определить автоматически
                    </button>
                </div>
            </div>

            {/* Date & Time Format */}
            <div className="bg-card rounded-3xl border border-border p-4 md:p-6 shadow-sm overflow-hidden">
                <h2 className="text-base md:text-xl font-semibold mb-4 flex items-center gap-2.5 text-foreground tracking-tight">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-2xl border-2 border-primary/30 text-primary bg-transparent flex items-center justify-center">
                        <Clock className="w-5 h-5" />
                    </div>
                    Формат даты и времени
                </h2>
                <div className="space-y-5">
                    <div>
                        <label className="text-sm font-semibold text-foreground/80 ml-1 mb-2 block">Формат времени</label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setSettings(s => ({ ...s, timeFormat: '24h' } as any))}
                                className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors min-h-[44px] ${(settings as any).timeFormat !== '12h' ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border text-foreground hover:border-primary/50'}`}
                            >24 часа (14:00)</button>
                            <button
                                type="button"
                                onClick={() => setSettings(s => ({ ...s, timeFormat: '12h' } as any))}
                                className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors min-h-[44px] ${(settings as any).timeFormat === '12h' ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border text-foreground hover:border-primary/50'}`}
                            >AM/PM (2:00 PM)</button>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-foreground/80 ml-1 mb-2 block">Формат даты</label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setSettings(s => ({ ...s, dateFormat: 'dd.MM.yyyy' } as any))}
                                className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors min-h-[44px] ${(settings as any).dateFormat !== 'MM/dd/yyyy' ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border text-foreground hover:border-primary/50'}`}
                            >ДД.ММ.ГГГГ</button>
                            <button
                                type="button"
                                onClick={() => setSettings(s => ({ ...s, dateFormat: 'MM/dd/yyyy' } as any))}
                                className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors min-h-[44px] ${(settings as any).dateFormat === 'MM/dd/yyyy' ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border text-foreground hover:border-primary/50'}`}
                            >ММ/ДД/ГГГГ</button>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-foreground/80 ml-1 mb-2 block">Начало недели</label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setSettings(s => ({ ...s, weekStartsOn: 'monday' } as any))}
                                className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors min-h-[44px] ${(settings as any).weekStartsOn !== 'sunday' ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border text-foreground hover:border-primary/50'}`}
                            >Понедельник</button>
                            <button
                                type="button"
                                onClick={() => setSettings(s => ({ ...s, weekStartsOn: 'sunday' } as any))}
                                className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors min-h-[44px] ${(settings as any).weekStartsOn === 'sunday' ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border text-foreground hover:border-primary/50'}`}
                            >Воскресенье</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Рабочий процесс и Уведомления */}
            <div className="bg-card rounded-3xl border border-border shadow-sm p-6 space-y-6">
                <div className="flex items-center gap-3 border-b border-border/50 pb-4">
                    <Video className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-bold tracking-tight">Рабочий процесс и Уведомления</h2>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold mb-2 ml-1 text-foreground/90">Ссылка для онлайн-сессий</label>
                        <input
                            type="text"
                            value={settings.onlineSessionLink}
                            onChange={e => setSettings(s => ({ ...s, onlineSessionLink: e.target.value }))}
                            placeholder="https://zoom.us/j/..."
                            className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 bg-background transition-all font-medium text-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-2 ml-1 leading-relaxed">
                            Вставьте сюда постоянную ссылку на вашу переговорку из Zoom, Google Meet или Яндекс.Телемост.<br/>
                            Клиенты увидят её в своем расписании и в напоминаниях перед сессией.
                        </p>
                    </div>
                    <div className="pt-2">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={settings.notifyTelegram}
                                onChange={e => setSettings(s => ({ ...s, notifyTelegram: e.target.checked }))}
                                className="w-5 h-5 rounded border-border text-primary focus:ring-primary/50 transition-all cursor-pointer"
                            />
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-foreground/90 group-hover:text-primary transition-colors">Telegram уведомления психологу</span>
                                <span className="text-xs font-medium text-muted-foreground">Получать напоминания о предстоящих сессиях (за 24 часа)</span>
                            </div>
                        </label>
                    </div>
                    <div className="pt-2">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={settings.blockConflicts}
                                onChange={e => setSettings(s => ({ ...s, blockConflicts: e.target.checked }))}
                                className="w-5 h-5 rounded border-border text-primary focus:ring-primary/50 transition-all cursor-pointer"
                            />
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-foreground/90 group-hover:text-primary transition-colors">Блокировать занятые слоты из календаря</span>
                                <span className="text-xs font-medium text-muted-foreground">События из Google / Яндекс Календаря автоматически закрывают соответствующее время для записи</span>
                            </div>
                        </label>
                    </div>
                    <div className="pt-2">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={settings.notifyAds}
                                onChange={e => setSettings(s => ({ ...s, notifyAds: e.target.checked }))}
                                className="w-5 h-5 rounded border-border text-accent focus:ring-accent/50 transition-all cursor-pointer"
                            />
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-foreground/90 group-hover:text-accent transition-colors">Согласие на рекламные рассылки</span>
                                <span className="text-xs font-medium text-muted-foreground">Получать подборки статей, анонсы супервизий и программ от партнеров</span>
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Session Formats (remaining parts) */}
            <div className="bg-card rounded-3xl border border-border p-4 md:p-6 shadow-sm overflow-hidden">
                <h2 className="text-base md:text-xl font-semibold mb-4 flex items-center gap-2.5 text-foreground tracking-tight">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-2xl border-2 border-accent/30 text-accent bg-transparent flex items-center justify-center">
                        <Video className="w-5 h-5" />
                    </div>
                    Форматы сессий
                </h2>
                <div className="space-y-6">
                    <div>
                        <label className="text-sm font-semibold text-foreground/80 mb-2 ml-1">Временные интервалы по умолчанию</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <select value={settings.defaultSessionDuration} onChange={e => setSettings(s => ({ ...s, defaultSessionDuration: Number(e.target.value) }))}
                                className="w-full px-4 py-3 min-h-[48px] border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm font-medium transition-all">
                                <option value={50}>Длительность 50 мин</option>
                                <option value={60}>Длительность 60 мин</option>
                                <option value={80}>Длительность 80 мин</option>
                                <option value={90}>Длительность 90 мин</option>
                            </select>
                            <select value={settings.sessionBreak} onChange={e => setSettings(s => ({ ...s, sessionBreak: Number(e.target.value) }))}
                                className="w-full px-4 py-3 min-h-[48px] border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm font-medium transition-all">
                                <option value={0}>Без перерыва</option>
                                <option value={10}>Перерыв 10 мин</option>
                                <option value={15}>Перерыв 15 мин</option>
                                <option value={30}>Перерыв 30 мин</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cabinets / Addresses */}
            <div className="bg-card rounded-3xl border border-border p-4 md:p-6 shadow-sm overflow-hidden">
                <h2 className="text-base md:text-xl font-semibold mb-4 flex items-center gap-2.5 text-foreground tracking-tight">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-2xl border-2 border-primary/30 text-primary bg-transparent flex items-center justify-center">
                        <MapPin className="w-5 h-5" />
                    </div>
                    Офлайн кабинеты
                </h2>
                <div className="space-y-4">
                    {addresses.length === 0 ? (
                        <div className="bg-muted/30 rounded-2xl p-6 text-center border border-border/50">
                            <p className="text-sm font-medium text-muted-foreground">У вас пока нет добавленных кабинетов</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {addresses.map(a => (
                                <div key={a.id} className={`flex justify-between items-center p-4 bg-background border rounded-2xl transition-colors group shadow-sm ${(a as any).isPrimary ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const { setPrimaryAddress } = await import('../actions/settings');
                                                    await setPrimaryAddress(a.id);
                                                    toast.success('Основной кабинет установлен');
                                                    fetchSettings();
                                                } catch {
                                                    toast.error('Ошибка');
                                                }
                                            }}
                                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${(a as any).isPrimary ? 'border-primary bg-primary' : 'border-muted-foreground/40 hover:border-primary'}`}
                                            title={(a as any).isPrimary ? 'Основной кабинет' : 'Сделать основным'}
                                        >
                                            {(a as any).isPrimary && <div className="w-2 h-2 rounded-full bg-white" />}
                                        </button>
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm text-foreground flex items-center gap-2">
                                                {a.name}
                                                {(a as any).isPrimary && <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">основной</span>}
                                            </p>
                                            <p className="text-sm font-medium text-muted-foreground mt-0.5 truncate">{a.address}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDeleteAddress(a.id)} className="text-destructive text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity bg-destructive/10 hover:bg-destructive/20 px-3 py-2 rounded-xl ml-2 shrink-0">Удалить</button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="pt-6 mt-6 border-t border-border/50">
                        <label className="text-sm font-semibold mb-3 block text-foreground/80 ml-1">Новый кабинет</label>
                        <div className="space-y-3">
                            <input type="text" value={newAddress.name} onChange={e => setNewAddress(a => ({ ...a, name: e.target.value }))} placeholder="Название (например, Центр на Тверской)" className="w-full px-4 py-3 min-h-[48px] text-sm font-medium bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 transition-all" />
                            <div className="flex flex-col md:flex-row gap-3">
                                <div className="flex-[2]">
                                    <AddressAutocomplete
                                        value={newAddress.address}
                                        onChange={(val) => setNewAddress(a => ({ ...a, address: val }))}
                                        className="w-full px-4 py-3 min-h-[48px] text-sm font-medium bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 transition-all"
                                        placeholder="Начните вводить адрес..."
                                    />
                                </div>
                                <button onClick={handleAddAddress} disabled={addingAddress || !newAddress.name || !newAddress.address} className="md:w-auto w-full px-6 py-3 min-h-[48px] bg-primary text-primary-foreground text-sm font-semibold rounded-xl shadow-sm hover:bg-primary/90 transition-all disabled:opacity-50 active:scale-[0.98]">
                                    Добавить
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cancellation Policy */}
            <div className="bg-card rounded-3xl border border-border p-4 md:p-6 shadow-sm overflow-hidden">
                <h2 className="text-base md:text-xl font-semibold mb-4 flex items-center gap-2.5 text-foreground tracking-tight">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-2xl border-2 border-destructive/30 text-destructive bg-transparent flex items-center justify-center">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                    Правила отмены
                </h2>
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-semibold text-foreground/80 mb-2 block ml-1">Без штрафа за часов до отмены</label>
                            <input type="number" value={settings.cancellationHours} onChange={e => setSettings(s => ({ ...s, cancellationHours: Number(e.target.value) }))}
                                className="w-full px-4 py-3 min-h-[48px] bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm font-medium transition-all" min={0} />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-foreground/80 mb-2 block ml-1">Удержание при поздней отмене (%)</label>
                            <input type="number" value={settings.cancellationFee} onChange={e => setSettings(s => ({ ...s, cancellationFee: Number(e.target.value) }))}
                                className="w-full px-4 py-3 min-h-[48px] bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm font-medium transition-all" min={0} max={100} />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-foreground/80 mb-2 block ml-1">Свой текст правил для клиента</label>
                        <textarea value={settings.cancellationText || ''} onChange={e => setSettings(s => ({ ...s, cancellationText: e.target.value }))} rows={4}
                            className="w-full px-4 py-3 bg-background border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm font-medium resize-none transition-all placeholder:text-muted-foreground/50"
                            placeholder="Опишите ваши условия отмены (например, штраф ₽1000)..." />
                    </div>
                    <div>
                        <button onClick={() => setShowPreview(!showPreview)} className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/70 transition-colors ml-1">
                            <Eye className="w-4 h-4" />{showPreview ? 'Скрыть предпросмотр' : 'Взглянуть глазами клиента'}
                        </button>
                        {showPreview && (
                            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 mt-4 transition-all animate-in fade-in zoom-in-95 duration-200">
                                <h4 className="font-bold text-sm mb-2 text-foreground">Отмена сеанса</h4>
                                <p className="text-sm text-foreground/80 leading-relaxed font-medium">
                                    {settings.cancellationText || `Вы можете бесплатно отменить или перенести сессию не позднее чем за ${settings.cancellationHours} часов. При отмене менее чем за ${settings.cancellationHours} часов удерживается ${settings.cancellationFee}% от стоимости сеанса.`}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
