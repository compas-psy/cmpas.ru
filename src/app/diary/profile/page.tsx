'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, Mail, Save, Briefcase, Camera } from 'lucide-react';
import { toast } from 'sonner';

const METHODS = [
    "КПТ (Когнитивно-поведенческая терапия)",
    "Гештальт-терапия",
    "Психоанализ",
    "Эмоционально-фокусированная терапия",
    "Экзистенциальная терапия",
    "Клиент-центрированная терапия",
    "Схема-терапия",
    "EMDR (ДПДГ)",
    "Семейная системная терапия",
    "Юнгианский анализ",
    "Транзактный анализ",
    "Телесно-ориентированная терапия",
    "Арт-терапия",
    "Сказкотерапия",
];

type ProfileData = {
    fullName: string;
    email: string;
    image: string | null;
    methods: string[];
    basePrice: number | null;
};

export default function ProfilePage() {
    const [profile, setProfile] = useState<ProfileData>({
        fullName: '',
        email: '',
        image: null,
        methods: [],
        basePrice: null,
    });
    const [customMethod, setCustomMethod] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchProfile = useCallback(async () => {
        try {
            const { getProfile } = await import('../actions/settings');
            const res = await getProfile();
            if (res.success && res.data) {
                setProfile(res.data);
            } else {
                toast.error('Ошибка загрузки профиля');
            }
        } catch {
            toast.error('Ошибка загрузки профиля');
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchProfile(); }, [fetchProfile]);

    const handleMethodToggle = (method: string) => {
        setProfile(prev => ({
            ...prev,
            methods: prev.methods.includes(method)
                ? prev.methods.filter(m => m !== method)
                : [...prev.methods, method]
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const allMethods = [...profile.methods];
            if (customMethod.trim() && !allMethods.includes(customMethod.trim())) {
                allMethods.push(customMethod.trim());
            }
            const { updateProfile } = await import('../actions/settings');
            await updateProfile({
                fullName: profile.fullName,
                methods: allMethods,
                basePrice: profile.basePrice,
            });
            toast.success('Профиль сохранён');
            setCustomMethod('');
            fetchProfile();
        } catch {
            toast.error('Ошибка сохранения');
        }
        setSaving(false);
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-8 pb-12 max-w-3xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Мой профиль</h1>
                    <p className="text-muted-foreground text-base mt-2">Личные данные и специализация</p>
                </div>
                <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-primary text-primary-foreground rounded-xl hover:bg-forest-700 transition-all text-sm font-semibold shadow-card active:scale-[0.98] disabled:opacity-50">
                    <Save className="w-4 h-4" />{saving ? 'Сохранение...' : 'Сохранить'}
                </button>
            </div>

            {/* Avatar and Name */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-card overflow-hidden">
                <h2 className="text-xl font-semibold mb-5 flex items-center gap-3 text-foreground tracking-tight">
                    <div className="w-10 h-10 rounded-xl bg-sage-100 text-forest-700 flex items-center justify-center">
                        <User className="w-5 h-5" />
                    </div>
                    Основная информация
                </h2>
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                    {/* Avatar */}
                    <div className="relative group">
                        <div className="w-24 h-24 rounded-2xl bg-muted flex items-center justify-center overflow-hidden border-2 border-border shadow-sm">
                            {profile.image ? (
                                <img src={profile.image} alt="Аватар" className="w-full h-full object-cover" />
                            ) : (
                                <Camera className="w-8 h-8 text-muted-foreground" />
                            )}
                        </div>
                    </div>
                    <div className="flex-1 space-y-4 w-full">
                        <div>
                            <label className="block text-sm font-semibold mb-2 ml-1 text-foreground/90">Фамилия и Имя</label>
                            <input
                                type="text"
                                value={profile.fullName}
                                onChange={e => setProfile(p => ({ ...p, fullName: e.target.value }))}
                                placeholder="Иванова Анна"
                                className="w-full px-4 py-3 min-h-[48px] border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 bg-background text-sm font-medium transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-2 ml-1 text-foreground/90 flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5" /> Email
                            </label>
                            <input
                                type="email"
                                value={profile.email}
                                disabled
                                className="w-full px-4 py-3 min-h-[48px] border border-border rounded-xl bg-muted/50 text-sm font-medium text-muted-foreground cursor-not-allowed"
                            />
                            <p className="text-xs text-muted-foreground mt-1.5 ml-1">Email обновляется через настройки аккаунта</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Methods */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-card overflow-hidden">
                <h2 className="text-xl font-semibold mb-5 flex items-center gap-3 text-foreground tracking-tight">
                    <div className="w-10 h-10 rounded-2xl bg-orange-soft text-orange-500 flex items-center justify-center">
                        <Briefcase className="w-5 h-5" />
                    </div>
                    Методы работы
                </h2>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {METHODS.map(method => (
                            <label key={method} className="flex items-center gap-3 cursor-pointer group p-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={profile.methods.includes(method)}
                                    onChange={() => handleMethodToggle(method)}
                                />
                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${profile.methods.includes(method) ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'}`}>
                                    {profile.methods.includes(method) && (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                    )}
                                </div>
                                <span className={`text-sm font-medium ${profile.methods.includes(method) ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
                                    {method}
                                </span>
                            </label>
                        ))}
                    </div>
                    {/* Custom methods (not in the list) */}
                    {profile.methods.filter(m => !METHODS.includes(m)).length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                            {profile.methods.filter(m => !METHODS.includes(m)).map(m => (
                                <span key={m} className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-sm font-semibold">
                                    {m}
                                    <button onClick={() => handleMethodToggle(m)} className="hover:text-destructive transition-colors">✕</button>
                                </span>
                            ))}
                        </div>
                    )}
                    <input
                        type="text"
                        placeholder="Добавить свой метод..."
                        value={customMethod}
                        onChange={e => setCustomMethod(e.target.value)}
                        className="w-full px-4 py-2.5 border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm font-medium transition-all placeholder:text-muted-foreground/50"
                    />
                </div>
            </div>

            {/* Pricing */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-card overflow-hidden">
                <h2 className="text-xl font-semibold mb-5 flex items-center gap-3 text-foreground tracking-tight">
                    <div className="w-10 h-10 rounded-xl bg-sage-100 text-forest-700 flex items-center justify-center">
                        <span className="text-lg font-bold">₽</span>
                    </div>
                    Стоимость
                </h2>
                <div>
                    <label className="block text-sm font-semibold mb-2 ml-1 text-foreground/90">Базовая стоимость сессии (₽)</label>
                    <div className="relative max-w-xs">
                        <input
                            type="number"
                            min="0"
                            step="100"
                            value={profile.basePrice || ''}
                            onChange={e => setProfile(p => ({ ...p, basePrice: parseInt(e.target.value) || 0 }))}
                            placeholder="5000"
                            className="w-full px-4 py-3 pr-10 min-h-[48px] border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm font-medium transition-all"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₽</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
