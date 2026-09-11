'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, Clock, Video, MapPin, AlertCircle, Eye, CreditCard, ChevronRight, User } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import AddressAutocomplete from '@/components/ui/address-autocomplete';
import { CabinetCard } from './CabinetCard';

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

/** Что показывает карточка профиля. Ровно то, что приходит с сервера. */
type ProfileCard = {
    fullName: string;
    email: string;
    methods: string[];
};

/** Готовый вывод сервера об оплате — экран его не пересчитывает. */
type BillingState = {
    daysLeft: number | null;
    isExpired: boolean;
    isForever: boolean;
    subscriptionActive: boolean;
    subscriptionEndsAt: string | null;
    trialActive: boolean;
};

/** Инициалы из настоящего имени, а не две буквы, вписанные в вёрстку. */
function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '—';
    return parts.slice(0, 2).map(p => p[0]).join('');
}

function billingTitle(billing: BillingState | null): string {
    if (!billing) return 'Загрузка…';
    if (billing.isForever) return 'Бесплатный доступ';
    if (billing.subscriptionActive) return 'Подписка активна';
    if (billing.trialActive) return 'Пробный период';
    if (billing.isExpired) return 'Подписка закончилась';
    return 'Подписка';
}

function billingSubtitle(billing: BillingState | null): string {
    if (!billing) return '';
    if (billing.isForever) return 'Бессрочно, без оплаты';
    if (billing.subscriptionActive && billing.subscriptionEndsAt) {
        return `Действует до ${new Date(billing.subscriptionEndsAt).toLocaleDateString('ru-RU')}`;
    }
    if (billing.trialActive && billing.daysLeft !== null) {
        const d = billing.daysLeft;
        const word = d % 100 >= 11 && d % 100 <= 14 ? 'дней' : d % 10 === 1 ? 'день' : d % 10 >= 2 && d % 10 <= 4 ? 'дня' : 'дней';
        return `Осталось ${d} ${word}`;
    }
    if (billing.isExpired) return 'Оформите подписку, чтобы продолжить работу';
    return 'Состояние оплаты';
}

type Address = {
    id: string;
    name: string;
    address: string;
    isPrimary?: boolean;
    isActive?: boolean;
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
    // Состояние оплаты приходит с сервера готовым выводом: «активна» — это
    // про срок, а не про факт оплаты когда-то (src/lib/billing/status.ts).
    const [billing, setBilling] = useState<BillingState | null>(null);
    // Профиль показывается настоящий — тот, кто вошёл.
    const [profile, setProfile] = useState<ProfileCard>({ fullName: '', email: '', methods: [] });
    const [bookingLink, setBookingLink] = useState<string | null>(null);
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
                // Настройки — единственное место, где выведенные кабинеты
                // тоже видны: их нужно показать и дать вернуть в работу.
                getAddresses({ includeInactive: true }),
                fetch('/api/billing/status').then(r => r.json()).catch(() => null),
            ]);
            if (trialRes) setBilling(trialRes as BillingState);

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

            // Карточка профиля берёт те же данные, что и страница правки:
            // два источника для одного и того же имени разойдутся молча.
            const { getProfile } = await import('../actions/settings');
            const profileRes = await getProfile();
            if (profileRes.success && profileRes.data) {
                setProfile({
                    fullName: profileRes.data.fullName || '',
                    email: profileRes.data.email || '',
                    methods: profileRes.data.methods || [],
                });
            }

            const { getPublicBookingLink } = await import('../actions/settings');
            const linkRes = await getPublicBookingLink().catch(() => null);
            if (linkRes?.success && linkRes.url) setBookingLink(linkRes.url);

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

    // Задача 18 §5/§6: «убрать» кабинет — это вывод из работы, а не удаление
    // строки, и он не проходит, пока на кабинет ссылаются активные правила.
    // Причину отказа показываем как есть — она объясняет, что делать.
    const handleDeactivateAddress = async (id: string) => {
        try {
            const { deactivateAddress } = await import('../actions/settings');
            await deactivateAddress(id);
            toast.success('Кабинет выведен из работы');
            fetchSettings();
        } catch (e: any) {
            toast.error(e?.message || 'Не удалось вывести кабинет из работы');
        }
    };

    const handleActivateAddress = async (id: string) => {
        try {
            const { activateAddress } = await import('../actions/settings');
            await activateAddress(id);
            toast.success('Кабинет снова в работе');
            fetchSettings();
        } catch (e: any) {
            toast.error(e?.message || 'Ошибка');
        }
    };

    const handleUpdateAddress = async (id: string, data: { name: string; address: string }) => {
        try {
            const { updateAddress } = await import('../actions/settings');
            await updateAddress(id, data);
            toast.success('Кабинет обновлён');
            fetchSettings();
        } catch (e: any) {
            toast.error(e?.message || 'Ошибка сохранения');
        }
    };

    const handleSetPrimaryAddress = async (id: string) => {
        try {
            const { setPrimaryAddress } = await import('../actions/settings');
            await setPrimaryAddress(id);
            toast.success('Основной кабинет');
            fetchSettings();
        } catch (e: any) {
            toast.error(e?.message || 'Ошибка');
        }
    };

    const [activeTab, setActiveTab] = useState('profile');

    // Иконки те же, что в левом меню кабинета: тот же набор (lucide), тот же
    // размер и та же толщина линии. Эмодзи здесь выбивались — они рисуются
    // шрифтом системы, у каждой платформы свой, и рядом со строгим меню
    // выглядели наклейками, а не частью интерфейса.
    // РАЗДЕЛЫ НАЗЫВАЮТ ТО, ЧТО В НИХ ЛЕЖИТ.
    //
    // Было «Время и язык», и внутри — часовой пояс, длительность сессии,
    // ссылка на видеовстречу и три тумблера про разное: уведомления,
    // календарь и рекламные рассылки. Ссылке на встречу в разделе про время
    // делать нечего, а тумблеры разного смысла в одной карточке читаются как
    // один набор.
    //
    // Убраны «Безопасность» и «Экспорт данных»: оба были пустыми, с
    // подписью «в разработке». Пустой раздел «Безопасность» — худший из
    // возможных: человек читает его как «здесь ничего нет», а речь о
    // защите его клиентских записей. Про данные теперь сказано там, где это
    // правда, — в «Данных и конфиденциальности».
    const tabs = [
        { id: 'profile', icon: User, label: 'Профиль' },
        { id: 'sessions', icon: Video, label: 'Сессии' },
        { id: 'time', icon: Clock, label: 'Время' },
        { id: 'offices', icon: MapPin, label: 'Офлайн-кабинеты' },
        { id: 'cancellation', icon: AlertCircle, label: 'Правила отмены' },
        { id: 'billing', icon: CreditCard, label: 'Подписка' },
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
                        {tabs.map(t => {
                            const Icon = t.icon;
                            const active = activeTab === t.id;
                            return (
                                <button key={t.id} onClick={() => setActiveTab(t.id)}
                                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all text-left ${active ? 'bg-primary/10 text-forest-700' : 'text-muted-foreground hover:bg-sage-50 hover:text-foreground'}`}>
                                    {/* Толщина линии меняется у выбранного пункта — тем же
                                        приёмом, что в левом меню (sidebar-nav). */}
                                    <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={active ? 2 : 1.5} />
                                    {t.label}
                                    {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Right: Content */}
                <div className="flex-1 min-w-0 space-y-5">

                    {activeTab === 'profile' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* КАРТОЧКА ПОКАЗЫВАЕТ ТОГО, КТО ВОШЁЛ.
                                Раньше здесь стояли «Мартынов Илья», «Психолог,
                                гештальт-терапевт», «ИНН —» и ссылка
                                «compas.ru/...», ведущая в никуда (href="#"), —
                                нарисованный профиль одного человека, который
                                видели все. Кнопка «Редактировать» не делала
                                ничего: обработчика у неё не было вовсе. */}
                            <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
                                <div className="flex items-center justify-between mb-5">
                                    <h2 className="text-lg font-bold text-foreground">Профиль</h2>
                                    <Link href="/diary/profile" className="text-[13px] font-semibold text-primary hover:text-forest-800 transition-colors">
                                        Редактировать
                                    </Link>
                                </div>
                                <div className="flex items-center gap-4 mb-5">
                                    <div className="w-14 h-14 rounded-full bg-sage-100 flex items-center justify-center text-xl font-bold text-forest-700 border-2 border-sage-200 uppercase shrink-0">
                                        {initials(profile.fullName)}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[16px] font-bold text-foreground truncate">
                                            {profile.fullName || 'Имя не указано'}
                                        </div>
                                        <div className="text-[13px] text-muted-foreground truncate">
                                            {profile.methods.length > 0 ? profile.methods.join(', ') : 'Специализация не указана'}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2 text-[13px]">
                                    <div className="flex items-center gap-3 text-muted-foreground">
                                        <span className="font-semibold text-foreground/70 w-24 shrink-0">Почта</span>
                                        <span className="truncate">{profile.email || '—'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-muted-foreground">
                                        <span className="font-semibold text-foreground/70 w-24 shrink-0">Ссылка для записи</span>
                                        {bookingLink ? (
                                            <a href={bookingLink} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">
                                                {bookingLink.replace(/^https?:\/\//, '')}
                                            </a>
                                        ) : <span>—</span>}
                                    </div>
                                </div>
                                {/* Почта и способ входа живут в Экосистеме СИМПАС:
                                    продукт их получает, а не хранит, и полем для
                                    правки притворяться им нельзя. */}
                                <p className="text-[12px] text-muted-foreground mt-4 leading-relaxed">
                                    Почта и способ входа хранятся в Экосистеме СИМПАС — их меняют там.
                                    Имя и специализация остаются в ПРАКТИКЕ.
                                </p>
                            </div>

                            {/* Рекламное согласие — это согласие, а не настройка
                                уведомлений: оно жило среди тумблеров про календарь
                                и видеосвязь, где его смысл терялся. */}
                            <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
                                <h2 className="text-lg font-bold text-foreground mb-5">Согласия</h2>
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <div className={`w-10 h-[22px] rounded-full transition-colors shrink-0 mt-0.5 relative cursor-pointer ${settings.notifyAds ? 'bg-primary' : 'bg-border'}`}
                                        onClick={() => setSettings(s => ({ ...s, notifyAds: !s.notifyAds }))}>
                                        <div className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${settings.notifyAds ? 'translate-x-[20px]' : 'translate-x-[2px]'}`} />
                                    </div>
                                    <div>
                                        <div className="text-[13px] font-bold text-foreground">Рекламные рассылки</div>
                                        <div className="text-[11px] text-muted-foreground">Подборки статей, анонсы и программы. Необязательно, отзывается в любой момент</div>
                                    </div>
                                </label>
                                <Link href="/diary/documents" className="mt-5 flex items-center justify-between p-3 rounded-xl border border-border hover:bg-sage-50 transition-colors">
                                    <span className="text-[13px] font-semibold text-foreground">Документы и принятые версии</span>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                </Link>
                            </div>
                        </div>
                    )}

                    {activeTab === 'sessions' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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

                            {/* Ссылка на встречу переехала сюда из «Времени и языка»:
                                это параметр сессии, а не часового пояса. */}
                            <div className="bg-card rounded-2xl border border-border p-6 shadow-card">
                                <h2 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2"><Video className="w-5 h-5 text-muted-foreground" /> Онлайн-встречи</h2>
                                <label className="block text-[13px] font-semibold text-muted-foreground mb-2">Ссылка для онлайн-сессий</label>
                                <input type="text" value={settings.onlineSessionLink} onChange={e => setSettings(s => ({ ...s, onlineSessionLink: e.target.value }))}
                                    placeholder="https://telemost.yandex.ru/j/..." className="w-full px-4 py-3 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none text-sm" />
                                <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed">
                                    Уходит клиенту в подтверждении записи и в напоминаниях. Пустое поле — ссылки в сообщении не будет.
                                </p>

                                <div className="mt-5 pt-5 border-t border-border">
                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <div className={`w-10 h-[22px] rounded-full transition-colors shrink-0 mt-0.5 relative cursor-pointer ${settings.blockConflicts ? 'bg-primary' : 'bg-border'}`}
                                            onClick={() => setSettings(s => ({ ...s, blockConflicts: !s.blockConflicts }))}>
                                            <div className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${settings.blockConflicts ? 'translate-x-[20px]' : 'translate-x-[2px]'}`} />
                                        </div>
                                        <div>
                                            <div className="text-[13px] font-bold text-foreground">Закрывать время из календаря</div>
                                            <div className="text-[11px] text-muted-foreground">События из Google и Яндекс Календаря не дают записаться на занятый час</div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'time' && (
                        <div className="bg-card rounded-2xl border border-border p-6 shadow-card">
                            <h2 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2"><Clock className="w-5 h-5 text-muted-foreground" /> Часовой пояс</h2>
                            <select value={settings.timezone} onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))}
                                className="w-full max-w-md px-4 py-3 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none text-sm font-medium">
                                {timezones.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                                {!timezones.some(tz => tz.value === settings.timezone) && <option value={settings.timezone}>{settings.timezone}</option>}
                            </select>
                            {/* Пояс — не украшение расписания: по нему считается, в
                                котором часу уходят сообщения клиенту. */}
                            <p className="text-[12px] text-muted-foreground mt-3 leading-relaxed max-w-md">
                                По этому поясу считается ваше расписание и время, в которое уходят сообщения клиентам.
                            </p>

                            {/* УБРАНЫ ТРИ ВЫБОРА: формат времени, формат даты и
                                начало недели. Они не сохранялись нигде — ни в
                                схеме, ни в действии updateSettings: человек менял
                                их, нажимал «Сохранить», видел «Настройки
                                сохранены» и получал прежнее при следующем
                                открытии. */}
                            <div className="mt-6 pt-5 border-t border-border">
                                <Link href="/diary/notifications" className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-sage-50 transition-colors">
                                    <div>
                                        <div className="text-[14px] font-bold text-foreground">Уведомления</div>
                                        <div className="text-[12px] text-muted-foreground">Что и когда получают вы и ваши клиенты</div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                </Link>
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
                                            <CabinetCard
                                                key={a.id}
                                                cabinet={a}
                                                onSetPrimary={handleSetPrimaryAddress}
                                                onSave={handleUpdateAddress}
                                                onDeactivate={handleDeactivateAddress}
                                                onActivate={handleActivateAddress}
                                            />
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
                                        <input type="number" value={settings.cancellationFee} onChange={e => setSettings(s => ({ ...s, cancellationFee: Number(e.target.value) }))} className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm" min={0} max={100} />
                                        <p className="mt-2 text-[12px] text-muted-foreground leading-relaxed">ПРАКТИКА не принимает оплату и ничего не удерживает — это ваша договорённость с клиентом. Число хранится как памятка и в текст правил само не подставляется.</p></div>
                                </div>
                                <div><label className="block text-[13px] font-semibold text-muted-foreground mb-2">Текст правил для клиента</label>
                                    <textarea value={settings.cancellationText || ''} onChange={e => setSettings(s => ({ ...s, cancellationText: e.target.value }))} rows={4}
                                        className="w-full px-4 py-3 bg-background border border-border rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none text-sm resize-none" placeholder="Опишите ваши условия отмены..." /></div>
                                <button onClick={() => setShowPreview(!showPreview)} className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-forest-800"><Eye className="w-4 h-4" />{showPreview ? 'Скрыть' : 'Предпросмотр'}</button>
                                {showPreview && (
                                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5"><h4 className="font-bold text-sm mb-2">Отмена сеанса</h4><p className="text-sm text-foreground/80 leading-relaxed">{settings.cancellationText || `Отмена без вопросов за ${settings.cancellationHours}ч до начала. Позже — напишите мне, договоримся.`}</p></div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div className="bg-card rounded-2xl border border-border p-6 shadow-card">
                            <h2 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2"><CreditCard className="w-5 h-5 text-muted-foreground" /> Подписка</h2>
                            {/* Состояние пришло с сервера готовым: раньше здесь
                                всегда было написано «Пробный период» — и тому,
                                кто платит второй год, тоже. */}
                            <Link href="/billing" className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-sage-50 transition-colors">
                                <div>
                                    <div className="text-[14px] font-bold">{billingTitle(billing)}</div>
                                    <div className="text-[12px] text-muted-foreground">{billingSubtitle(billing)}</div>
                                </div>
                                <span className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold shrink-0 ml-3">
                                    {billing?.subscriptionActive || billing?.isForever ? 'Открыть' : 'Оформить'}
                                </span>
                            </Link>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
