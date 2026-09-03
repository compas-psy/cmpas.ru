'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, CalendarClock, Loader2, Users, Link2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAttestationGate } from '@/components/legal/useAttestationGate';

type Integration = { id: string; provider: string; accountEmail: string | null };

type ImportCandidate = {
    id: string;
    provider: string;
    clientName: string;
    matchedClientId: string | null;
    date: string;
    startTime: string;
    endTime: string;
    duration: number;
    summary: string;
    duplicate: boolean;
};

type CandidateGroup = {
    name: string;
    matchedClientId: string | null;
    sessions: ImportCandidate[];
};

const PROVIDER_LABEL: Record<string, string> = {
    google: 'Google Calendar',
    yandex: 'Яндекс Календарь',
};

function groupByClient(items: ImportCandidate[]): CandidateGroup[] {
    const map = new Map<string, CandidateGroup>();
    for (const item of items) {
        const key = item.clientName.toLowerCase().trim();
        let group = map.get(key);
        if (!group) {
            group = { name: item.clientName, matchedClientId: item.matchedClientId, sessions: [] };
            map.set(key, group);
        }
        group.sessions.push(item);
    }
    return Array.from(map.values())
        .map((g) => ({ ...g, sessions: g.sessions.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)) }))
        .sort((a, b) => b.sessions.length - a.sessions.length);
}

function formatDate(dateStr: string) {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' });
}

export default function ImportFromCalendarPage() {
    const router = useRouter();
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [items, setItems] = useState<ImportCandidate[] | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [submitting, setSubmitting] = useState(false);
    const { guard: attestationGuard, modal: attestationModal } = useAttestationGate();

    const groups = useMemo(() => (items ? groupByClient(items) : null), [items]);

    useEffect(() => {
        (async () => {
            try {
                const { getConnectedCalendars } = await import('../../actions/clients');
                const list = await getConnectedCalendars();
                setIntegrations(list);
            } catch {
                /* silent */
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleScan = async () => {
        setScanning(true);
        setItems(null);
        try {
            const res = await fetch('/api/diary/calendar/import/preview');
            const result = await res.json();
            if (!res.ok) {
                toast.error(result.error || 'Не удалось просканировать календарь');
                return;
            }
            const list: ImportCandidate[] = result.items || [];
            setItems(list);
            // По умолчанию отмечаем всё, кроме уже существующих сессий.
            setSelected(new Set(list.filter((i) => !i.duplicate).map((i) => i.id)));
            if (list.length === 0) {
                toast.info('Будущих сессий в календаре не найдено');
            }
        } catch {
            toast.error('Ошибка при сканировании');
        } finally {
            setScanning(false);
        }
    };

    const toggle = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelected(next);
    };

    const toggleGroup = (group: CandidateGroup) => {
        const importable = group.sessions.filter((s) => !s.duplicate);
        const allSelected = importable.every((s) => selected.has(s.id));
        const next = new Set(selected);
        for (const s of importable) {
            if (allSelected) next.delete(s.id);
            else next.add(s.id);
        }
        setSelected(next);
    };

    const handleSubmit = async () => {
        if (!items || selected.size === 0) {
            toast.error('Выберите хотя бы одну сессию');
            return;
        }
        setSubmitting(true);
        try {
            const selectedItems = items.filter((i) => selected.has(i.id));
            const result = await attestationGuard(async () => {
                const res = await fetch('/api/diary/calendar/import/apply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: selectedItems.map((i) => ({
                            clientName: i.clientName,
                            date: i.date,
                            startTime: i.startTime,
                            endTime: i.endTime,
                            duration: i.duration,
                            summary: i.summary,
                        })),
                    }),
                });
                const body = await res.json();
                if (!res.ok) throw new Error(body.error || 'Ошибка при импорте');
                return body as { imported: number; skipped: number };
            });
            if (result.imported > 0) {
                toast.success(
                    `Импортировано сессий: ${result.imported}${result.skipped > 0 ? `, пропущено дублей: ${result.skipped}` : ''}`
                );
                router.push('/diary/clients');
            } else if (result.skipped > 0) {
                toast.info('Все выбранные сессии уже есть в календаре');
            } else {
                toast.error('Не удалось импортировать сессии');
            }
        } catch (err) {
            if (!(err instanceof Error && err.message === 'Отменено')) toast.error('Ошибка при импорте');
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
                    ПРАКТИКА прочитает подключённые календари и предложит будущие встречи для импорта как сессии — с чекбоксом
                    по каждой.
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
                    <div className="bg-card rounded-2xl border border-border p-5 shadow-card space-y-4">
                        <div>
                            <div className="text-sm font-semibold text-foreground mb-2">Подключённые календари</div>
                            <div className="flex flex-wrap gap-2">
                                {integrations.map((i) => (
                                    <span key={i.id} className="px-3 py-1.5 rounded-lg bg-muted text-xs font-medium text-foreground">
                                        {PROVIDER_LABEL[i.provider] || i.provider}
                                        {i.accountEmail ? ` · ${i.accountEmail}` : ''}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={handleScan}
                            disabled={scanning}
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
                                    Просканировать будущие события
                                </>
                            )}
                        </button>
                    </div>

                    {/* Кандидаты */}
                    {groups && groups.length > 0 && (
                        <div className="space-y-3">
                            <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
                                <Users className="w-4 h-4 text-accent" />
                                Найдено клиентов: {groups.length}, сессий: {items!.length}
                            </h2>
                            <div className="space-y-3">
                                {groups.map((group) => {
                                    const importable = group.sessions.filter((s) => !s.duplicate);
                                    const allSelected = importable.length > 0 && importable.every((s) => selected.has(s.id));
                                    return (
                                        <div key={group.name} className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
                                            <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                                                <div className="font-semibold text-foreground text-sm">
                                                    {group.name}
                                                    {group.matchedClientId && (
                                                        <span className="ml-2 text-xs font-normal text-muted-foreground">уже есть в базе</span>
                                                    )}
                                                </div>
                                                {importable.length > 0 && (
                                                    <button onClick={() => toggleGroup(group)} className="text-xs text-primary hover:underline font-medium">
                                                        {allSelected ? 'Снять все' : 'Выбрать все'}
                                                    </button>
                                                )}
                                            </div>
                                            <div className="divide-y divide-border">
                                                {group.sessions.map((s) => {
                                                    const isSelected = selected.has(s.id);
                                                    return (
                                                        <button
                                                            key={s.id}
                                                            onClick={() => !s.duplicate && toggle(s.id)}
                                                            disabled={s.duplicate}
                                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left disabled:cursor-not-allowed disabled:opacity-60"
                                                        >
                                                            <div
                                                                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                                                                    isSelected ? 'bg-accent border-accent' : 'border-border'
                                                                }`}
                                                            >
                                                                {isSelected && <Check className="w-3 h-3 text-accent-foreground" strokeWidth={3} />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm text-foreground">
                                                                    {formatDate(s.date)}, {s.startTime}–{s.endTime}
                                                                </div>
                                                                {s.duplicate && (
                                                                    <div className="text-xs text-muted-foreground mt-0.5">уже есть в календаре</div>
                                                                )}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {items && items.length === 0 && !scanning && (
                        <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-card">
                            <p className="text-sm text-muted-foreground">
                                Будущих сессий в подключённых календарях не нашлось. Добавьте клиентов вручную или проверьте
                                интеграции.
                            </p>
                        </div>
                    )}

                    {/* Submit */}
                    {groups && groups.length > 0 && (
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
                                {submitting ? 'Импортируем…' : `Импортировать ${selected.size} ${pluralSessions(selected.size)}`}
                            </button>
                        </div>
                    )}
                </>
            )}
            {attestationModal}
        </div>
    );
}

function pluralSessions(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'сессию';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'сессии';
    return 'сессий';
}
