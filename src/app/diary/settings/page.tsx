'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, Clock, Video, MapPin, AlertCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';

type Settings = {
    timezone: string;
    defaultSessionDuration: number;
    onlineSessionLink: string;
    officeAddress: string;
    cancellationHours: number;
    cancellationFee: number;
    cancellationText: string;
};

const timezones = [
    { value: 'Europe/Moscow', label: 'Москва (GMT+3)' },
    { value: 'Europe/Kyiv', label: 'Киев (GMT+2)' },
    { value: 'Europe/Minsk', label: 'Минск (GMT+3)' },
    { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (GMT+5)' },
    { value: 'Asia/Novosibirsk', label: 'Новосибирск (GMT+7)' },
];

export default function SettingsPage() {
    const [settings, setSettings] = useState<Settings>({
        timezone: 'Europe/Moscow', defaultSessionDuration: 50,
        onlineSessionLink: '', officeAddress: '',
        cancellationHours: 24, cancellationFee: 50, cancellationText: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const fetchSettings = useCallback(async () => {
        try {
            const { getSettings } = await import('../actions/settings');
            const data = await getSettings();
            setSettings({
                timezone: data.timezone, defaultSessionDuration: data.defaultSessionDuration,
                onlineSessionLink: data.onlineSessionLink || '', officeAddress: data.officeAddress || '',
                cancellationHours: data.cancellationHours, cancellationFee: data.cancellationFee,
                cancellationText: data.cancellationText || '',
            });
        } catch { /* */ }
        setLoading(false);
    }, []);

    useEffect(() => { fetchSettings(); }, [fetchSettings]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const { updateSettings } = await import('../actions/settings');
            await updateSettings(settings);
            toast.success('Настройки сохранены');
        } catch { toast.error('Ошибка при сохранении'); }
        setSaving(false);
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-6 max-w-2xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-semibold">Настройки</h1>
                    <p className="text-muted-foreground text-sm mt-1">Параметры вашего кабинета</p>
                </div>
                <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50">
                    <Save className="w-4 h-4" />{saving ? 'Сохранение...' : 'Сохранить'}
                </button>
            </div>

            {/* Timezone */}
            <div className="bg-white rounded-lg border border-border p-5">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-primary" />Часовой пояс</h2>
                <select value={settings.timezone} onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm">
                    {timezones.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                </select>
            </div>

            {/* Session Formats */}
            <div className="bg-white rounded-lg border border-border p-5">
                <h2 className="text-lg font-semibold mb-4">Форматы сессий</h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium mb-2 flex items-center gap-2"><Video className="w-4 h-4 text-primary" />Ссылка для онлайн-сессий</label>
                        <input type="url" value={settings.onlineSessionLink || ''} onChange={e => setSettings(s => ({ ...s, onlineSessionLink: e.target.value }))}
                            className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm mt-1" placeholder="https://zoom.us/..." />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" />Адрес офиса</label>
                        <input type="text" value={settings.officeAddress || ''} onChange={e => setSettings(s => ({ ...s, officeAddress: e.target.value }))}
                            className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm mt-1" placeholder="Москва, ул. Примерная, 1" />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-2">Длительность по умолчанию</label>
                        <select value={settings.defaultSessionDuration} onChange={e => setSettings(s => ({ ...s, defaultSessionDuration: Number(e.target.value) }))}
                            className="w-full px-3 py-2.5 border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm mt-1">
                            <option value={50}>50 мин</option><option value={80}>80 мин</option><option value={90}>90 мин</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Cancellation Policy */}
            <div className="bg-white rounded-lg border border-border p-5">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-accent" />Правила отмены</h2>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">Минимум часов до отмены</label>
                            <input type="number" value={settings.cancellationHours} onChange={e => setSettings(s => ({ ...s, cancellationHours: Number(e.target.value) }))}
                                className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" min={0} />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Процент оплаты (%)</label>
                            <input type="number" value={settings.cancellationFee} onChange={e => setSettings(s => ({ ...s, cancellationFee: Number(e.target.value) }))}
                                className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" min={0} max={100} />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-2 block">Текст правил для клиента</label>
                        <textarea value={settings.cancellationText || ''} onChange={e => setSettings(s => ({ ...s, cancellationText: e.target.value }))} rows={4}
                            className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm resize-none"
                            placeholder="Отмена сессии возможна не позднее чем за 24 часа..." />
                    </div>
                    <button onClick={() => setShowPreview(!showPreview)} className="flex items-center gap-2 text-sm text-primary hover:underline">
                        <Eye className="w-4 h-4" />{showPreview ? 'Скрыть предпросмотр' : 'Предпросмотр для клиента'}
                    </button>
                    {showPreview && (
                        <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 mt-2">
                            <h4 className="font-semibold text-sm mb-2 text-accent">Правила отмены</h4>
                            <p className="text-sm text-foreground/80">
                                {settings.cancellationText || `Отмена сессии возможна не позднее чем за ${settings.cancellationHours} часов. При отмене менее чем за ${settings.cancellationHours} часов взимается ${settings.cancellationFee}% от стоимости сессии.`}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
