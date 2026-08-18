'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, BellRing, Send, Save, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

type NotifSettings = {
    newBookingEnabled: boolean;
    newBookingTemplate: string;
    reminderEnabled: boolean;
    clientRescheduleEnabled: boolean;
    clientCancelEnabled: boolean;
    morningDigestEnabled: boolean;
    weeklyDigestEnabled: boolean;
    clientReminder25hEnabled: boolean;
    clientReminder1hEnabled: boolean;
    clientPsyCancelEnabled: boolean;
    clientPsyCancelTemplate: string;
    clientMoodCheckEnabled: boolean;
};

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
        <div className="space-y-6 pb-12 max-w-3xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Уведомления</h1>
                    <p className="text-muted-foreground text-sm mt-1">Настройте что и когда отправлять вам и клиентам</p>
                </div>
                <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-forest-700 transition-all text-sm font-bold shadow-card active:scale-[0.97] disabled:opacity-50">
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
                        label="Напоминание" desc="За день до сессии — включает и отключает эту рассылку, время и текст фиксированы"
                        enabled={settings.reminderEnabled} onToggle={v => update('reminderEnabled', v)}
                    />
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

            {/* Proactive bot notifications */}
            <div className="bg-card rounded-2xl border border-border p-4 md:p-6 shadow-card overflow-hidden">
                <h2 className="text-base md:text-xl font-semibold mb-4 flex items-center gap-2.5 text-foreground tracking-tight">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
                    </div>
                    Бот-ассистент
                </h2>
                <p className="text-xs text-muted-foreground mb-4 -mt-1">Проактивные сообщения от бота в Telegram и MAX</p>
                <div className="space-y-3">
                    <NotifRow
                        label="Утренний дайджест" desc="Каждое утро — список сессий на день (если есть)"
                        enabled={settings.morningDigestEnabled} onToggle={v => update('morningDigestEnabled', v)}
                    />
                    <NotifRow
                        label="Еженедельная сводка" desc="По понедельникам — статистика за прошлую неделю"
                        enabled={settings.weeklyDigestEnabled} onToggle={v => update('weeklyDigestEnabled', v)}
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
                        label="Напоминание за 25 часов" desc="За день до сессии — включает и отключает эту рассылку, текст фиксирован"
                        enabled={settings.clientReminder25hEnabled} onToggle={v => update('clientReminder25hEnabled', v)}
                    />
                    <NotifRow
                        label="Напоминание за 1 час" desc="За час до начала — включает и отключает эту рассылку, текст фиксирован"
                        enabled={settings.clientReminder1hEnabled} onToggle={v => update('clientReminder1hEnabled', v)}
                    />
                    <NotifRow
                        label="Отмена психологом" desc="Когда психолог отменяет сессию"
                        enabled={settings.clientPsyCancelEnabled} onToggle={v => update('clientPsyCancelEnabled', v)}
                        template={settings.clientPsyCancelTemplate} onTemplateChange={v => update('clientPsyCancelTemplate', v)}
                        testType="clientPsyCancel" onTest={handleTest}
                    />
                    <NotifRow
                        label="Оценка после сессии" desc="Спросить клиента о самочувствии через 30 мин после сессии"
                        enabled={settings.clientMoodCheckEnabled} onToggle={v => update('clientMoodCheckEnabled', v)}
                    />
                </div>
            </div>
        </div>
    );
}
