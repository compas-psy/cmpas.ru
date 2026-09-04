'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useAttestationGate } from '@/components/legal/useAttestationGate';

// Task 13: CSV/XLSX/paste fallback import. This is an adapter/preview layer
// on top of the SAME PracticeImportBatch -> commitPracticeImport core the
// calendar import (Task 11/12) uses — see /api/diary/clients/import-spreadsheet/*.
// Two explicit, never-mixed modes (§2): "только клиенты" never fabricates a
// session; "клиенты и сессии" always creates both. Rows never disappear —
// every parsed row keeps a visible bucket (Готово/Проверить/Пропущено/Ошибки).

type Mode = 'client_only' | 'spreadsheet';
type InputKind = 'paste' | 'file';
type Bucket = 'ready' | 'review' | 'skipped' | 'error';
type MatchReason = 'phone' | 'email' | 'name_only' | 'conflict' | 'none';

interface ClientOption { id: string; name: string }
interface AddressOption { id: string; name: string }
interface SheetInfo { name: string; rowCount: number }

interface ClientOnlyRow {
    rowIndex: number;
    mode: 'client_only';
    name: string | null;
    phone: string | null;
    email: string | null;
    matchReason: MatchReason;
    resolvedClientId: string | null;
    suggestedClientId: string | null;
    errorCode?: string;
    bucket: Bucket;
}

interface SessionRow {
    rowIndex: number;
    mode: 'spreadsheet';
    name: string | null;
    phone: string | null;
    email: string | null;
    date: string | null;
    startTime: string | null;
    endTime: string | null;
    duration: number | null;
    format: 'online' | 'offline';
    addressRaw: string | null;
    addressId: string | null;
    matchReason: MatchReason;
    resolvedClientId: string | null;
    suggestedClientId: string | null;
    sourceFingerprint: string | null;
    errorCode?: string;
    bucket: Bucket;
}

type PreviewRow = ClientOnlyRow | SessionRow;

interface RowState {
    action: 'include' | 'skip';
    clientMode: 'existing' | 'new';
    existingClientId: string | null;
    newClientName: string;
    newClientPhone: string;
    newClientEmail: string;
    format: 'online' | 'offline';
    addressId: string | null;
    duration: number;
}

const ERROR_LABEL: Record<string, string> = {
    MISSING_NAME: 'Не распознано имя',
    INVALID_EMAIL: 'Некорректный email',
    INVALID_PHONE: 'Некорректный телефон',
    INVALID_DATE_OR_TIME: 'Некорректная дата или время',
    INVALID_DURATION: 'Длительность и время окончания не совпадают',
    NAME_ONLY_COLLISION: 'Похоже на уже существующего клиента — подтвердите',
    CLIENT_IDENTITY_CONFLICT: 'Телефон/email указывают на разных клиентов',
    ADDRESS_REQUIRED: 'Нужно выбрать кабинет для очной встречи',
    ADDRESS_NOT_FOUND: 'Кабинет не найден среди ваших адресов',
    AMBIGUOUS_ADDRESS: 'Несколько кабинетов подходят — выберите вручную',
    DUPLICATE_SOURCE_ROW: 'Повтор строки в этом же файле',
    ALREADY_IMPORTED_SOURCE_ROW: 'Уже было импортировано ранее',
    ALREADY_EXISTS: 'Клиент уже есть в базе',
};

const BUCKET_LABEL: Record<Bucket, string> = { ready: 'Готово', review: 'Проверить', skipped: 'Пропущено', error: 'Ошибки' };
const BUCKET_ORDER: Bucket[] = ['review', 'ready', 'error', 'skipped'];

function initialRowState(row: PreviewRow): RowState {
    const hasExisting = !!row.resolvedClientId;
    return {
        action: row.bucket === 'error' ? 'skip' : row.bucket === 'skipped' ? 'skip' : 'include',
        clientMode: hasExisting ? 'existing' : 'new',
        existingClientId: row.resolvedClientId,
        newClientName: hasExisting ? '' : (row.name || ''),
        newClientPhone: row.phone || '',
        newClientEmail: row.email || '',
        format: row.mode === 'spreadsheet' ? row.format : 'online',
        addressId: row.mode === 'spreadsheet' ? row.addressId : null,
        duration: row.mode === 'spreadsheet' ? (row.duration ?? 50) : 0,
    };
}

function effectiveBucket(row: PreviewRow, state: RowState): Bucket {
    if (row.bucket === 'error') return 'error';
    if (state.action === 'skip') return 'skipped';
    const clientResolved = state.clientMode === 'existing' ? !!state.existingClientId : state.newClientName.trim().length >= 2;
    if (row.mode === 'client_only') return clientResolved ? 'ready' : 'review';
    const locationResolved = state.format === 'online' || !!state.addressId;
    return clientResolved && locationResolved ? 'ready' : 'review';
}

export default function ImportSpreadsheetPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [mode, setMode] = useState<Mode>('client_only');
    const [inputKind, setInputKind] = useState<InputKind>('paste');
    const [pasteText, setPasteText] = useState('');
    const [fileName, setFileName] = useState<string | null>(null);
    const [fileBuffer, setFileBuffer] = useState<{ kind: 'csv' | 'xlsx'; text?: string; file?: File } | null>(null);
    const [sheets, setSheets] = useState<SheetInfo[] | null>(null);
    const [selectedSheet, setSelectedSheet] = useState<string | null>(null);

    const [clients, setClients] = useState<ClientOption[]>([]);
    const [addresses, setAddresses] = useState<AddressOption[]>([]);
    const [loadingContext, setLoadingContext] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [rows, setRows] = useState<PreviewRow[] | null>(null);
    const [unusedHeaders, setUnusedHeaders] = useState<string[]>([]);
    const [rowStates, setRowStates] = useState<Record<number, RowState>>({});
    const [submitting, setSubmitting] = useState(false);
    const { guard: attestationGuard, modal: attestationModal } = useAttestationGate();

    useEffect(() => {
        (async () => {
            try {
                const [{ getClients }, { getAddresses }] = await Promise.all([import('../../actions/clients'), import('../../actions/settings')]);
                const [clientList, addressResult] = await Promise.all([getClients(), getAddresses()]);
                setClients(clientList.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
                if (addressResult.success && addressResult.data) {
                    setAddresses(addressResult.data.map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })));
                }
            } catch {
                /* silent */
            } finally {
                setLoadingContext(false);
            }
        })();
    }, []);

    const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);

    const buckets = useMemo(() => {
        if (!rows) return null;
        const result: Record<Bucket, { row: PreviewRow; state: RowState }[]> = { ready: [], review: [], skipped: [], error: [] };
        for (const row of rows) {
            const state = rowStates[row.rowIndex];
            if (!state) continue;
            result[effectiveBucket(row, state)].push({ row, state });
        }
        return result;
    }, [rows, rowStates]);

    const counts = buckets ? { ready: buckets.ready.length, review: buckets.review.length, skipped: buckets.skipped.length, error: buckets.error.length } : null;

    function resetPreview() {
        setRows(null);
        setRowStates({});
        setUnusedHeaders([]);
        setSheets(null);
        setSelectedSheet(null);
    }

    function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        resetPreview();
        if (!file) { setFileBuffer(null); setFileName(null); return; }
        setFileName(file.name);
        const lower = file.name.toLowerCase();
        if (lower.endsWith('.xlsx')) {
            setFileBuffer({ kind: 'xlsx', file });
        } else if (lower.endsWith('.csv')) {
            const reader = new FileReader();
            reader.onload = () => setFileBuffer({ kind: 'csv', text: String(reader.result || '') });
            reader.readAsText(file, 'utf-8');
        } else {
            toast.error('Поддерживаются только .csv и .xlsx');
            setFileBuffer(null);
        }
    }

    async function runPreview(sheetName?: string) {
        setScanning(true);
        try {
            let res: Response;
            if (inputKind === 'file' && fileBuffer?.kind === 'xlsx') {
                const form = new FormData();
                form.set('mode', mode);
                form.set('source', 'xlsx');
                if (sheetName) form.set('sheetName', sheetName);
                if (fileBuffer.file) form.set('file', fileBuffer.file);
                res = await fetch('/api/diary/clients/import-spreadsheet/preview', { method: 'POST', body: form });
            } else {
                const source = inputKind === 'file' ? 'csv' : (mode === 'spreadsheet' ? 'paste_table' : 'paste');
                const text = inputKind === 'file' ? (fileBuffer?.text || '') : pasteText;
                res = await fetch('/api/diary/clients/import-spreadsheet/preview', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode, source, text }),
                });
            }
            const body = await res.json();
            if (body.needsSheetSelection) {
                setSheets(body.sheets);
                return;
            }
            if (!res.ok) {
                toast.error(body.error ? (ERROR_LABEL[body.error] || body.error) : 'Не удалось разобрать данные');
                return;
            }
            const list: PreviewRow[] = body.rows || [];
            setRows(list);
            setUnusedHeaders(body.unusedHeaders || []);
            const nextStates: Record<number, RowState> = {};
            for (const row of list) nextStates[row.rowIndex] = initialRowState(row);
            setRowStates(nextStates);
            if (list.length === 0) toast.info('Не найдено ни одной строки');
            if (body.truncated) toast.info('Файл больше 2000 строк — обработаны только первые 2000');
        } catch {
            toast.error('Ошибка при разборе');
        } finally {
            setScanning(false);
        }
    }

    async function onPickSheet(name: string) {
        setSelectedSheet(name);
        await runPreview(name);
    }

    const updateRow = (rowIndex: number, patch: Partial<RowState>) => {
        setRowStates((prev) => ({ ...prev, [rowIndex]: { ...prev[rowIndex], ...patch } }));
    };

    const canScan = inputKind === 'paste' ? pasteText.trim().length > 0 : !!fileBuffer;

    const handleSubmit = async () => {
        if (!buckets || buckets.ready.length === 0) {
            toast.error('Нет ни одной строки, готовой к импорту');
            return;
        }
        setSubmitting(true);
        try {
            const result = await attestationGuard(async () => {
                const res = await fetch('/api/diary/clients/import-spreadsheet/apply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        mode,
                        items: buckets.ready.map(({ row, state }) => ({
                            clientMode: state.clientMode,
                            resolvedClientId: state.clientMode === 'existing' ? state.existingClientId : null,
                            name: state.clientMode === 'new' ? state.newClientName.trim() : null,
                            phone: state.clientMode === 'new' ? state.newClientPhone.trim() || null : null,
                            email: state.clientMode === 'new' ? state.newClientEmail.trim() || null : null,
                            ...(row.mode === 'spreadsheet' ? {
                                date: row.date, startTime: row.startTime, endTime: row.endTime,
                                duration: state.duration, format: state.format,
                                addressId: state.format === 'offline' ? state.addressId : null,
                            } : {}),
                        })),
                    }),
                });
                const body = await res.json();
                if (!res.ok) throw new Error(body.error || 'Ошибка при импорте');
                return body as { imported: number; skipped: number };
            });
            if (result.imported > 0) {
                toast.success(`Добавлено: ${result.imported}${result.skipped > 0 ? `, пропущено: ${result.skipped}` : ''}`);
                router.push('/diary/clients');
            } else {
                toast.error('Не удалось импортировать');
            }
        } catch (err) {
            if (!(err instanceof Error && err.message === 'Отменено')) toast.error('Ошибка при импорте');
        } finally {
            setSubmitting(false);
        }
    };

    if (loadingContext) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <Link href="/diary/clients" className="inline-flex items-center gap-1 text-primary text-sm font-medium mb-3 hover:opacity-80 transition-opacity">
                    <ChevronLeft className="w-4 h-4" /> Клиенты
                </Link>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground flex items-center gap-3">
                    <FileSpreadsheet className="w-8 h-8 text-accent" strokeWidth={1.5} />
                    Из файла или списка
                </h1>
                <p className="text-muted-foreground text-sm mt-2">
                    Для тех, у кого нет подключённого календаря: CSV, XLSX или список текстом. Ни один клиент или сессия
                    не импортируется без вашего явного решения.
                </p>
            </div>

            <div className="bg-card rounded-2xl border border-border p-5 shadow-card space-y-4">
                <div className="flex gap-2">
                    <button
                        onClick={() => { setMode('client_only'); resetPreview(); }}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${mode === 'client_only' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                    >Только клиенты</button>
                    <button
                        onClick={() => { setMode('spreadsheet'); resetPreview(); }}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${mode === 'spreadsheet' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                    >Клиенты и сессии</button>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => { setInputKind('paste'); resetPreview(); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium ${inputKind === 'paste' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}
                    >Вставить текстом</button>
                    <button
                        onClick={() => { setInputKind('file'); resetPreview(); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium ${inputKind === 'file' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}
                    >Файл CSV/XLSX</button>
                </div>

                {inputKind === 'paste' ? (
                    <textarea
                        value={pasteText}
                        onChange={(e) => { setPasteText(e.target.value); resetPreview(); }}
                        rows={8}
                        placeholder={mode === 'client_only'
                            ? 'Анна Иванова, +79161234567, anna@example.com'
                            : 'ФИО\tТелефон\tДата\tВремя\tДлительность\tФормат\nАнна Иванова\t+79161234567\t12.09.2026\t15:00\t50\tонлайн'}
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm font-mono transition-all resize-y"
                    />
                ) : (
                    <div>
                        <input ref={fileInputRef} type="file" accept=".csv,.xlsx" onChange={onFileChange} className="hidden" />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full px-4 py-6 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-accent hover:text-foreground transition-colors flex flex-col items-center gap-2"
                        >
                            <Upload className="w-6 h-6" />
                            {fileName || 'Выбрать .csv или .xlsx'}
                        </button>
                    </div>
                )}

                {sheets && sheets.length > 1 && (
                    <div className="space-y-2 border-t border-border pt-3">
                        <p className="text-xs text-muted-foreground">В файле несколько листов — выберите нужный:</p>
                        <div className="flex flex-wrap gap-2">
                            {sheets.map((s) => (
                                <button
                                    key={s.name}
                                    onClick={() => onPickSheet(s.name)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${selectedSheet === s.name ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                                >{s.name} ({s.rowCount})</button>
                            ))}
                        </div>
                    </div>
                )}

                <button
                    onClick={() => runPreview()}
                    disabled={!canScan || scanning}
                    className="w-full px-5 py-3 bg-accent text-accent-foreground rounded-xl font-semibold text-sm shadow-card hover:bg-accent/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {scanning ? (<><Loader2 className="w-4 h-4 animate-spin" /> Разбираем…</>) : 'Показать предпросмотр'}
                </button>
            </div>

            {unusedHeaders.length > 0 && (
                <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl px-4 py-2.5">
                    Не используются: {unusedHeaders.join(', ')}
                </div>
            )}

            {counts && rows && rows.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                    {BUCKET_ORDER.map((b) => (
                        <div key={b} className="bg-card rounded-xl border border-border p-3 text-center">
                            <div className="text-2xl font-bold text-foreground">{counts[b]}</div>
                            <div className="text-xs text-muted-foreground">{BUCKET_LABEL[b]}</div>
                        </div>
                    ))}
                </div>
            )}

            {rows && buckets && rows.length > 0 && (
                <div className="space-y-3">
                    {BUCKET_ORDER.flatMap((bucket) => buckets[bucket]).map(({ row, state }) => {
                        const bucket = effectiveBucket(row, state);
                        const suggestedName = row.suggestedClientId ? clientById.get(row.suggestedClientId) : null;
                        return (
                            <div key={row.rowIndex} className="bg-card rounded-2xl border border-border shadow-card p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="font-semibold text-foreground text-sm truncate">{row.name || '(без имени)'}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            {row.phone || ''}{row.phone && row.email ? ' · ' : ''}{row.email || ''}
                                            {row.mode === 'spreadsheet' && row.date && ` · ${row.date} ${row.startTime}${row.endTime ? `–${row.endTime}` : ''}`}
                                        </div>
                                    </div>
                                    <span className={`shrink-0 px-2 py-1 rounded-lg text-xs font-medium ${
                                        bucket === 'ready' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                            : bucket === 'review' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                            : bucket === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                            : 'bg-muted text-muted-foreground/70'
                                    }`}>
                                        {BUCKET_LABEL[bucket]}
                                    </span>
                                </div>

                                {row.errorCode && (
                                    <div className="text-xs text-muted-foreground">{ERROR_LABEL[row.errorCode] || row.errorCode}</div>
                                )}

                                {row.bucket !== 'error' && (
                                    <>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => updateRow(row.rowIndex, { action: 'include' })}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${state.action === 'include' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                                            >Импортировать</button>
                                            <button
                                                onClick={() => updateRow(row.rowIndex, { action: 'skip' })}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${state.action === 'skip' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                                            >Пропустить</button>
                                        </div>

                                        {state.action === 'include' && (
                                            <div className="space-y-2 border-t border-border pt-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <select
                                                        value={state.clientMode === 'existing' ? (state.existingClientId || '') : '__new__'}
                                                        onChange={(e) => {
                                                            if (e.target.value === '__new__') updateRow(row.rowIndex, { clientMode: 'new', existingClientId: null });
                                                            else updateRow(row.rowIndex, { clientMode: 'existing', existingClientId: e.target.value || null });
                                                        }}
                                                        className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
                                                    >
                                                        <option value="">— выбрать клиента —</option>
                                                        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                        <option value="__new__">+ Новый клиент</option>
                                                    </select>

                                                    {state.clientMode === 'new' && (
                                                        <>
                                                            <input
                                                                type="text"
                                                                value={state.newClientName}
                                                                onChange={(e) => updateRow(row.rowIndex, { newClientName: e.target.value })}
                                                                placeholder="Имя"
                                                                className="px-3 py-2 rounded-lg border border-border bg-background text-sm flex-1 min-w-[140px]"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={state.newClientPhone}
                                                                onChange={(e) => updateRow(row.rowIndex, { newClientPhone: e.target.value })}
                                                                placeholder="Телефон"
                                                                className="px-3 py-2 rounded-lg border border-border bg-background text-sm w-36"
                                                            />
                                                        </>
                                                    )}

                                                    {suggestedName && state.clientMode !== 'existing' && (
                                                        <button
                                                            onClick={() => updateRow(row.rowIndex, { clientMode: 'existing', existingClientId: row.suggestedClientId })}
                                                            className="text-xs text-primary hover:underline"
                                                        >Похоже, это {suggestedName} — выбрать</button>
                                                    )}
                                                </div>

                                                {row.mode === 'spreadsheet' && (
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <select
                                                            value={state.format}
                                                            onChange={(e) => updateRow(row.rowIndex, { format: e.target.value as 'online' | 'offline' })}
                                                            className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
                                                        >
                                                            <option value="online">Онлайн</option>
                                                            <option value="offline">Очно</option>
                                                        </select>
                                                        {state.format === 'offline' && (
                                                            <select
                                                                value={state.addressId || ''}
                                                                onChange={(e) => updateRow(row.rowIndex, { addressId: e.target.value || null })}
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
                                                            onChange={(e) => updateRow(row.rowIndex, { duration: Number(e.target.value) || state.duration })}
                                                            className="w-20 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                                                        />
                                                        <span className="text-xs text-muted-foreground">мин</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
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
            {attestationModal}
        </div>
    );
}
