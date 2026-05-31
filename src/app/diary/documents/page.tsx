'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Plus, RefreshCcw, Upload } from 'lucide-react';
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

async function safeJson(response: Response) {
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return { success: false, error: text.slice(0, 300) }; }
}

function openFileUrl(fileUrl: string) {
    if (fileUrl.startsWith('/api/diary/documents/file/')) return fileUrl;
    if (fileUrl.startsWith('/uploads/client-documents/')) {
        return fileUrl.replace('/uploads/client-documents/', '/api/diary/documents/file/');
    }
    return fileUrl;
}

export default function DocumentsPage() {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [documents, setDocuments] = useState<SpecialistDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [form, setForm] = useState({
        title: '',
        type: 'informed_consent',
        version: new Date().toISOString().slice(0, 10),
        content: '',
        fileUrl: '',
        fileName: '',
        fileMimeType: '',
        fileSizeBytes: 0,
        sendOnNewClient: true,
        sendOnFirstSession: true,
        requiresAcknowledgement: false,
    });

    const loadDocuments = async () => {
        setLoading(true);
        try {
            const { listSpecialistClientDocuments } = await import('../actions/client-documents');
            const data = await listSpecialistClientDocuments();
            setDocuments(data as unknown as SpecialistDocument[]);
        } catch (e) {
            console.error(e);
            toast.error('Не удалось загрузить документы');
        }
        setLoading(false);
    };

    useEffect(() => { loadDocuments(); }, []);

    const handleFileUpload = async (file: File) => {
        setUploading(true);
        try {
            const data = new FormData();
            data.append('file', file);
            const response = await fetch('/api/diary/documents/upload', { method: 'POST', body: data });
            const result = await safeJson(response);
            if (!response.ok || !result?.success) throw new Error(result?.error || `Не удалось загрузить файл. Код ответа: ${response.status}`);
            setForm(f => ({
                ...f,
                fileUrl: result.fileUrl,
                fileName: result.fileName || file.name,
                fileMimeType: result.fileMimeType || file.type,
                fileSizeBytes: result.fileSizeBytes || file.size,
                title: f.title || file.name.replace(/\.[^.]+$/, ''),
            }));
            toast.success('Файл загружен');
        } catch (e: any) {
            toast.error(e?.message || 'Не удалось загрузить файл');
        }
        setUploading(false);
    };

    const createDocument = async () => {
        if (!form.title.trim()) { toast.error('Введите название документа'); return; }
        if (!form.content.trim() && !form.fileUrl.trim()) { toast.error('Загрузите файл, вставьте ссылку или добавьте текст документа'); return; }
        setCreating(true);
        try {
            const { createSpecialistClientDocument } = await import('../actions/client-documents');
            const result = await createSpecialistClientDocument({
                title: form.title.trim(),
                type: form.type,
                version: form.version.trim() || new Date().toISOString().slice(0, 10),
                content: form.content.trim() || null,
                fileUrl: form.fileUrl.trim() || null,
                fileName: form.fileName.trim() || null,
                fileMimeType: form.fileMimeType || (form.fileUrl.trim() ? 'application/octet-stream' : null),
                fileSizeBytes: form.fileSizeBytes || null,
                sendOnNewClient: form.sendOnNewClient,
                sendOnFirstSession: form.sendOnFirstSession,
                requiresAcknowledgement: form.requiresAcknowledgement,
            });
            if (!result?.success) throw new Error(result?.error || 'Не удалось добавить документ');
            toast.success('Документ добавлен');
            setForm({ title: '', type: 'informed_consent', version: new Date().toISOString().slice(0, 10), content: '', fileUrl: '', fileName: '', fileMimeType: '', fileSizeBytes: 0, sendOnNewClient: true, sendOnFirstSession: true, requiresAcknowledgement: false });
            loadDocuments();
        } catch (e: any) {
            toast.error(e?.message || 'Не удалось добавить документ');
        }
        setCreating(false);
    };

    const setActive = async (id: string, isActive: boolean) => {
        try {
            const { setSpecialistClientDocumentActive } = await import('../actions/client-documents');
            const result = await setSpecialistClientDocumentActive(id, isActive);
            if (!result?.success) throw new Error(result?.error || 'Не удалось изменить статус документа');
            toast.success(isActive ? 'Документ включён' : 'Документ отключён');
            loadDocuments();
        } catch (e: any) {
            toast.error(e?.message || 'Не удалось изменить статус документа');
        }
    };

    return (
        <div className="space-y-6 pb-12">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Документы</h1>
                    <p className="text-muted-foreground text-sm mt-1 max-w-2xl">Ваши собственные документы для клиентов: информированное согласие, оферта, правила оплаты, согласия на запись. КОМПАС только отправляет их и фиксирует факт открытия.</p>
                </div>
                <button onClick={loadDocuments} className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl bg-card text-sm font-semibold hover:bg-sage-50"><RefreshCcw className="w-4 h-4" /> Обновить</button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6">
                <section className="bg-card border border-border rounded-2xl p-6 shadow-card">
                    <h2 className="text-lg font-bold text-foreground mb-1">Ваши документы</h2>
                    <p className="text-sm text-muted-foreground mb-5">Документы могут автоматически отправляться новому клиенту или перед первой сессией.</p>
                    {loading ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">Загрузка...</div>
                    ) : documents.length === 0 ? (
                        <div className="py-12 text-center border border-dashed border-border rounded-2xl bg-muted/30">
                            <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                            <p className="font-semibold text-foreground">Документы пока не добавлены</p>
                            <p className="text-sm text-muted-foreground mt-1">Загрузите PDF/Word с устройства или вставьте текст документа.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {documents.map(doc => (
                                <div key={doc.id} className={`rounded-2xl border p-4 ${doc.isActive ? 'border-border bg-background' : 'border-border/60 bg-muted/40 opacity-70'}`}>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-bold text-foreground truncate">{doc.title}</h3>
                                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">v {doc.version}</span>
                                                {!doc.isActive && <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">отключён</span>}
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1">{documentTypes.find(t => t.value === doc.type)?.label || doc.type}</p>
                                            {doc.fileUrl && <a className="text-sm text-primary hover:underline mt-2 inline-block" href={openFileUrl(doc.fileUrl)} target="_blank" rel="noreferrer">Открыть файл{doc.fileName ? `: ${doc.fileName}` : ''}</a>}
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {doc.sendOnNewClient && <span className="text-xs px-2 py-1 rounded-lg bg-sage-100 text-forest-700 font-semibold">новому клиенту</span>}
                                                {doc.sendOnFirstSession && <span className="text-xs px-2 py-1 rounded-lg bg-sage-100 text-forest-700 font-semibold">перед первой сессией</span>}
                                                {doc.requiresAcknowledgement && <span className="text-xs px-2 py-1 rounded-lg bg-amber-100 text-amber-700 font-semibold">ознакомление</span>}
                                            </div>
                                        </div>
                                        <button onClick={() => setActive(doc.id, !doc.isActive)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${doc.isActive ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
                                            {doc.isActive ? 'Отключить' : 'Включить'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="bg-card border border-border rounded-2xl p-6 shadow-card h-fit xl:sticky xl:top-4">
                    <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2"><Plus className="w-5 h-5" /> Добавить документ</h2>
                    <p className="text-sm text-muted-foreground mb-5">Загрузите файл с компьютера/телефона, вставьте ссылку или добавьте текст.</p>
                    <div className="space-y-4">
                        <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,.rtf,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/*" onChange={e => { const file = e.target.files?.[0]; if (file) handleFileUpload(file); e.currentTarget.value = ''; }} />
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-primary text-sm font-bold hover:bg-primary/10 disabled:opacity-50">
                            <Upload className="w-4 h-4" /> {uploading ? 'Загружаю файл...' : 'Загрузить PDF / Word / изображение'}
                        </button>
                        {form.fileUrl && <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">Файл загружен: <b>{form.fileName || form.fileUrl}</b></div>}
                        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm outline-none" placeholder="Название документа" />
                        <div className="grid grid-cols-2 gap-3">
                            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm outline-none">{documentTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
                            <input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm outline-none" placeholder="Версия" />
                        </div>
                        <input value={form.fileUrl} onChange={e => setForm(f => ({ ...f, fileUrl: e.target.value }))} className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm outline-none" placeholder="Ссылка на файл заполнится автоматически после загрузки" />
                        <input value={form.fileName} onChange={e => setForm(f => ({ ...f, fileName: e.target.value }))} className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm outline-none" placeholder="Имя файла" />
                        <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={7} className="w-full px-4 py-3 border border-border rounded-xl bg-background text-sm outline-none resize-none" placeholder="Текст документа, если файла нет" />
                        <div className="space-y-3 rounded-2xl border border-border p-4 bg-muted/20">
                            <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={form.sendOnNewClient} onChange={e => setForm(f => ({ ...f, sendOnNewClient: e.target.checked }))} /> Автоотправка новому клиенту</label>
                            <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={form.sendOnFirstSession} onChange={e => setForm(f => ({ ...f, sendOnFirstSession: e.target.checked }))} /> Автоотправка перед первой сессией</label>
                            <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={form.requiresAcknowledgement} onChange={e => setForm(f => ({ ...f, requiresAcknowledgement: e.target.checked }))} /> Просить подтвердить ознакомление</label>
                        </div>
                        <button onClick={createDocument} disabled={creating || uploading} className="w-full px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-forest-700 disabled:opacity-50">{creating ? 'Добавляю...' : 'Добавить документ'}</button>
                    </div>
                </section>
            </div>
        </div>
    );
}
