'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, CalendarClock, Loader2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAttestationGate } from '@/components/legal/useAttestationGate';

type Integration = { id: string; provider: string; accountEmail: string | null };
type ClientOption = { id: string; name: string };
type AddressOption = { id: string; name: string };

type Classification = 'session' | 'client_only' | 'personal' | 'uncertain' | 'skipped';
type ReviewState = 'ready' | 'review' | 'personal' | 'skipped';

type ImportCandidate = {
    id: string;
    provider: string;
    integrationId: string;
    externalEventId: string;
    externalSeriesId: string | null;
    summary: string;
    date: string;
    startTime: string;
    endTime: string;
    duration: number;
    format: 'online' | 'offline';
    addressId: string | null;
    classification: Classification;
    reviewState: ReviewState;
    confidence: 'high' | 'medium' | 'low';
    matchReason: 'phone' | 'email' | 'name_only' | 'conflict' | 'none';
    proposedClientName: string | null;
    suggestedClientId: string | null;
    resolvedClientId: string | null;
};

type Decision = 'session' | 'personal' | 'skip';
type Bucket = 'ready' | 'review' | 'personal' | 'skipped';

type RowState = {
    decision: Decision;
    clientMode: 'existing' | 'new';
    existingClientId: string | null;
    newClientName: string;
    format: 'online' | 'offline';
    addressId: string | null;
    duration: number;
};

const PROVIDER_LABEL: Record<string, string> = {
    google: 'Google',
    yandex: 'Яндекс',
};

const CLASSIFICATION_LABEL: Record<Classification, string> = {
    session: 'Сессия',
    client_only: 'Клиент',
    personal: 'Личное',
    uncertain: 'Неясно',
    skipped: 'Уже импортировано',
};

const BUCKET_LABEL: Record<Bucket, string> = {
    ready: 'Готово',
    review: 'Проверить',
    personal: 'Личное',
    skipped: 'Пропущено',
};

function initialRowState(item: ImportCandidate): RowState {
    if (item.reviewState === 'personal') {
        return { decision: 'personal', clientMode: 'new', existingClientId: null, newClientName: '', format: item.format, addressId: item.addressId, duration: item.duration };
    }
    if (item.reviewState === 'skipped') {
        return { decision: 'skip', clientMode: 'new', existingClientId: null, newClientName: '', format: item.format, addressId: item.addressId, duration: item.duration };
    }
    if (item.reviewState === 'ready') {
        // The only case with a real auto-decision: a strong (phone/email)
        // identity match. Everything else starts with NO client chosen —
        // suggestedClientId is a hint the psychologist clicks to accept,
        // never a pre-made decision (founder correction).
        return { decision: 'session', clientMode: 'existing', existingClientId: item.resolvedClientId, newClientName: '', format: item.format, addressId: item.addressId, duration: item.duration };
    }
    return { decision: 'session', clientMode: 'existing', existingClientId: null, newClientName: '', format: item.format, addressId: item.addressId, duration: item.duration };
}

function bucketOf(item: ImportCandidate, state: RowState): Bucket {
    if (state.decision === 'personal') return 'personal';
    if (state.decision === 'skip') return 'skipped';
    const clientResolved = state.clientMode === 'existing' ? !!state.existingClientId : state.newClientName.trim().length >= 2;
    // Founder correction: an offline session with no cabinet picked yet is
    // not actually ready to import — the apply route would have to guess
    // or reject it. Online never needs a cabinet.
    const locationResolved = state.format === 'online' || !!state.addressId;
    return clientResolved && locationResolved ? 'ready' : 'review';
}

function formatDate(dateStr: string) {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' });
}

const BUCKET_ORDER: Bucket[] = ['review', 'ready', 'personal', 'skipped'];

export default function ImportFromCalendarPage() {
    const router = useRouter();
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [clients, setClients] = useState<ClientOption[]>([]);
    const [addresses, setAddresses] = useState<AddressOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [items, setItems] = useState<ImportCandidate[] | null>(null);
    const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
    const [submitting, setSubmitting] = useState(false);
    const { guard: attestationGuard, modal: attestationModal } = useAttestationGate();

    useEffect(() => {
        (async () => {
            try {
                const [{ getConnectedCalendars, getClients }, { getAddresses }] = await Promise.all([
                    import('../../actions/clients'),
                    import('../../actions/settings'),
                ]);
                const [integrationList, clientList, addressResult] = await Promise.all([
                    getConnectedCalendars(),
                    getClients(),
                    getAddresses(),
                ]);
                setIntegrations(integrationList);
                setClients(clientList.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
                if (addressResult.success && addressResult.data) {
                    setAddresses(addressResult.data.map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })));
                }
            } catch {
                /* silent */
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);

    const buckets = useMemo(() => {
        if (!items) return null;
        const result: Record<Bucket, { item: ImportCandidate; state: RowState }[]> = { ready: [], review: [], personal: [], skipped: [] };
        for (const item of items) {
            const state = rowStates[item.id];
            if (!state) continue;
            result[bucketOf(item, state)].push({ item, state });
        }
        return result;
    }, [items, rowStates]);

    const counts = buckets
        ? { ready: buckets.ready.length, review: buckets.review.length, personal: buckets.personal.length, skipped: buckets.skipped.length }
        : null;

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
            const nextStates: Record<string, RowState> = {};
            for (const item of list) nextStates[item.id] = initialRowState(item);
            setRowStates(nextStates);
            if (list.length === 0) toast.info('Будущих событий в календаре не найдено');
        } catch {
            toast.error('Ошибка при сканировании');
        } finally {
            setScanning(false);
        }
    };

    const updateRow = (id: string, patch: Partial<RowState>) => {
        setRowStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    };

    const handleSubmit = async () => {
        if (!buckets || buckets.ready.length === 0) {
            toast.error('Нет ни одной сессии, готовой к импорту');
            return;
        }
        setSubmitting(true);
        try {
            const result = await attestationGuard(async () => {
                const res = await fetch('/api/diary/calendar/import/apply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: buckets.ready.map(({ item, state }) => ({
                            integrationId: item.integrationId,
                            provider: item.provider,
                            externalEventId: item.externalEventId,
                            externalSeriesId: item.externalSeriesId,
                            classification: item.classification,
                            date: item.date,
                            startTime: item.startTime,
                            endTime: item.endTime,
                            duration: state.duration,
                            summary: item.summary,
                            decision: state.decision,
                            clientMode: state.clientMode,
                            format: state.format,
                            addressId: state.format === 'offline' ? state.addressId : null,
                            resolvedClientId: state.clientMode === 'existing' ? state.existingClientId : null,
                            newClientName: state.clientMode === 'new' ? state.newClientName.trim() : null,
                        })),
                    }),
                });
                const body = await res.json();
                if (!res.ok) throw new Error(body.error || 'Ошибка при импорте');
                return body as { imported: number; skipped: number };
            });
            if (result.imported > 0) {
                toast.success(`Импортировано сессий: ${result.imported}${result.skipped > 0 ? `, пропущено: ${result.skipped}` : ''}`);
                router.push('/diary/clients');
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
            <div>
                <Link href="/diary/clients" className="inline-flex items-center gap-1 text-primary text-sm font-medium mb-3 hover:opacity-80 transition-opacity">
                    <ChevronLeft className="w-4 h-4" /> Клиенты
                </Link>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground flex items-center gap-3">
                    <CalendarClock className="w-8 h-8 text-accent" strokeWidth={1.5} />
                    Из календаря
                </h1>
                <p className="text-muted-foreground text-sm mt-2">
                    ПРАКТИКА прочитает подключённые календари и предложит будущие события на проверку. Ни одна сессия не
                    импортируется без вашего явного решения.
                </p>
            </div>

            {integrations.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-card">
                    <Link2 className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" strokeWidth={1.5} />
                    <h2 className="font-bold text-foreground mb-2">Календарь не подключён</h2>
                    <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
                        Подключите Google или Яндекс Календарь в разделе «Интеграции» — и вернитесь сюда.
                    </p>
                    <Link href="/diary/integrations" className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-accent-foreground rounded-xl font-semibold text-sm hover:bg-accent/90 transition-all shadow-card">
                        Перейти к интеграциям
                    </Link>
                </div>
            ) : (
                <>
                    <div className="bg-card rounded-2xl border border-border p-5 shadow-card space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {integrations.map((i) => (
                                <span key={i.id} className="px-3 py-1.5 rounded-lg bg-muted text-xs font-medium text-foreground">
                                    {PROVIDER_LABEL[i.provider] || i.provider}
                                    {i.accountEmail ? ` · ${i.accountEmail}` : ''}
                                </span>
                            ))}
                        </div>
                        <button
                            onClick={handleScan}
                            disabled={scanning}
                            className="w-full px-5 py-3 bg-accent text-accent-foreground rounded-xl font-semibold text-sm shadow-card hover:bg-accent/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {scanning ? (<><Loader2 className="w-4 h-4 animate-spin" /> Сканируем…</>) : (<><CalendarClock className="w-4 h-4" /> Просканировать будущие события</>)}
                        </button>
                    </div>

                    {counts && items && items.length > 0 && (
                        <div className="grid grid-cols-4 gap-2">
                            {BUCKET_ORDER.map((b) => (
                                <div key={b} className="bg-card rounded-xl border border-border p-3 text-center">
                                    <div className="text-2xl font-bold text-foreground">{counts[b]}</div>
                                    <div className="text-xs text-muted-foreground">{BUCKET_LABEL[b]}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {items && items.length === 0 && !scanning && (
                        <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-card">
                            <p className="text-sm text-muted-foreground">Будущих событий в подключённых календарях не нашлось.</p>
                        </div>
                    )}

                    {items && buckets && items.length > 0 && (
                        <div className="space-y-3">
                            {BUCKET_ORDER.flatMap((bucket) => buckets[bucket]).map(({ item, state }) => {
                                const bucket = bucketOf(item, state);
                                const suggestedName = item.suggestedClientId ? clientById.get(item.suggestedClientId) : null;
                                return (
                                    <div key={item.id} className="bg-card rounded-2xl border border-border shadow-card p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="font-semibold text-foreground text-sm truncate">{item.summary}</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    {PROVIDER_LABEL[item.provider] || item.provider} · {formatDate(item.date)}, {item.startTime}–{item.endTime}
                                                </div>
                                            </div>
                                            <span className={`shrink-0 px-2 py-1 rounded-lg text-xs font-medium ${
                                                bucket === 'ready' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                    : bucket === 'review' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                    : bucket === 'personal' ? 'bg-muted text-muted-foreground'
                                                    : 'bg-muted text-muted-foreground/70'
                                            }`}>
                                                {BUCKET_LABEL[bucket]}
                                            </span>
                                        </div>

                                        <div className="text-xs text-muted-foreground">
                                            Предложенный тип: {CLASSIFICATION_LABEL[item.classification]}
                                            {item.classification === 'skipped' && ' — сессия на эту дату/время уже есть'}
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => updateRow(item.id, { decision: 'session' })}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${state.decision === 'session' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                                            >Сессия</button>
                                            <button
                                                onClick={() => updateRow(item.id, { decision: 'personal' })}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${state.decision === 'personal' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                                            >Личное</button>
                                            <button
                                                onClick={() => updateRow(item.id, { decision: 'skip' })}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${state.decision === 'skip' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                                            >Пропустить</button>
                                        </div>

                                        {state.decision === 'session' && (
                                            <div className="space-y-2 border-t border-border pt-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <select
                                                        value={state.clientMode === 'existing' ? (state.existingClientId || '') : '__new__'}
                                                        onChange={(e) => {
                                                            if (e.target.value === '__new__') updateRow(item.id, { clientMode: 'new', existingClientId: null, newClientName: item.proposedClientName || '' });
                                                            else updateRow(item.id, { clientMode: 'existing', existingClientId: e.target.value || null });
                                                        }}
                                                        className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
                                                    >
                                                        <option value="">— выбрать клиента —</option>
                                                        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                        <option value="__new__">+ Новый клиент</option>
                                                    </select>

                                                    {state.clientMode === 'new' && (
                                                        <input
                                                            type="text"
                                                            value={state.newClientName}
                                                            onChange={(e) => updateRow(item.id, { newClientName: e.target.value })}
                                                            placeholder="Имя нового клиента"
                                                            className="px-3 py-2 rounded-lg border border-border bg-background text-sm flex-1 min-w-[160px]"
                                                        />
                                                    )}

                                                    {suggestedName && state.clientMode === 'existing' && state.existingClientId !== item.suggestedClientId && (
                                                        <button
                                                            onClick={() => updateRow(item.id, { clientMode: 'existing', existingClientId: item.suggestedClientId })}
                                                            className="text-xs text-primary hover:underline"
                                                        >
                                                            Похоже, это {suggestedName} — выбрать
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2">
                                                    <select
                                                        value={state.format}
                                                        onChange={(e) => updateRow(item.id, { format: e.target.value as 'online' | 'offline' })}
                                                        className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
                                                    >
                                                        <option value="online">Онлайн</option>
                                                        <option value="offline">Очно</option>
                                                    </select>
                                                    {state.format === 'offline' && (
                                                        <select
                                                            value={state.addressId || ''}
                                                            onChange={(e) => updateRow(item.id, { addressId: e.target.value || null })}
                                                            className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
                                                        >
                                                            <option value="">— кабинет —</option>
                                                            {addresses.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                        </select>
                                                    )}
                                                    <input
                                                        type="number"
                                                        min={5}
                                                        step={5}
                                                        value={state.duration}
                                                        onChange={(e) => updateRow(item.id, { duration: Number(e.target.value) || item.duration })}
                                                        className="w-20 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                                                    />
                                                    <span className="text-xs text-muted-foreground">мин</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {counts && counts.ready > 0 && (
                        <div className="flex gap-3 sticky bottom-4 bg-background/80 backdrop-blur-md py-3 -mx-4 px-4 rounded-xl">
                            <Link href="/diary/clients" className="px-5 py-3 border border-border rounded-xl font-medium text-sm hover:bg-muted transition-colors">Отмена</Link>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="flex-1 px-5 py-3 bg-accent text-accent-foreground rounded-xl font-semibold text-sm shadow-card hover:bg-accent/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'Импортируем…' : `Импортировать ${counts.ready} готовых`}
                            </button>
                        </div>
                    )}
                </>
            )}
            {attestationModal}
        </div>
    );
}
