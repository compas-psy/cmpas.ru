'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, CalendarClock, Loader2, Users, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CandidateClient } from '@/lib/clients/extract-name';
import { useAttestationGate } from '@/components/legal/useAttestationGate';

type Integration = { id: string; provider: string; accountEmail: string };

const PROVIDER_LABEL: Record<string, string> = {
    google: 'Google Calendar',
    yandex: 'Яндекс Календарь',
};

const PERIODS = [
    { days: 30, label: '30 дней' },
    { days: 60, label: '60 дней' },
    { days: 90, label: '90 дней' },
    { days: 180, label: '6 месяцев' },
];

export default function ImportFromCalendarPage() {
    const router = useRouter();
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string>('');
    const [days, setDays] = useState(90);
    const [scanning, setScanning] = useState(false);
    const [candidates, setCandidates] = useState<CandidateClient[] | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [submitting, setSubmitting] = useState(false);
    const { guard: attestationGuard, modal: attestationModal } = useAttestationGate();

    useEffect(() => {
        (async () => {
            try {
                const { getConnectedCalendars } = await import('../../actions/clients');
                const list = await getConnectedCalendars();
                setIntegrations(list);
                if (list.length > 0) setSelectedId(list[0].id);
            } catch {
                /* silent */
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleScan = async () => {
        if (!selectedId) return;
        setScanning(true);
        setCandidates(null);
        try {
            const { scanCalendarForClients } = await import('../../actions/clients');
            const result = await scanCalendarForClients(selectedId, days);
            if (result.success && result.candidates) {
                setCandidates(result.candidates);
                // По умолчанию отмечаем всех кандидатов
                setSelected(new Set(result.candidates.map(c => c.name)));
                if (result.candidates.length === 0) {
                    toast.info('Повторяющихся имён в календаре не найдено');
                }
            } else {
                toast.error(result.error || 'Не удалось просканировать календарь');
            }
        } catch {
            toast.error('Ошибка при сканировании');
        } finally {
            setScanning(false);
        }
    };

    const toggle = (name: string) => {
        const next = new Set(selected);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        setSelected(next);
    };

    const toggleAll = () => {
        if (!candidates) return;
        if (selected.size === candidates.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(candidates.map(c => c.name)));
        }
    };

    const handleSubmit = async () => {
        if (!candidates || selected.size === 0) {
            toast.error('Выберите хотя бы одного клиента');
            return;
        }
        setSubmitting(true);
        try {
            const { bulkCreateClients } = await import('../../actions/clients');
            const items = candidates
                .filter(c => selected.has(c.name))
                .map(c => ({ name: c.name }));
            const result = await attestationGuard(() => bulkCreateClients(items));
            if (result.created > 0) {
                toast.success(
                    `Добавлено ${result.created}${result.skipped > 0 ? `, пропущено: ${result.skipped}` : ''}`
                );
                router.push('/diary/clients');
            } else if (result.skipped > 0) {
                toast.info('Все выбранные клиенты уже есть в базе');
            } else {
                toast.error('Не удалось добавить клиентов');
            }
        } catch (err) {
            if (!(err instanceof Error && err.message === 'Отменено')) toast.error('Ошибка при добавлении');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div>
                <Link
                    href="/diary/clients"
                    className="inline-flex items-center gap-1 text-primary text-sm font-medium mb-3 hover:opacity-80 transition-opacity"
                >
                    <ChevronLeft className="w-4 h-4" /> Клиенты
                </Link>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground flex items-center gap-3">
                    <CalendarClock className="w-8 h-8 text-accent" strokeWidth={1.5} />
                    Из календаря
                </h1>
                <p className="text-muted-foreground text-sm mt-2">
                    ПРАКТИКА прочитает подключённый календарь, найдёт повторяющиеся имена в заголовках событий и предложит их
                    как клиентов. Сессии при этом не импортируются — только клиентская карточка.
                </p>
            </div>

            {integrations.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-card">
                    <Link2 className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" strokeWidth={1.5} />
                    <h2 className="font-bold text-foreground mb-2">Календарь не подключён</h2>
                    <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
                        Подключите Google или Яндекс Календарь в разделе «Интеграции» — и вернитесь сюда.
                    </p>
                    <Link
                        href="/diary/integrations"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-accent-foreground rounded-xl font-semibold text-sm hover:bg-accent/90 transition-all shadow-card"
                    >
                        Перейти к интеграциям
                    </Link>
                </div>
            ) : (
                <>
                    {/* Выбор календаря и периода */}
                    <div className="bg-card rounded-2xl border border-border p-5 shadow-card space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-foreground mb-2">Календарь</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {integrations.map(i => (
                                    <button
                                        key={i.id}
                                        onClick={() => setSelectedId(i.id)}
                                        className={`px-4 py-3 border rounded-xl text-left transition-all ${
                                            selectedId === i.id
                                                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                                : 'border-border hover:bg-muted/50'
                                        }`}
                                    >
                                        <div className="font-semibold text-sm text-foreground">
                                            {PROVIDER_LABEL[i.provider] || i.provider}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate">{i.accountEmail}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-foreground mb-2">Период</label>
                            <div className="flex flex-wrap gap-2">
                                {PERIODS.map(p => (
                                    <button
                                        key={p.days}
                                        onClick={() => setDays(p.days)}
                                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                            days === p.days
                                                ? 'bg-primary text-primary-foreground shadow-card'
                                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={handleScan}
                            disabled={scanning || !selectedId}
                            className="w-full px-5 py-3 bg-accent text-accent-foreground rounded-xl font-semibold text-sm shadow-card hover:bg-accent/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {scanning ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Сканируем…
                                </>
                            ) : (
                                <>
                                    <CalendarClock className="w-4 h-4" />
                                    Просканировать календарь
                                </>
                            )}
                        </button>
                    </div>

                    {/* Кандидаты */}
                    {candidates && candidates.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
                                    <Users className="w-4 h-4 text-accent" />
                                    Найдено кандидатов: {candidates.length}
                                </h2>
                                <button
                                    onClick={toggleAll}
                                    className="text-xs text-primary hover:underline font-medium"
                                >
                                    {selected.size === candidates.length ? 'Снять все' : 'Выбрать все'}
                                </button>
                            </div>
                            <div className="bg-card rounded-2xl border border-border shadow-card divide-y divide-border">
                                {candidates.map(c => {
                                    const isSelected = selected.has(c.name);
                                    return (
                                        <button
                                            key={c.name}
                                            onClick={() => toggle(c.name)}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                                        >
                                            <div
                                                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                                                    isSelected
                                                        ? 'bg-accent border-accent'
                                                        : 'border-border'
                                                }`}
                                            >
                                                {isSelected && (
                                                    <svg
                                                        className="w-3 h-3 text-accent-foreground"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                        strokeWidth={3}
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-foreground text-sm truncate">
                                                    {c.name}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    {c.count} {pluralMeetings(c.count)} · последняя{' '}
                                                    {new Date(c.lastDate).toLocaleDateString('ru-RU', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                    })}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {candidates && candidates.length === 0 && !scanning && (
                        <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-card">
                            <p className="text-sm text-muted-foreground">
                                В календаре не нашлось повторяющихся имён. Попробуйте увеличить период или добавьте клиентов
                                вручную.
                            </p>
                        </div>
                    )}

                    {/* Submit */}
                    {candidates && candidates.length > 0 && (
                        <div className="flex gap-3 sticky bottom-4 bg-background/80 backdrop-blur-md py-3 -mx-4 px-4 rounded-xl">
                            <Link
                                href="/diary/clients"
                                className="px-5 py-3 border border-border rounded-xl font-medium text-sm hover:bg-muted transition-colors"
                            >
                                Отмена
                            </Link>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting || selected.size === 0}
                                className="flex-1 px-5 py-3 bg-accent text-accent-foreground rounded-xl font-semibold text-sm shadow-card hover:bg-accent/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting
                                    ? 'Добавляем…'
                                    : `Добавить ${selected.size} ${pluralClients(selected.size)}`}
                            </button>
                        </div>
                    )}
                </>
            )}
            {attestationModal}
        </div>
    );
}

function pluralMeetings(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'встреча';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'встречи';
    return 'встреч';
}

function pluralClients(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'клиента';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'клиентов';
    return 'клиентов';
}
