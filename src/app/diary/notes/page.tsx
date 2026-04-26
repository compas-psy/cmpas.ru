'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Search, Plus, Lock, UserCircle, Check, X } from 'lucide-react';
import { NoteBlockChip, NoteBlockCard, AddBlockSheet } from '@/components/notes/NoteFlowComponents';
import { SmartBlock, SMART_BLOCK_DEFINITIONS, createBlockInstance, getDefinitionById, sortBlocksByDefinition } from '@/lib/smart-notes/config';

type NoteItem = {
    id: string; clientId: string; clientName: string; clientInitials: string;
    sessionNumber: number; date: string; time: string; duration: number;
    format: string; status: string; notes: string | null; structuredNotes: any;
    privateNotes: any; clientSummary: string | null; hasBlocks: boolean;
    blockCount: number; preview: string;
};
type ClientOption = { id: string; name: string };
type SessionWithoutNotes = { id: string; clientId: string; clientName: string; date: string; time: string; duration: number };

export default function NotesPage() {
    const router = useRouter();
    const [notes, setNotes] = useState<NoteItem[]>([]);
    const [clients, setClients] = useState<ClientOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [clientFilter, setClientFilter] = useState('');
    const [selected, setSelected] = useState<NoteItem | null>(null);
    const [showAddBlock, setShowAddBlock] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [showNewNote, setShowNewNote] = useState(false);

    const [editText, setEditText] = useState('');
    const [editBlocks, setEditBlocks] = useState<SmartBlock[]>([]);
    const [editPrivate, setEditPrivate] = useState('');
    const [editClient, setEditClient] = useState('');

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 1024);
        check(); window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const fetchNotes = useCallback(async () => {
        try {
            const { getAllNotes, getClientsForNotesFilter } = await import('../actions/notes-list');
            const [data, cls] = await Promise.all([
                getAllNotes({ search: search || undefined, clientId: clientFilter || undefined }),
                getClientsForNotesFilter(),
            ]);
            setNotes(data);
            setClients(cls);
            if (data.length > 0 && !selected) selectNote(data[0]);
        } catch { toast.error('Ошибка загрузки'); }
        setLoading(false);
    }, [search, clientFilter]);

    useEffect(() => { fetchNotes(); }, [fetchNotes]);

    const selectNote = (note: NoteItem) => {
        setSelected(note);
        setEditText(note.notes || '');
        setEditBlocks(note.structuredNotes?.blocks || []);
        setEditPrivate(typeof note.privateNotes === 'object' ? note.privateNotes?.text || '' : note.privateNotes || '');
        setEditClient(note.clientSummary || '');
    };

    const addBlock = useCallback((defId: string) => {
        setEditBlocks(prev => sortBlocksByDefinition([...prev, createBlockInstance(defId)]));
    }, []);
    const removeBlock = useCallback((id: string) => {
        setEditBlocks(prev => prev.filter(b => b.id !== id));
    }, []);
    const updateBlock = useCallback((id: string, vals: Record<string, string>) => {
        setEditBlocks(prev => prev.map(b => b.id === id ? { ...b, values: vals } : b));
    }, []);

    const handleSave = async () => {
        if (!selected) return;
        setSaving(true);
        try {
            const { saveSessionNotes } = await import('../actions/note-actions');
            await saveSessionNotes(selected.id, {
                notes: editText || undefined,
                structuredNotes: editBlocks.length > 0 ? { blocks: editBlocks } : undefined,
                privateNotes: editPrivate ? { text: editPrivate } : undefined,
                clientSummary: editClient || undefined,
            });
            toast.success('Сохранено');
            fetchNotes();
        } catch { toast.error('Ошибка сохранения'); }
        setSaving(false);
    };

    const existingDefIds = editBlocks.map(b => b.definitionId);
    const p1Blocks = SMART_BLOCK_DEFINITIONS.filter(d => d.priority === 1);

    // Group notes by date
    const groupedNotes: { label: string; items: NoteItem[] }[] = [];
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    let currentGroup = '';
    for (const n of notes) {
        const d = new Date(n.date);
        const ds = d.toDateString();
        const label = ds === today ? 'Сегодня' : ds === yesterday ? 'Вчера' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
        if (label !== currentGroup) {
            groupedNotes.push({ label, items: [] });
            currentGroup = label;
        }
        groupedNotes[groupedNotes.length - 1].items.push(n);
    }

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (notes.length === 0 && !search && !clientFilter) return (
        <div className="space-y-6 max-w-2xl mx-auto text-center py-20">
            <h1 className="text-2xl font-bold text-foreground">Заметки</h1>
            <p className="text-muted-foreground">Здесь появятся заметки после сессий.</p>
            <button onClick={() => setShowNewNote(true)} className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold">
                + Новая заметка
            </button>
            {showNewNote && <NewNoteModal onClose={() => setShowNewNote(false)} />}
        </div>
    );

    // Mobile detail
    if (isMobile && selected) return (
        <div className="space-y-4 -mx-4 -mt-4">
            <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
                <button onClick={() => setSelected(null)} className="text-primary text-sm font-medium">← Назад</button>
                <span className="flex-1 font-bold text-foreground truncate">{selected.clientName} — {selected.sessionNumber}-я сессия</span>
                <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg">
                    {saving ? '...' : 'Сохранить'}
                </button>
            </div>
            <div className="px-4 space-y-4 pb-8">
                <NoteEditorInline editText={editText} setEditText={setEditText} editBlocks={editBlocks}
                    editPrivate={editPrivate} setEditPrivate={setEditPrivate} editClient={editClient} setEditClient={setEditClient}
                    p1Blocks={p1Blocks} existingDefIds={existingDefIds} addBlock={addBlock} removeBlock={removeBlock}
                    updateBlock={updateBlock} setShowAddBlock={setShowAddBlock} />
            </div>
            {showAddBlock && <AddBlockSheet existingIds={existingDefIds} onAdd={addBlock} onClose={() => setShowAddBlock(false)} />}
        </div>
    );

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Заметки</h1>
                    <p className="text-muted-foreground text-sm mt-1">Профессиональные заметки по сессиям</p>
                </div>
                <button onClick={() => setShowNewNote(true)} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-forest-700 transition-all shadow-card active:scale-[0.97]">
                    <Plus className="w-4 h-4" /> Новая заметка
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* LEFT: sticky sidebar */}
                <div className="lg:col-span-3 lg:sticky lg:top-4 bg-card border border-border rounded-2xl shadow-card overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
                    <div className="p-3 border-b border-border space-y-2 shrink-0">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                            <input type="text" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 border border-border rounded-lg bg-background text-[12px] outline-none focus:ring-1 focus:ring-primary/20" />
                        </div>
                        <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-border rounded-lg text-[11px] font-semibold text-muted-foreground bg-background">
                            <option value="">Все клиенты</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 overflow-auto">
                        {groupedNotes.map(group => (
                            <div key={group.label}>
                                <div className="p-1.5 text-[10px] font-bold text-muted-foreground uppercase px-3 pt-3">{group.label}</div>
                                {group.items.map(n => (
                                    <button key={n.id} onClick={() => selectNote(n)}
                                        className={`w-full text-left p-3 mx-1.5 rounded-xl mb-1 transition-all ${selected?.id === n.id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-sage-50'}`}
                                        style={{ width: 'calc(100% - 12px)' }}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-6 h-6 rounded-full bg-sage-100 flex items-center justify-center text-[9px] font-bold text-forest-700 uppercase shrink-0">{n.clientInitials}</div>
                                            <span className="text-[12px] font-bold text-foreground truncate">{n.clientName}</span>
                                            <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{n.time}</span>
                                        </div>
                                        <div className="text-[11px] text-muted-foreground line-clamp-2 ml-8">{n.preview}</div>
                                        <div className="flex items-center gap-1.5 ml-8 mt-2">
                                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded">{n.sessionNumber}-я сессия</span>
                                            {n.hasBlocks && <span className="px-1.5 py-0.5 bg-sage-100 text-forest-700 text-[10px] font-semibold rounded">{n.blockCount} бл.</span>}
                                            {n.privateNotes && <span className="px-1.5 py-0.5 bg-forest-800/10 text-forest-700 text-[10px] font-semibold rounded">🔒</span>}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ))}
                        <div className="p-3 text-center text-[11px] text-muted-foreground/50">{notes.length} заметок</div>
                    </div>
                </div>

                {/* CENTER: Editor — no internal scroll */}
                <div className="lg:col-span-6 bg-card border border-border rounded-2xl shadow-card overflow-hidden">
                    {selected ? (
                        <>
                            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                                <div>
                                    <h2 className="text-[15px] font-bold text-foreground">{selected.clientName} — {selected.sessionNumber}-я сессия</h2>
                                    <div className="text-[12px] text-muted-foreground mt-0.5">
                                        {new Date(selected.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}, {selected.time} · {selected.duration} мин
                                    </div>
                                </div>
                                <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-forest-700 disabled:opacity-50 flex items-center gap-1.5">
                                    {saving ? '...' : <><Check className="w-4 h-4" /> Сохранить</>}
                                </button>
                            </div>
                            <div className="p-5 space-y-6">
                                <NoteEditorInline editText={editText} setEditText={setEditText} editBlocks={editBlocks}
                                    editPrivate={editPrivate} setEditPrivate={setEditPrivate} editClient={editClient} setEditClient={setEditClient}
                                    p1Blocks={p1Blocks} existingDefIds={existingDefIds} addBlock={addBlock} removeBlock={removeBlock}
                                    updateBlock={updateBlock} setShowAddBlock={setShowAddBlock} />
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center text-muted-foreground h-64">
                            <p className="text-sm">Выберите заметку из списка</p>
                        </div>
                    )}
                </div>

                {/* RIGHT: sticky sidebar */}
                <div className="lg:col-span-3 space-y-4 hidden lg:block lg:sticky lg:top-4">
                    {selected && (
                        <>
                            <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
                                <h3 className="text-[13px] font-bold text-foreground mb-3">👤 Клиент</h3>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center text-[13px] font-bold text-forest-700 uppercase">{selected.clientInitials}</div>
                                    <div>
                                        <div className="text-[13px] font-bold text-foreground">{selected.clientName}</div>
                                        <div className="text-[11px] text-muted-foreground">{selected.sessionNumber}-я сессия</div>
                                    </div>
                                </div>
                                <button onClick={() => router.push(`/diary/clients?clientId=${selected.clientId}`)} className="w-full px-3 py-2 border border-border rounded-xl text-[12px] font-semibold text-forest-600 hover:bg-sage-50">Открыть профиль</button>
                            </div>
                            <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
                                <h3 className="text-[13px] font-bold text-foreground mb-3">Метаданные</h3>
                                <div className="space-y-2 text-[12px]">
                                    {[
                                        ['Дата', new Date(selected.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })],
                                        ['Длительность', `${selected.duration} мин`],
                                        ['Формат', selected.format === 'online' ? 'Онлайн' : 'Очно'],
                                    ].map(([k, v]) => (
                                        <div key={k} className="flex items-center gap-2">
                                            <span className="text-muted-foreground w-24 shrink-0">{k}</span>
                                            <span className="font-medium text-foreground">{v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
                                <h3 className="text-[13px] font-bold text-foreground mb-2">Приватность</h3>
                                <div className="text-[12px] text-muted-foreground space-y-1">
                                    <div className="flex items-center gap-2"><Lock className="w-3.5 h-3.5" /><span>{editPrivate ? 'Есть приватные' : 'Нет приватных'}</span></div>
                                    <div className="flex items-center gap-2"><UserCircle className="w-3.5 h-3.5" /><span>{editClient ? 'Есть резюме' : 'Нет резюме'}</span></div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {showAddBlock && <AddBlockSheet existingIds={existingDefIds} onAdd={addBlock} onClose={() => setShowAddBlock(false)} />}
            {showNewNote && <NewNoteModal onClose={() => setShowNewNote(false)} />}
        </div>
    );
}

// ── New Note Modal: pick session without notes ──
function NewNoteModal({ onClose }: { onClose: () => void }) {
    const router = useRouter();
    const [sessions, setSessions] = useState<SessionWithoutNotes[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const { getSessionsWithoutNotes } = await import('../actions/notes-list');
                setSessions(await getSessionsWithoutNotes());
            } catch { /* empty */ }
            setLoading(false);
        })();
    }, []);

    // Group by client
    const grouped: Record<string, SessionWithoutNotes[]> = {};
    for (const s of sessions) {
        if (!grouped[s.clientName]) grouped[s.clientName] = [];
        grouped[s.clientName].push(s);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-floating overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <h3 className="text-[16px] font-bold text-foreground">Новая заметка</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>
                <div className="p-5 max-h-[60vh] overflow-auto">
                    {loading ? (
                        <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                    ) : sessions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            <p className="font-semibold mb-1">Нет сессий без заметок</p>
                            <p>Все завершённые сессии уже имеют заметки.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-[13px] text-muted-foreground">Выберите сессию для заметки:</p>
                            {Object.entries(grouped).map(([clientName, items]) => (
                                <div key={clientName}>
                                    <div className="text-[12px] font-bold text-muted-foreground uppercase mb-2">{clientName}</div>
                                    <div className="space-y-1">
                                        {items.map(s => (
                                            <button key={s.id} onClick={() => { onClose(); router.push(`/diary/session/${s.id}/notes`); }}
                                                className="w-full text-left p-3 rounded-xl hover:bg-sage-50 transition-colors border border-border">
                                                <div className="text-[14px] font-semibold text-foreground">
                                                    {new Date(s.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}, {s.time}
                                                </div>
                                                <div className="text-[12px] text-muted-foreground">{s.duration} мин</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Inline editor (reused in center column and mobile) ──
function NoteEditorInline({ editText, setEditText, editBlocks, editPrivate, setEditPrivate, editClient, setEditClient, p1Blocks, existingDefIds, addBlock, removeBlock, updateBlock, setShowAddBlock }: {
    editText: string; setEditText: (v: string) => void;
    editBlocks: SmartBlock[]; editPrivate: string; setEditPrivate: (v: string) => void;
    editClient: string; setEditClient: (v: string) => void;
    p1Blocks: any[]; existingDefIds: string[];
    addBlock: (id: string) => void; removeBlock: (id: string) => void;
    updateBlock: (id: string, vals: Record<string, string>) => void;
    setShowAddBlock: (v: boolean) => void;
}) {
    return (
        <>
            <div>
                <h3 className="text-[15px] font-bold text-foreground mb-2">Свободная запись</h3>
                <textarea value={editText} onChange={e => setEditText(e.target.value)}
                    placeholder="Что было самым важным в этой сессии?"
                    className="w-full min-h-[120px] px-4 py-4 text-[15px] leading-relaxed border border-border rounded-2xl bg-background resize-y focus:ring-2 focus:ring-forest-700/20 focus:border-forest-700/40 outline-none placeholder:text-muted-foreground/40" />
            </div>
            <div>
                <h3 className="text-[15px] font-bold text-foreground mb-2">Структурные блоки</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                    {p1Blocks.map((def: any) => (
                        <NoteBlockChip key={def.id} defId={def.id} active={existingDefIds.includes(def.id)} onClick={() => {
                            if (existingDefIds.includes(def.id)) {
                                const block = editBlocks.find(b => b.definitionId === def.id);
                                if (block) removeBlock(block.id);
                            } else { addBlock(def.id); }
                        }} />
                    ))}
                    <button onClick={() => setShowAddBlock(true)} className="inline-flex items-center gap-1 px-3 py-2 rounded-full note-chip text-forest-700 bg-sage-50 hover:bg-sage-100 transition-colors">+ Ещё</button>
                </div>
                {editBlocks.length > 0 && (
                    <div className="space-y-3">
                        {editBlocks.map(block => <NoteBlockCard key={block.id} block={block} onUpdate={updateBlock} onRemove={removeBlock} />)}
                    </div>
                )}
            </div>
            <details className="group">
                <summary className="flex items-center gap-2 cursor-pointer text-[15px] font-bold text-foreground list-none [&::-webkit-details-marker]:hidden">
                    <Lock className="w-4 h-4 text-forest-700" /><span>Приватные заметки</span>
                    <span className="text-[12px] text-muted-foreground font-normal ml-1">(только для вас)</span>
                    <span className="ml-auto text-muted-foreground text-[12px] group-open:hidden">▸</span>
                    <span className="ml-auto text-muted-foreground text-[12px] hidden group-open:inline">▾</span>
                </summary>
                <div className="mt-2">
                    <textarea value={editPrivate} onChange={e => setEditPrivate(e.target.value)}
                        placeholder="Рабочие гипотезы, заметки для супервизии..."
                        className="w-full min-h-[80px] px-4 py-3 text-[14px] leading-relaxed border border-forest-700/20 rounded-2xl bg-forest-800/[0.02] resize-y focus:ring-2 focus:ring-forest-700/20 outline-none placeholder:text-muted-foreground/40" />
                </div>
            </details>
            <details className="group">
                <summary className="flex items-center gap-2 cursor-pointer text-[15px] font-bold text-foreground list-none [&::-webkit-details-marker]:hidden">
                    <UserCircle className="w-4 h-4 text-amber-500" /><span>Резюме для клиента</span>
                    <span className="text-[12px] text-muted-foreground font-normal ml-1">(будет видно клиенту)</span>
                    <span className="ml-auto text-muted-foreground text-[12px] group-open:hidden">▸</span>
                    <span className="ml-auto text-muted-foreground text-[12px] hidden group-open:inline">▾</span>
                </summary>
                <div className="mt-2">
                    <textarea value={editClient} onChange={e => setEditClient(e.target.value)}
                        placeholder="Краткое резюме для клиента..."
                        className="w-full min-h-[80px] px-4 py-3 text-[14px] leading-relaxed border border-amber-500/20 rounded-2xl bg-amber-500/[0.02] resize-y focus:ring-2 focus:ring-amber-500/20 outline-none placeholder:text-muted-foreground/40" />
                </div>
            </details>
        </>
    );
}
