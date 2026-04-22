'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, BellRing, Send, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type NotifSettings = {
    newBookingEnabled: boolean;
    newBookingTemplate: string;
    reminderEnabled: boolean;
    reminderMinutesBefore: number;
    reminderTemplate: string;
    clientRescheduleEnabled: boolean;
    clientCancelEnabled: boolean;
    clientReminder25hEnabled: boolean;
    clientReminder25hTemplate: string;
    clientReminder1hEnabled: boolean;
    clientReminder1hTemplate: string;
    clientPsyCancelEnabled: boolean;
    clientPsyCancelTemplate: string;
};

const REMINDER_INTERVALS = [
    { value: 15, label: '15 минут' },
    { value: 30, label: '30 минут' },
    { value: 60, label: '1 час' },
    { value: 120, label: '2 часа' },
];

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(!value)}
            className={`relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-50 ${value ? 'bg-primary' : 'bg-muted'}`}
        >
            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${value ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
    );
}

function NotifRow({ label, desc, enabled, onToggle, template, onTemplateChange, testType, onTest, children }: {
    label: string; desc: string; enabled: boolean; onToggle: (v: boolean) => void;
    template?: string; onTemplateChange?: (v: string) => void;
    testType?: string; onTest?: (type: string) => void;
    children?: React.ReactNode;
}) {
    return (
        <div className="bg-background rounded-2xl border border-border p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                    <div className="font-semibold text-foreground text-sm">{label}</div>
                    <div className="text-xs font-medium text-muted-foreground mt-0.5">{desc}</div>
                </div>
                <Toggle value={enabled} onChange={onToggle} />
            </div>
            {children}
            {enabled && template !== undefined && onTemplateChange && (
                <div>
                    <label className="text-xs font-semibold text-muted-foreground ml-1">Шаблон сообщения</label>
                    <textarea
                        value={template}
                        onChange={e => onTemplateChange(e.target.value)}
                        rows={3}
                        className="w-full mt-1.5 px-3 py-2.5 border border-border rounded-xl bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none transition-all font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1 ml-1">
                        Переменные: {'{clientName}'}, {'{date}'}, {'{time}'}, {'{format}'}, {'{psyName}'}, {'{cancelLink}'}
                    </p>
                </div>
            )}
            {enabled && testType && onTest && (
                <button
                    onClick={() => onTest(testType)}
                    className="text-xs font-semibold text-primary hover:text-primary/70 transition-colors flex items-center gap-1.5 ml-1"
                >
                    <Send className="w-3 h-3" /> Отправить тест
                </button>
            )}
        </div>
    );
}

export default function NotificationsPage() {
    const [settings, setSettings] = useState<NotifSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState<string | null>(null);

    const fetchSettings = useCallback(async () => {
        try {
            const { getNotificationSettings } = await import('../actions/notifications');
            const res = await getNotificationSettings();
            if (res.success && res.data) {
                setSettings(res.data);
            }
        } catch {
            toast.error('Ошибка загрузки');
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchSettings(); }, [fetchSettings]);

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            const { updateNotificationSettings } = await import('../actions/notifications');
            const { ...data } = settings;
            await updateNotificationSettings(data);
            toast.success('Настройки уведомлений сохранены');
        } catch {
            toast.error('Ошибка сохранения');
        }
        setSaving(false);
    };

    const handleTest = async (type: string) => {
        setTesting(type);
        try {
            const { testNotification } = await import('../actions/notifications');
            const res = await testNotification(type);
            if (res.success) {
                toast.success('Тестовое уведомление отправлено');
            } else {
                toast.error(res.error || 'Ошибка');
            }
        } catch {
            toast.error('Ошибка');
        }
        setTesting(null);
    };

    const update = (field: keyof NotifSettings, value: any) => {
        setSettings(prev => prev ? { ...prev, [field]: value } : prev);
    };

    if (loading || !settings) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-8 pb-12 max-w-3xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Уведомления</h1>
                    <p className="text-muted-foreground text-base mt-2">Настройте что и когда отправлять вам и клиентам</p>
                </div>
                <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-primary text-primary-foreground rounded-xl hover:bg-forest-700 transition-all text-sm font-semibold shadow-card active:scale-[0.98] disabled:opacity-50">
                    <Save className="w-4 h-4" />{saving ? 'Сохранение...' : 'Сохранить'}
                </button>
            </div>

            {/* Psychologist notifications */}
            <div className="bg-card rounded-2xl border border-border p-4 md:p-6 shadow-card overflow-hidden">
                <h2 className="text-base md:text-xl font-semibold mb-4 flex items-center gap-2.5 text-foreground tracking-tight">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-sage-100 text-forest-700 flex items-center justify-center">
                        <Bell className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    Уведомления психологу
                </h2>
                <div className="space-y-3">
                    <NotifRow
                        label="Новая запись" desc="Когда клиент записывается на сессию"
                        enabled={settings.newBookingEnabled} onToggle={v => update('newBookingEnabled', v)}
                        template={settings.newBookingTemplate} onTemplateChange={v => update('newBookingTemplate', v)}
                        testType="newBooking" onTest={handleTest}
                    />
                    <NotifRow
                        label="Напоминание" desc="Перед началом сессии"
                        enabled={settings.reminderEnabled} onToggle={v => update('reminderEnabled', v)}
                        template={settings.reminderTemplate} onTemplateChange={v => update('reminderTemplate', v)}
                        testType="reminder" onTest={handleTest}
                    >
                        {settings.reminderEnabled && (
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-semibold text-muted-foreground">За сколько напомнить:</label>
                                <select
                                    value={settings.reminderMinutesBefore}
                                    onChange={e => update('reminderMinutesBefore', parseInt(e.target.value))}
                                    className="px-3 py-1.5 border border-border rounded-lg bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring/50"
                                >
                                    {REMINDER_INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                                </select>
                            </div>
                        )}
                    </NotifRow>
                    <NotifRow
                        label="Клиент перенёс" desc="Когда клиент переносит сессию"
                        enabled={settings.clientRescheduleEnabled} onToggle={v => update('clientRescheduleEnabled', v)}
                    />
                    <NotifRow
                        label="Клиент отменил" desc="Когда клиент отменяет сессию"
                        enabled={settings.clientCancelEnabled} onToggle={v => update('clientCancelEnabled', v)}
                    />
                </div>
            </div>

            {/* Client notifications */}
            <div className="bg-card rounded-2xl border border-border p-4 md:p-6 shadow-card overflow-hidden">
                <h2 className="text-base md:text-xl font-semibold mb-4 flex items-center gap-2.5 text-foreground tracking-tight">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-2xl bg-orange-soft text-orange-500 flex items-center justify-center">
                        <BellRing className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    Уведомления клиенту
                </h2>
                <div className="space-y-3">
                    <NotifRow
                        label="Напоминание за 25 часов" desc="За день до сессии"
                        enabled={settings.clientReminder25hEnabled} onToggle={v => update('clientReminder25hEnabled', v)}
                        template={settings.clientReminder25hTemplate} onTemplateChange={v => update('clientReminder25hTemplate', v)}
                        testType="clientReminder25h" onTest={handleTest}
                    />
                    <NotifRow
                        label="Напоминание за 1 час" desc="За час до начала"
                        enabled={settings.clientReminder1hEnabled} onToggle={v => update('clientReminder1hEnabled', v)}
                        template={settings.clientReminder1hTemplate} onTemplateChange={v => update('clientReminder1hTemplate', v)}
                        testType="clientReminder1h" onTest={handleTest}
                    />
                    <NotifRow
                        label="Отмена психологом" desc="Когда психолог отменяет сессию"
                        enabled={settings.clientPsyCancelEnabled} onToggle={v => update('clientPsyCancelEnabled', v)}
                        template={settings.clientPsyCancelTemplate} onTemplateChange={v => update('clientPsyCancelTemplate', v)}
                        testType="clientPsyCancel" onTest={handleTest}
                    />
                </div>
            </div>
        </div>
    );
}
