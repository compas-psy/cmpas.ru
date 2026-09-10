'use client';

/**
 * СТРАНИЦА ОДНОЙ ВСТРЕЧИ В ВЕБЕ.
 *
 * До 10.09.2026 по этому адресу лежала раскладка-заглушка: выдуманный «Алексей
 * Смирнов», таймер 42:15, анамнез «32 года, работает в IT», домашнее задание
 * «Дневник СМЭР». Ничего из этого не существовало — но адрес был настоящий, и
 * пункт «оплата не отмечена» из «требует внимания» вёл ровно сюда
 * (attentionHref, src/app/diary/page.tsx). Специалист нажимал на свою
 * неоплаченную встречу и попадал в чужую придуманную жизнь.
 *
 * Теперь страница показывает настоящую встречу и предлагает ровно те действия,
 * которые с ней ещё можно сделать. Правило одно с приложением и лежит в
 * src/lib/practice/session-actions.ts — экран встречи в вебе и в телефоне
 * обязан отвечать одинаково.
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format as formatDate } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';
import { ArrowLeft, Video, MapPin, Clock } from 'lucide-react';
import { RescheduleModal } from '@/app/diary/components/RescheduleModal';
import { paymentActionLabel, sessionActions, type SessionActionKind } from '@/lib/practice/session-actions';

type SessionCard = Awaited<ReturnType<typeof import('@/app/diary/actions/session-view')['getSessionCard']>>;

const STATUS_LABEL: Record<string, string> = {
    pending: 'Ждём подтверждения клиента',
    confirmed: 'Подтверждена',
    completed: 'Прошла',
    no_show: 'Клиент не пришёл',
    cancelled: 'Отменена',
};

export default function SessionPage() {
    const params = useParams();
    const router = useRouter();
    const sessionId = params.id as string;

    const [session, setSession] = useState<SessionCard>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [showReschedule, setShowReschedule] = useState(false);

    const load = useCallback(async () => {
        const { getSessionCard } = await import('@/app/diary/actions/session-view');
        setSession(await getSessionCard(sessionId));
        setLoading(false);
    }, [sessionId]);

    useEffect(() => { void load(); }, [load]);

    if (loading) {
        return <div className="p-6 text-sm text-muted-foreground">Загружаем встречу…</div>;
    }

    if (!session) {
        return (
            <div className="p-6 max-w-md mx-auto space-y-4">
                <p className="text-sm text-muted-foreground">Такой встречи нет — возможно, она удалена.</p>
                <button onClick={() => router.push('/diary')} className="text-sm font-semibold text-forest-700">
                    К расписанию
                </button>
            </div>
        );
    }

    const date = new Date(session.date);
    const online = session.format !== 'offline';
    // Исход назван человеком — не выведен из статуса: сервер сам ставит
    // completed через 15 минут после конца встречи.
    const outcomeNamed = Boolean(session.outcomeRecordedAt);
    const canAskOutcome = !outcomeNamed
        && session.status !== 'cancelled'
        && date.getTime() <= new Date().setHours(23, 59, 59, 999);
    const actions = sessionActions(
        { status: session.status, outcomeRecordedAt: session.outcomeRecordedAt, date, format: session.format },
    );
    const payment = paymentActionLabel(session.paymentStatus);

    async function run(work: () => Promise<unknown>, done: string) {
        setBusy(true);
        try {
            await work();
            await load();
            toast.success(done);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Не получилось');
        }
        setBusy(false);
    }

    const markOutcome = (outcome: 'completed' | 'no_show') => run(async () => {
        const { markSessionOutcome } = await import('@/app/diary/actions/sessions');
        await markSessionOutcome(sessionId, outcome);
    }, outcome === 'completed' ? 'Отмечено: встреча была' : 'Отмечено: клиент не пришёл');

    const markPaid = () => run(async () => {
        const response = await fetch(`/api/diary/sessions/${sessionId}/payment`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentStatus: 'paid' }),
        });
        if (!response.ok) throw new Error('Не удалось отметить оплату');
    }, 'Оплата отмечена');

    const cancel = () => {
        if (!confirm('Отменить эту встречу? Клиент получит уведомление.')) return;
        void run(async () => {
            const { updateSession } = await import('@/app/diary/actions/sessions');
            await updateSession(sessionId, { status: 'cancelled' });
        }, 'Встреча отменена');
    };

    const ACTION: Record<SessionActionKind, { label: string; onClick: () => void; primary?: boolean; danger?: boolean; enabled?: boolean }> = {
        connect: {
            label: 'Подключиться',
            primary: true,
            enabled: Boolean(session.onlineLink),
            onClick: () => { if (session.onlineLink) window.open(session.onlineLink, '_blank', 'noopener'); },
        },
        rebook: {
            label: 'Записать снова',
            primary: true,
            onClick: () => router.push(`/diary/clients?clientId=${session.clientId}`),
        },
        note: { label: 'Заметка', onClick: () => router.push(`/diary/session/${sessionId}/notes`) },
        message: { label: 'Написать', onClick: () => router.push(`/diary/clients?clientId=${session.clientId}`) },
        payment: { label: payment.label, enabled: payment.enabled, onClick: markPaid },
        reschedule: { label: 'Перенести', onClick: () => setShowReschedule(true) },
        cancel: { label: 'Отменить', danger: true, onClick: cancel },
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-lg mx-auto p-4 space-y-4">
                <button
                    onClick={() => router.push('/diary')}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-forest-700 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> К расписанию
                </button>

                <section className="bg-white rounded-2xl border border-border p-5 space-y-4 shadow-sm">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                            {formatDate(date, 'd MMMM yyyy, EEEE', { locale: ru })}
                        </p>
                        <p className="text-3xl font-semibold text-forest-900 mt-1 tabular-nums">
                            {session.time}
                            {session.endTime && <span className="text-base text-muted-foreground font-normal"> — {session.endTime}</span>}
                        </p>
                    </div>

                    <button
                        onClick={() => router.push(`/diary/clients?clientId=${session.clientId}`)}
                        className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-xl bg-sage-50 border border-border hover:border-forest-700/30 transition-colors"
                    >
                        <span className="font-semibold text-forest-900">{session.clientName}</span>
                        <span className="text-xs text-muted-foreground">карточка клиента</span>
                    </button>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                            {online ? <Video className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                            {online ? 'Онлайн-консультация' : 'Очная встреча'}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            {STATUS_LABEL[session.status] ?? session.status}
                        </span>
                    </div>

                    {/* Отметка исхода — тот же вопрос и в том же виде, что в
                        приложении: пока не отвечен, спрашиваем; отвечен —
                        показываем ответ, а не предлагаем его снова. */}
                    {canAskOutcome ? (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                                disabled={busy}
                                onClick={() => void markOutcome('completed')}
                                className="py-2.5 rounded-xl bg-forest-700 text-white font-semibold text-sm disabled:opacity-60"
                            >
                                Была
                            </button>
                            <button
                                disabled={busy}
                                onClick={() => void markOutcome('no_show')}
                                className="py-2.5 rounded-xl border border-border font-semibold text-sm text-forest-900 disabled:opacity-60"
                            >
                                Не пришли
                            </button>
                        </div>
                    ) : outcomeNamed ? (
                        <p className="text-sm text-forest-700 font-medium">
                            {session.status === 'no_show' ? 'Отмечено: клиент не пришёл' : 'Отмечено: встреча была'}
                        </p>
                    ) : null}
                </section>

                <section className="grid grid-cols-2 gap-2">
                    {actions.map((kind) => {
                        const action = ACTION[kind];
                        const disabled = busy || action.enabled === false;
                        return (
                            <button
                                key={kind}
                                disabled={disabled}
                                onClick={action.onClick}
                                className={[
                                    'py-3 rounded-xl text-sm font-semibold border transition-colors',
                                    action.primary
                                        ? 'bg-forest-700 text-white border-forest-700'
                                        : action.danger
                                            ? 'bg-white text-destructive border-destructive/30'
                                            : 'bg-white text-forest-900 border-border',
                                    disabled ? 'opacity-50 cursor-not-allowed' : '',
                                ].join(' ')}
                            >
                                {action.label}
                            </button>
                        );
                    })}
                </section>
            </div>

            {showReschedule && (
                <RescheduleModal
                    isOpen={showReschedule}
                    onClose={() => setShowReschedule(false)}
                    onSave={() => { setShowReschedule(false); void load(); }}
                    sessionId={session.id}
                    currentDate={date.toISOString().split('T')[0]}
                    currentTime={session.time}
                    clientName={session.clientName}
                    clientId={session.clientId}
                />
            )}
        </div>
    );
}
