'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Save, AlertCircle, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { REMINDER_HOUR_OPTIONS, DEFAULT_REMINDER_HOURS, clampReminderHours } from '@/lib/messaging/payment-reminder-interval';
import { QUIET_HOURS_LABEL } from '@/lib/messaging/quiet-hours';

type PaymentSettings = {
    id?: string;
    isEnabled: boolean;
    paymentText: string;
    paymentLink: string;
    paymentQrUrl: string;
    prepaymentRequired: boolean;
    paymentDueText: string;
    paymentReminderEnabled: boolean;
    paymentReminderHoursBefore: number;
};

export default function DiaryPaymentPage() {
    const [settings, setSettings] = useState<PaymentSettings>({
        isEnabled: false,
        paymentText: '',
        paymentLink: '',
        paymentQrUrl: '',
        prepaymentRequired: true,
        paymentDueText: 'до 24:00 дня, предшествующего консультации',
        paymentReminderEnabled: false,
        paymentReminderHoursBefore: DEFAULT_REMINDER_HOURS,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const { getPaymentSettings } = await import('../actions/payment-settings');
            const data = await getPaymentSettings();
            if (data) {
                setSettings({
                    id: data.id,
                    isEnabled: !!data.isEnabled,
                    paymentText: data.paymentText || '',
                    paymentLink: data.paymentLink || '',
                    paymentQrUrl: data.paymentQrUrl || '',
                    prepaymentRequired: data.prepaymentRequired !== false,
                    paymentDueText: data.paymentDueText || '',
                    paymentReminderEnabled: !!data.paymentReminderEnabled,
                    paymentReminderHoursBefore: clampReminderHours(data.paymentReminderHoursBefore),
                });
            }
        } catch (e) {
            console.error(e);
            toast.error('Не удалось загрузить настройки оплаты');
        }
        setLoading(false);
    };

    useEffect(() => { loadSettings(); }, []);

    const save = async () => {
        setSaving(true);
        try {
            const { savePaymentSettings } = await import('../actions/payment-settings');
            await savePaymentSettings({
                isEnabled: settings.isEnabled,
                paymentText: settings.paymentText,
                paymentLink: settings.paymentLink,
                paymentQrUrl: settings.paymentQrUrl,
                prepaymentRequired: settings.prepaymentRequired,
                paymentDueText: settings.paymentDueText,
                paymentReminderEnabled: settings.paymentReminderEnabled,
                paymentReminderHoursBefore: settings.paymentReminderHoursBefore,
            });
            toast.success('Настройки оплаты сохранены');
            loadSettings();
        } catch (e: any) {
            toast.error(e?.message || 'Не удалось сохранить настройки оплаты');
        }
        setSaving(false);
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="pb-8 space-y-6 max-w-4xl">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Оплата клиентом</h1>
                    <p className="text-muted-foreground text-sm mt-1 max-w-2xl">ПРАКТИКА не принимает оплату и не проверяет поступление денег. Здесь вы настраиваете текст, ссылку или QR, которые будут отправляться клиенту от вашего имени.</p>
                </div>
                <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-forest-700 transition-all shadow-card disabled:opacity-50">
                    <Save className="w-4 h-4" /> {saving ? 'Сохраняю...' : 'Сохранить'}
                </button>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                    <b>Важно:</b> статус оплаты в ПРАКТИКЕ является ручной отметкой специалиста, если нет отдельной банковской интеграции. Сервис только передаёт клиенту вашу инструкцию по оплате.
                </div>
            </div>

            <section className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-5">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center"><CreditCard className="w-5 h-5 text-primary" /></div>
                        <div>
                            <h2 className="text-lg font-bold text-foreground">Платёжная инструкция</h2>
                            <p className="text-sm text-muted-foreground">Этот блок будет добавляться в сообщение клиенту после создания сессии.</p>
                        </div>
                    </div>
                    <label className="flex items-center gap-3 text-sm font-bold text-foreground cursor-pointer">
                        <input type="checkbox" checked={settings.isEnabled} onChange={e => setSettings(s => ({ ...s, isEnabled: e.target.checked }))} />
                        Включить
                    </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[13px] font-semibold text-muted-foreground mb-2">Срок оплаты</label>
                        <input value={settings.paymentDueText} onChange={e => setSettings(s => ({ ...s, paymentDueText: e.target.value }))} className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm outline-none" placeholder="Например: до 24:00 дня перед консультацией" />
                    </div>
                    <div>
                        <label className="block text-[13px] font-semibold text-muted-foreground mb-2">Ссылка на оплату</label>
                        <input value={settings.paymentLink} onChange={e => setSettings(s => ({ ...s, paymentLink: e.target.value }))} className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm outline-none" placeholder="https://..." />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-[13px] font-semibold text-muted-foreground mb-2">Ссылка на QR-код / изображение</label>
                        <input value={settings.paymentQrUrl} onChange={e => setSettings(s => ({ ...s, paymentQrUrl: e.target.value }))} className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm outline-none" placeholder="https://.../qr.png" />
                    </div>
                </div>

                <div>
                    <label className="block text-[13px] font-semibold text-muted-foreground mb-2">Текст инструкции</label>
                    <textarea value={settings.paymentText} onChange={e => setSettings(s => ({ ...s, paymentText: e.target.value }))} rows={7} className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm outline-none resize-none" placeholder="Например: Оплата по СБП/QR. После оплаты, пожалуйста, пришлите чек в этот чат." />
                </div>

                <label className="flex items-center gap-3 text-sm font-semibold text-foreground">
                    <input type="checkbox" checked={settings.prepaymentRequired} onChange={e => setSettings(s => ({ ...s, prepaymentRequired: e.target.checked }))} />
                    Предоплата обязательна до консультации
                </label>

                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Как будет выглядеть блок для клиента</p>
                    <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-6">
{[
settings.prepaymentRequired ? 'Оплата консультации производится по инструкции специалиста.' : 'Оплата консультации: по договорённости со специалистом.',
settings.paymentDueText ? `Срок оплаты: ${settings.paymentDueText}` : '',
settings.paymentText || '',
settings.paymentLink ? `Ссылка на оплату: ${settings.paymentLink}` : '',
settings.paymentQrUrl ? `QR-код для оплаты: ${settings.paymentQrUrl}` : '',
'ПРАКТИКА не принимает оплату и не подтверждает её поступление. Статус оплаты ведёт специалист.',
].filter(Boolean).join('\n')}
                    </pre>
                </div>
            </section>

            {/* НАПОМИНАНИЕ ОБ ОПЛАТЕ ПЕРЕД ВСТРЕЧЕЙ.

                Решение учредителя 11.09.2026: «отправлять перед первой или
                последующими сессиями ссылку на оплату нужно. Интервал за
                сколько до сессии отправлять выбирает психолог».

                Выключено по умолчанию: включать за специалиста рассылку его
                клиентам нельзя. */}
            <section className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-5">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center"><BellRing className="w-5 h-5 text-primary" /></div>
                        <div>
                            <h2 className="text-lg font-bold text-foreground">Напоминание об оплате</h2>
                            <p className="text-sm text-muted-foreground">Перед каждой встречей клиент получит эту же инструкцию и QR-код.</p>
                        </div>
                    </div>
                    <label className="flex items-center gap-3 text-sm font-bold text-foreground cursor-pointer">
                        <input type="checkbox" checked={settings.paymentReminderEnabled} onChange={e => setSettings(s => ({ ...s, paymentReminderEnabled: e.target.checked }))} />
                        Включить
                    </label>
                </div>

                <div>
                    <label className="block text-[13px] font-semibold text-muted-foreground mb-2">За сколько до встречи</label>
                    <select
                        value={settings.paymentReminderHoursBefore}
                        onChange={e => setSettings(s => ({ ...s, paymentReminderHoursBefore: Number(e.target.value) }))}
                        disabled={!settings.paymentReminderEnabled}
                        className="w-full md:w-64 px-4 py-3 border border-border rounded-xl bg-background text-sm outline-none disabled:opacity-50"
                    >
                        {REMINDER_HOUR_OPTIONS.map(option => (
                            <option key={option.hours} value={option.hours}>{option.label}</option>
                        ))}
                    </select>
                </div>

                <p className="text-sm text-muted-foreground leading-6">
                    Напоминание уходит один раз на встречу — тем же мессенджером, которым вы обычно пишете клиенту.
                    Ночью не приходит: {QUIET_HOURS_LABEL} по вашему часовому поясу тихо, и напоминание уйдёт первым же дневным проходом.
                    Встреча, которую вы уже отметили оплаченной, напоминания не получает.
                </p>
            </section>
        </div>
    );
}
