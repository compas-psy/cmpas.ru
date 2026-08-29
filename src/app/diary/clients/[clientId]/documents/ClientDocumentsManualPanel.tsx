'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, FileText, RefreshCcw, Send } from 'lucide-react';
import { toast } from 'sonner';

type Delivery = {
    id: string;
    status: string;
    documentTitle: string;
    documentVersion: string;
    deliveryChannel: string;
    recipientContact: string | null;
    sentAt: Date | string;
    openedAt: Date | string | null;
    acknowledgedAt: Date | string | null;
};

export function ClientDocumentsManualPanel({ clientId }: { clientId: string }) {
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [building, setBuilding] = useState(false);

    const loadDeliveries = async () => {
        setLoading(true);
        try {
            const { listClientDocumentDeliveries } = await import('../../../actions/client-documents');
            const data = await listClientDocumentDeliveries(clientId);
            setDeliveries(data as unknown as Delivery[]);
        } catch (e) {
            console.error(e);
            toast.error('Не удалось загрузить журнал документов');
        }
        setLoading(false);
    };

    useEffect(() => { loadDeliveries(); }, [clientId]);

    const buildMessage = async () => {
        setBuilding(true);
        try {
            const { buildClientManualDocumentMessage } = await import('../../../actions/client-document-messages');
            const result = await buildClientManualDocumentMessage(clientId);
            if (!result?.success) throw new Error(result?.error || 'Не удалось сформировать сообщение');
            setMessage(result.text || '');
            await navigator.clipboard.writeText(result.text || '');
            toast.success('Сообщение сформировано и скопировано');
            loadDeliveries();
        } catch (e: any) {
            toast.error(e?.message || 'Не удалось сформировать сообщение');
        }
        setBuilding(false);
    };

    const copyAgain = async () => {
        if (!message) return;
        await navigator.clipboard.writeText(message);
        toast.success('Сообщение скопировано');
    };

    const formatDate = (value: Date | string | null) => {
        if (!value) return '—';
        return new Date(value).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-6 pb-10">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <Link href={`/diary/clients?clientId=${clientId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-3">
                        <ArrowLeft className="w-4 h-4" /> Назад к карточке клиента
                    </Link>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Документы клиента</h1>
                    <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                        Здесь можно сформировать сообщение со ссылками на документы специалиста и посмотреть журнал отправки/открытия.
                    </p>
                </div>
                <button onClick={loadDeliveries} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-muted">
                    <RefreshCcw className="w-4 h-4" /> Обновить
                </button>
            </div>

            <section className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-foreground">Ручная отправка клиенту</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Нажмите кнопку — ПРАКТИКА создаст доставки активных документов, сформирует текст и скопирует его. Дальше отправьте сообщение в Telegram, MAX, WhatsApp или любой другой канал.
                        </p>
                    </div>
                    <button onClick={buildMessage} disabled={building} className="shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-forest-700 disabled:opacity-50">
                        <Send className="w-4 h-4" /> {building ? 'Формирую...' : 'Сформировать и скопировать'}
                    </button>
                </div>

                {message && (
                    <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Текст для клиента</p>
                            <button onClick={copyAgain} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-semibold hover:bg-muted">
                                <Copy className="w-3 h-3" /> Скопировать ещё раз
                            </button>
                        </div>
                        <pre className="whitespace-pre-wrap text-sm leading-6 font-sans text-foreground">{message}</pre>
                    </div>
                )}
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 shadow-card">
                <h2 className="text-lg font-bold text-foreground mb-1">Журнал документов</h2>
                <p className="text-sm text-muted-foreground mb-5">Фиксируется факт формирования/отправки ссылки, открытия документа клиентом и подтверждения ознакомления, если оно включено.</p>

                {loading ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">Загрузка...</div>
                ) : deliveries.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-border rounded-2xl bg-muted/30">
                        <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                        <p className="font-semibold text-foreground">Документы ещё не отправлялись</p>
                        <p className="text-sm text-muted-foreground mt-1">Сформируйте сообщение клиенту или создайте первую сессию.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {deliveries.map(d => (
                            <div key={d.id} className="rounded-2xl border border-border bg-background p-4">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <h3 className="font-bold text-foreground">{d.documentTitle}</h3>
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">v {d.documentVersion}</span>
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">{d.status}</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
                                    <div><b className="text-foreground">Отправлено:</b> {formatDate(d.sentAt)}</div>
                                    <div><b className="text-foreground">Открыто:</b> {formatDate(d.openedAt)}</div>
                                    <div><b className="text-foreground">Канал:</b> {d.deliveryChannel}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
