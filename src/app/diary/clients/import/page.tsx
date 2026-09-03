'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ClipboardPaste, Check, AlertCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { parseClientLines, type ParsedClient } from '@/lib/clients/parse';
import { useAttestationGate } from '@/components/legal/useAttestationGate';

const EXAMPLE = `Анна Иванова, +79161234567, anna@example.com
Михаил Петров; +79031112233
Ольга Смирнова
Дмитрий Новиков  +7 (903) 555-77-88  d.novikov@mail.ru`;

export default function ImportClientsPage() {
    const router = useRouter();
    const [text, setText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { guard: attestationGuard, modal: attestationModal } = useAttestationGate();

    const parsed = useMemo<ParsedClient[]>(() => parseClientLines(text), [text]);
    const validItems = parsed.filter(p => p.valid);
    const invalidItems = parsed.filter(p => !p.valid);

    const handleSubmit = async () => {
        if (validItems.length === 0) {
            toast.error('Нет клиентов для добавления');
            return;
        }
        setSubmitting(true);
        try {
            const { bulkCreateClients } = await import('../../actions/clients');
            const result = await attestationGuard(() => bulkCreateClients(
                validItems.map(p => ({ name: p.name, phone: p.phone, email: p.email }))
            ));
            if (result.created > 0) {
                toast.success(
                    `Добавлено ${result.created}${result.skipped > 0 ? `, пропущено дубликатов: ${result.skipped}` : ''}`
                );
                router.push('/diary/clients');
            } else if (result.skipped > 0) {
                toast.info('Все клиенты уже существуют — пропущено');
            } else {
                toast.error('Не удалось добавить клиентов');
            }
        } catch (err) {
            if (!(err instanceof Error && err.message === 'Отменено')) toast.error('Ошибка при добавлении');
        } finally {
            setSubmitting(false);
        }
    };

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
                    <ClipboardPaste className="w-8 h-8 text-accent" strokeWidth={1.5} />
                    Вставить списком
                </h1>
                <p className="text-muted-foreground text-sm mt-2">
                    Скопируйте клиентов из заметок, таблицы или старого списка — ПРАКТИКА сама разберёт строки.
                </p>
            </div>

            {/* Instructions */}
            <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
                <h2 className="font-semibold text-foreground mb-2 text-sm">Формат</h2>
                <p className="text-muted-foreground text-sm mb-3">
                    Одна строка — один клиент. Поля разделяются запятой, точкой с запятой или табом. Порядок полей не важен:
                    имя, телефон и email ПРАКТИКА определит сама.
                </p>
                <pre className="bg-background border border-border/50 rounded-lg p-3 text-xs font-mono text-muted-foreground overflow-x-auto">
{EXAMPLE}
                </pre>
                <button
                    onClick={() => setText(EXAMPLE)}
                    className="mt-3 text-xs text-primary hover:underline font-medium"
                    type="button"
                >
                    Подставить пример
                </button>
            </div>

            {/* Textarea */}
            <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                    Список клиентов
                </label>
                <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    rows={10}
                    placeholder="Анна Иванова, +79161234567, anna@example.com"
                    className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm font-mono transition-all resize-y"
                />
            </div>

            {/* Preview */}
            {parsed.length > 0 && (
                <div className="space-y-3">
                    <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
                        <Users className="w-4 h-4 text-accent" />
                        Предпросмотр: {validItems.length} готовы к добавлению
                        {invalidItems.length > 0 && (
                            <span className="text-amber-600 dark:text-amber-400">
                                · {invalidItems.length} с ошибкой
                            </span>
                        )}
                    </h2>
                    <div className="bg-card rounded-2xl border border-border shadow-card divide-y divide-border">
                        {parsed.map((p, i) => (
                            <div
                                key={i}
                                className={`flex items-center gap-3 px-4 py-3 ${
                                    p.valid ? '' : 'bg-amber-50/50 dark:bg-amber-950/20'
                                }`}
                            >
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                        p.valid
                                            ? 'bg-primary/10 text-primary'
                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    }`}
                                >
                                    {p.valid ? (
                                        <Check className="w-4 h-4" strokeWidth={2.5} />
                                    ) : (
                                        <AlertCircle className="w-4 h-4" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    {p.valid ? (
                                        <>
                                            <div className="font-semibold text-foreground text-sm truncate">
                                                {p.name}
                                            </div>
                                            <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                                                {p.phone && <span>{p.phone}</span>}
                                                {p.email && <span>{p.email}</span>}
                                                {!p.phone && !p.email && (
                                                    <span className="italic">только имя</span>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="text-sm text-foreground truncate font-mono">
                                                {p.raw}
                                            </div>
                                            <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                                                {p.error}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Submit */}
            <div className="flex gap-3 sticky bottom-4 bg-background/80 backdrop-blur-md py-3 -mx-4 px-4 rounded-xl">
                <Link
                    href="/diary/clients"
                    className="px-5 py-3 border border-border rounded-xl font-medium text-sm hover:bg-muted transition-colors"
                >
                    Отмена
                </Link>
                <button
                    onClick={handleSubmit}
                    disabled={submitting || validItems.length === 0}
                    className="flex-1 px-5 py-3 bg-accent text-accent-foreground rounded-xl font-semibold text-sm shadow-card hover:bg-accent/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {submitting
                        ? 'Добавляем…'
                        : validItems.length > 0
                            ? `Добавить ${validItems.length} ${pluralClients(validItems.length)}`
                            : 'Вставьте список выше'}
                </button>
            </div>
            {attestationModal}
        </div>
    );
}

function pluralClients(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'клиента';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'клиентов';
    return 'клиентов';
}
