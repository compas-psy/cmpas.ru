'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, FileText, Plus, RefreshCcw, Send, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

type SpecialistDocument = {
    id: string;
    title: string;
    type: string;
    version: string;
    fileUrl: string | null;
    fileName: string | null;
    isActive: boolean;
    sendOnNewClient: boolean;
    sendOnFirstSession: boolean;
    requiresAcknowledgement: boolean;
    deliveriesCount?: number;
};

type DeliveryRow = {
    id: string;
    status: string;
    documentId: string;
    documentTitle: string;
    documentVersion: string;
    documentContentHash: string;
    deliveryChannel: string;
    recipientContact: string | null;
    sentAt: string;
    openedAt: string | null;
    acknowledgedAt: string | null;
    clientId: string;
    clientName: string;
    sessionId: string | null;
};

const documentTypes = [
    { value: 'informed_consent', label: 'Информированное согласие' },
    { value: 'offer', label: 'Оферта / условия работы' },
    { value: 'personal_data_consent', label: 'Согласие на обработку ПДн' },
    { value: 'recording_consent', label: 'Согласие на запись сессии' },
    { value: 'cancellation_policy', label: 'Правила отмены и переноса' },
    { value: 'payment_terms', label: 'Правила оплаты' },
    { value: 'custom', label: 'Другое' },
];

const statusLabels: Record<string, string> = { sent: 'Отправлен', opened: 'Открыт', acknowledged: 'Принят' };

async function safeJson(response: Response) {
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return { success: false, error: text.slice(0, 300) }; }
}

function openFileUrl(fileUrl: string) {
    if (fileUrl.startsWith('/api/diary/documents/file/')) return fileUrl;
    if (fileUrl.startsWith('/uploads/client-documents/')) return fileUrl.replace('/uploads/client-documents/', '/api/diary/documents/file/');
    return fileUrl;
}

function formatDate(value: string | null) {
    if (!value) return '—';
    try { return new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return value; }
}

export default function DocumentsPage() {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [tab, setTab] = useState<'documents' | 'journal'>('documents');
    const [documents, setDocuments] = useState<SpecialistDocument[]>([]);
    const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [journalLoading, setJournalLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [outdatedBusyDocId, setOutdatedBusyDocId] = useState<string | null>(null);
    const [journalConsentFilter, setJournalConsentFilter] = useState<'all' | 'missing' | 'accepted'>('all');
    const [journalStatusFilter, setJournalStatusFilter] = useState<'all' | 'sent' | 'opened' | 'acknowledged'>('all');
    const [form, setForm] = useState({
        title: '', type: 'informed_consent', version: new Date().toISOString().slice(0, 10), content: '', fileUrl: '', fileName: '', fileMimeType: '', fileSizeBytes: 0,
        sendOnNewClient: true, sendOnFirstSession: true, requiresAcknowledgement: true,
    });

    const loadDocuments = async () => {
        setLoading(true);
        try {
            const { listSpecialistClientDocuments } = await import('../actions/client-documents');
            const data = await listSpecialistClientDocuments();
            setDocuments(data as unknown as SpecialistDocument[]);
        } catch (e) { console.error(e); toast.error('Не удалось загрузить документы'); }
        setLoading(false);
    };

    const loadJournal = async () => {
        setJournalLoading(true);
        try {
            const params = new URLSearchParams({ limit: '200' });
            if (journalConsentFilter !== 'all') params.set('consent', journalConsentFilter);
            if (journalStatusFilter !== 'all') params.set('status', journalStatusFilter);
            const response = await fetch(`/api/diary/documents/deliveries?${params.toString()}`, { cache: 'no-store' });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || 'Не удалось загрузить журнал');
            setDeliveries(Array.isArray(data.items) ? data.items : []);
        } catch (e: any) { toast.error(e?.message || 'Не удалось загрузить журнал'); }
        setJournalLoading(false);
    };

    useEffect(() => { loadDocuments(); }, []);
    useEffect(() => { if (tab === 'journal') loadJournal(); }, [tab, journalConsentFilter, journalStatusFilter]);

    const exportUrl = (() => {
        const params = new URLSearchParams();
        if (journalConsentFilter !== 'all') params.set('consent', journalConsentFilter);
        if (journalStatusFilter !== 'all') params.set('status', journalStatusFilter);
        const query = params.toString();
        return `/api/diary/documents/deliveries/export${query ? `?${query}` : ''}`;
    })();

    const handleFileUpload = async (file: File) => {
        setUploading(true);
        try {
            const data = new FormData(); data.append('file', file);
            const response = await fetch('/api/diary/documents/upload', { method: 'POST', body: data });
            const result = await safeJson(response);
            if (!response.ok || !result?.success) throw new Error(result?.error || `Не удалось загрузить файл. Код ответа: ${response.status}`);
            setForm(f => ({ ...f, fileUrl: result.fileUrl, fileName: result.fileName || file.name, fileMimeType: result.fileMimeType || file.type, fileSizeBytes: result.fileSizeBytes || file.size, title: f.title || file.name.replace(/\.[^.]+$/, '') }));
            toast.success('Файл загружен');
        } catch (e: any) { toast.error(e?.message || 'Не удалось загрузить файл'); }
        setUploading(false);
    };

    const createDocument = async () => {
        if (!form.title.trim()) { toast.error('Введите название документа'); return; }
        if (!form.content.trim() && !form.fileUrl.trim()) { toast.error('Загрузите файл, вставьте ссылку или добавьте текст документа'); return; }
        setCreating(true);
        try {
            const { createSpecialistClientDocument } = await import('../actions/client-documents');
            const result = await createSpecialistClientDocument({
                title: form.title.trim(), type: form.type, version: form.version.trim() || new Date().toISOString().slice(0, 10),
                content: form.content.trim() || null, fileUrl: form.fileUrl.trim() || null, fileName: form.fileName.trim() || null,
                fileMimeType: form.fileMimeType || (form.fileUrl.trim() ? 'application/octet-stream' : null), fileSizeBytes: form.fileSizeBytes || null,
                sendOnNewClient: form.sendOnNewClient, sendOnFirstSession: form.sendOnFirstSession, requiresAcknowledgement: form.requiresAcknowledgement,
            });
            if (!result?.success) throw new Error(result?.error || 'Не удалось добавить документ');
            toast.success('Документ добавлен');
            setForm({ title: '', type: 'informed_consent', version: new Date().toISOString().slice(0, 10), content: '', fileUrl: '', fileName: '', fileMimeType: '', fileSizeBytes: 0, sendOnNewClient: true, sendOnFirstSession: true, requiresAcknowledgement: true });
            loadDocuments();
        } catch (e: any) { toast.error(e?.message || 'Не удалось добавить документ'); }
        setCreating(false);
    };

    const setActive = async (id: string, isActive: boolean) => {
        try {
            const { setSpecialistClientDocumentActive } = await import('../actions/client-documents');
            const result = await setSpecialistClientDocumentActive(id, isActive);
            if (!result?.success) throw new Error(result?.error || 'Не удалось изменить статус документа');
            toast.success(isActive ? 'Документ включён' : 'Документ отключён');
            loadDocuments();
        } catch (e: any) { toast.error(e?.message || 'Не удалось изменить статус документа'); }
    };

    const deleteDocument = async (doc: SpecialistDocument) => {
        const ok = window.confirm(`Удалить документ «${doc.title}»? Если он уже отправлялся клиентам, система не удалит его и предложит отключить.`);
        if (!ok) return;
        try {
            const { deleteSpecialistClientDocument } = await import('../actions/client-documents');
            const result = await deleteSpecialistClientDocument(doc.id);
            if (!result?.success) throw new Error(result?.error || 'Не удалось удалить документ');
            toast.success('Документ удалён'); loadDocuments();
        } catch (e: any) { toast.error(e?.message || 'Не удалось удалить документ'); }
    };

    const checkAndResendOutdated = async (doc: SpecialistDocument) => {
        setOutdatedBusyDocId(doc.id);
        try {
            const response = await fetch(`/api/diary/documents/outdated?documentId=${encodeURIComponent(doc.id)}`, { cache: 'no-store' });
            const data = await response.json();
            if (!response.ok) throw new Error(data?.error || 'Не удалось проверить версии');
            const count = Number(data.count || 0);
            if (count === 0) { toast.success('У клиентов нет старых версий этого документа'); return; }
            const names = Array.isArray(data.clients) ? data.clients.slice(0, 5).map((c: any) => c.clientName).join(', ') : '';
            const ok = window.confirm(`Найдено клиентов со старой версией: ${count}${names ? `\n\nНапример: ${names}` : ''}\n\nПереотправить им актуальную версию «${doc.title}»?`);
            if (!ok) return;
            const resend = await fetch('/api/diary/documents/resend-outdated', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: doc.id }),
            });
            const resendData = await resend.json();
            if (!resend.ok || resendData.success === false) throw new Error(resendData?.error || 'Не удалось переотправить документ');
            toast.success(`Актуальная версия отправлена: ${resendData.count || 0}`);
            loadDocuments();
            if (tab === 'journal') loadJournal();
        } catch (e: any) { toast.error(e?.message || 'Не удалось обработать старые версии'); }
        finally { setOutdatedBusyDocId(null); }
    };

    return (
        <div className="space-y-6 pb-12">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Документы</h1>
                    <p className="text-muted-foreground text-sm mt-1 max-w-2xl">Документы психолога, явные согласия клиентов и журнал: кто, что, какую версию и когда принял.</p>
                </div>
                <button onClick={tab === 'documents' ? loadDocuments : loadJournal} className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl bg-card text-sm font-semibold hover:bg-sage-50"><RefreshCcw className="w-4 h-4" /> Обновить</button>
            </div>

            <div className="inline-flex rounded-2xl border border-border bg-card p-1 shadow-card">
                <button onClick={() => setTab('documents')} className={`px-4 py-2 rounded-xl text-sm font-bold ${tab === 'documents' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>Документы</button>
                <button onClick={() => setTab('journal')} className={`px-4 py-2 rounded-xl text-sm font-bold ${tab === 'journal' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>Журнал согласий</button>
            </div>

            {tab === 'journal' ? (
                <section className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div><h2 className="text-lg font-bold text-foreground">Журнал документов и согласий</h2><p className="text-sm text-muted-foreground">Статусы sent → opened → acknowledged, версия и contentHash сохраняются для проверки 152-ФЗ.</p></div>
                        <a href={exportUrl} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-forest-700"><Download className="w-4 h-4" /> CSV для Excel</a>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <select value={journalConsentFilter} onChange={e => setJournalConsentFilter(e.target.value as any)} className="px-4 py-2.5 border border-border rounded-xl bg-background text-sm font-semibold"><option value="all">Все согласия</option><option value="missing">Без согласия</option><option value="accepted">Принятые</option></select>
                        <select value={journalStatusFilter} onChange={e => setJournalStatusFilter(e.target.value as any)} className="px-4 py-2.5 border border-border rounded-xl bg-background text-sm font-semibold"><option value="all">Все статусы</option><option value="sent">Отправлен</option><option value="opened">Открыт</option><option value="acknowledged">Принят</option></select>
                    </div>
                    {journalLoading ? <div className="py-12 text-center text-sm text-muted-foreground">Загрузка журнала...</div> : deliveries.length === 0 ? <div className="py-12 text-center border border-dashed border-border rounded-2xl bg-muted/30 text-sm text-muted-foreground">Записей по выбранным фильтрам нет.</div> : (
                        <div className="overflow-x-auto rounded-2xl border border-border"><table className="min-w-[980px] w-full text-sm"><thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3">Клиент</th><th className="p-3">Документ</th><th className="p-3">Версия</th><th className="p-3">Статус</th><th className="p-3">Канал</th><th className="p-3">Отправлен</th><th className="p-3">Открыт</th><th className="p-3">Принят</th><th className="p-3">Hash</th></tr></thead><tbody>{deliveries.map(item => <tr key={item.id} className="border-t border-border align-top"><td className="p-3 font-semibold text-foreground">{item.clientName}</td><td className="p-3 text-foreground">{item.documentTitle}</td><td className="p-3"><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">v {item.documentVersion}</span></td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${item.acknowledgedAt ? 'bg-green-50 text-green-700' : item.openedAt ? 'bg-amber-50 text-amber-700' : 'bg-muted text-muted-foreground'}`}>{statusLabels[item.status] || item.status}</span></td><td className="p-3">{item.deliveryChannel}</td><td className="p-3">{formatDate(item.sentAt)}</td><td className="p-3">{formatDate(item.openedAt)}</td><td className="p-3">{formatDate(item.acknowledgedAt)}</td><td className="p-3 font-mono text-xs text-muted-foreground">{item.documentContentHash.slice(0, 12)}…</td></tr>)}</tbody></table></div>
                    )}
                </section>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6">
                    <section className="bg-card border border-border rounded-2xl p-6 shadow-card">
                        <h2 className="text-lg font-bold text-foreground mb-1">Ваши документы</h2>
                        <p className="text-sm text-muted-foreground mb-5">Документы могут автоматически отправляться новому клиенту или перед первой сессией.</p>
                        {loading ? <div className="py-12 text-center text-sm text-muted-foreground">Загрузка...</div> : documents.length === 0 ? <div className="py-12 text-center border border-dashed border-border rounded-2xl bg-muted/30"><FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" /><p className="font-semibold text-foreground">Документы пока не добавлены</p><p className="text-sm text-muted-foreground mt-1">Загрузите PDF/Word с устройства или вставьте текст документа.</p></div> : (
                            <div className="space-y-3">{documents.map(doc => <div key={doc.id} className={`rounded-2xl border p-4 ${doc.isActive ? 'border-border bg-background' : 'border-border/60 bg-muted/40 opacity-70'}`}><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><h3 className="font-bold text-foreground truncate">{doc.title}</h3><span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">v {doc.version}</span>{!doc.isActive && <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">отключён</span>}{!!doc.deliveriesCount && <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">отправок: {doc.deliveriesCount}</span>}</div><p className="text-sm text-muted-foreground mt-1">{documentTypes.find(t => t.value === doc.type)?.label || doc.type}</p>{doc.fileUrl && <a className="text-sm text-primary hover:underline mt-2 inline-block" href={openFileUrl(doc.fileUrl)} target="_blank" rel="noreferrer">Открыть файл{doc.fileName ? `: ${doc.fileName}` : ''}</a>}<div className="flex flex-wrap gap-2 mt-3">{doc.sendOnNewClient && <span className="text-xs px-2 py-1 rounded-lg bg-sage-100 text-forest-700 font-semibold">новому клиенту</span>}{doc.sendOnFirstSession && <span className="text-xs px-2 py-1 rounded-lg bg-sage-100 text-forest-700 font-semibold">перед первой сессией</span>}{doc.requiresAcknowledgement && <span className="text-xs px-2 py-1 rounded-lg bg-amber-100 text-amber-700 font-semibold">явное принятие</span>}</div></div><div className="flex flex-col gap-2 shrink-0"><button onClick={() => checkAndResendOutdated(doc)} disabled={!doc.isActive || outdatedBusyDocId === doc.id} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-200 text-blue-700 hover:bg-blue-50 flex items-center justify-center gap-1 disabled:opacity-50"><Send className="w-3 h-3" /> {outdatedBusyDocId === doc.id ? 'Проверяю…' : 'Старые версии'}</button><button onClick={() => setActive(doc.id, !doc.isActive)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${doc.isActive ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>{doc.isActive ? 'Отключить' : 'Включить'}</button><button onClick={() => deleteDocument(doc)} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 text-red-700 hover:bg-red-50 flex items-center justify-center gap-1"><Trash2 className="w-3 h-3" /> Удалить</button></div></div></div>)}</div>
                        )}
                    </section>

                    <section className="bg-card border border-border rounded-2xl p-6 shadow-card h-fit xl:sticky xl:top-4">
                        <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2"><Plus className="w-5 h-5" /> Добавить документ</h2>
                        <p className="text-sm text-muted-foreground mb-5">По умолчанию документ требует явного принятия клиентом. Это безопаснее для юридического контура беты.</p>
                        <div className="space-y-4">
                            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,.rtf,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/*" onChange={e => { const file = e.target.files?.[0]; if (file) handleFileUpload(file); e.currentTarget.value = ''; }} />
                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-primary text-sm font-bold hover:bg-primary/10 disabled:opacity-50"><Upload className="w-4 h-4" /> {uploading ? 'Загружаю файл...' : 'Загрузить PDF / Word / изображение'}</button>
                            {form.fileUrl && <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">Файл загружен: <b>{form.fileName || form.fileUrl}</b></div>}
                            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm outline-none" placeholder="Название документа" />
                            <div className="grid grid-cols-2 gap-3"><select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm outline-none">{documentTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select><input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm outline-none" placeholder="Версия" /></div>
                            <input value={form.fileUrl} onChange={e => setForm(f => ({ ...f, fileUrl: e.target.value }))} className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm outline-none" placeholder="Ссылка на файл заполнится автоматически после загрузки" />
                            <input value={form.fileName} onChange={e => setForm(f => ({ ...f, fileName: e.target.value }))} className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm outline-none" placeholder="Имя файла" />
                            <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={7} className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm outline-none resize-none" placeholder="Текст документа, если файла нет" />
                            <div className="space-y-3 rounded-2xl border border-border p-4 bg-muted/20"><label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={form.sendOnNewClient} onChange={e => setForm(f => ({ ...f, sendOnNewClient: e.target.checked }))} /> Автоотправка новому клиенту</label><label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={form.sendOnFirstSession} onChange={e => setForm(f => ({ ...f, sendOnFirstSession: e.target.checked }))} /> Автоотправка перед первой сессией</label><label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={form.requiresAcknowledgement} onChange={e => setForm(f => ({ ...f, requiresAcknowledgement: e.target.checked }))} /> Требовать явное принятие</label></div>
                            <button onClick={createDocument} disabled={creating || uploading} className="w-full px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-forest-700 disabled:opacity-50">{creating ? 'Добавляю...' : 'Добавить документ'}</button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
