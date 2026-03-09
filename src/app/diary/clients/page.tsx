'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Plus, X, ChevronRight, FileText, Archive, RotateCcw, Trash2, Calendar, StickyNote, ClipboardList, Settings2, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { SessionModal } from '../components/SessionModal';
import { DatePicker } from '@/components/ui/date-picker';
import { PhoneInput } from '@/components/ui/phone-input';

type QuestionnaireData = {
    fullName?: string; dateOfBirth?: string; age?: number; gender?: string;
    phone?: string; email?: string; familyStatus?: string; children?: string;
    livingWith?: string; significantFigures?: string; occupation?: string;
    position?: string; stressLevel?: number;
    stressCoping?: { sport?: boolean; meditation?: boolean; hobbies?: boolean; communication?: boolean; alcohol?: boolean; isolation?: boolean; other?: string; };
    mentalDisorders?: string;
    currentSymptoms?: { insomnia?: boolean; headache?: boolean; bodyPain?: boolean; none?: boolean; other?: string; };
    medications?: string; sleepHours?: number; sleepQuality?: string;
    previousTherapy?: boolean; previousTherapyMethods?: string; previousTherapyResult?: string;
    psychiatricDiagnoses?: boolean; keyTraumas?: string; shortTermGoals?: string;
    longTermGoals?: string; therapistNotes?: string; preferredMethod?: string;
};

type Client = {
    id: string; name: string; phone: string | null; email: string | null;
    gender: string | null; totalSessions: number; nextSessionDate: string | null;
    status: string; questionnaire: { id: string; data: QuestionnaireData } | null;
    sessions?: Session[];
    consentVersion?: string | null; consentHash?: string | null; consentDate?: Date | null;
    psychologistId?: string;
};

type Session = {
    id: string; date: string; time: string; endTime: string | null;
    duration: number; type: string; format: string; status: string; notes: string | null;
};

const statusLabels: Record<string, string> = { confirmed: 'Подтверждено', pending: 'Ожидает', completed: 'Завершено', cancelled: 'Отменено' };
const statusDot: Record<string, string> = { confirmed: 'bg-green-500', pending: 'bg-amber-500', completed: 'bg-muted-foreground', cancelled: 'bg-destructive' };

export default function ClientsPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('active');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [mobileTab, setMobileTab] = useState<'sessions' | 'notes' | 'questionnaire' | 'documents' | 'manage'>('sessions');
    const [desktopTab, setDesktopTab] = useState<'sessions' | 'questionnaire' | 'notes' | 'documents'>('sessions');
    const [showNewClient, setShowNewClient] = useState(false);
    const [showEditQuestionnaire, setShowEditQuestionnaire] = useState(false);
    const [showNewSession, setShowNewSession] = useState(false);
    const [editingSession, setEditingSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmName, setDeleteConfirmName] = useState('');
    const [editingNotes, setEditingNotes] = useState<{ sessionId: string; notes: string } | null>(null);
    const [newClient, setNewClient] = useState({ name: '', phone: '', email: '', gender: '' });
    const [questionnaireForm, setQuestionnaireForm] = useState<QuestionnaireData>({});
    const notesTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 1024);
        check(); window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const fetchClients = useCallback(async () => {
        try {
            const { getClients } = await import('../actions/clients');
            const data = await getClients(search || undefined, statusFilter);
            setClients(data as unknown as Client[]);
        } catch { /* empty */ }
        setLoading(false);
    }, [search, statusFilter]);

    const fetchClientDetail = useCallback(async (id: string) => {
        try {
            const { getClient } = await import('../actions/clients');
            const data = await getClient(id);
            if (data) {
                setSelectedClient(data as unknown as Client);
                if (data.questionnaire?.data) setQuestionnaireForm(data.questionnaire.data as QuestionnaireData);
            }
        } catch { /* empty */ }
    }, []);

    useEffect(() => { fetchClients(); }, [fetchClients]);

    useEffect(() => {
        if (questionnaireForm.dateOfBirth) {
            const bd = new Date(questionnaireForm.dateOfBirth), today = new Date();
            let age = today.getFullYear() - bd.getFullYear();
            const m = today.getMonth() - bd.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
            if (age >= 0 && age !== questionnaireForm.age) setQuestionnaireForm(f => ({ ...f, age }));
        }
    }, [questionnaireForm.dateOfBirth]);

    const handleCreateClient = async () => {
        if (!newClient.name.trim()) { toast.error('Введите имя клиента'); return; }
        try {
            const { createClient } = await import('../actions/clients');
            await createClient(newClient);
            toast.success('Клиент добавлен');
            setShowNewClient(false); setNewClient({ name: '', phone: '', email: '', gender: '' });
            fetchClients();
        } catch { toast.error('Ошибка при создании клиента'); }
    };

    const handleSaveQuestionnaire = async () => {
        if (!selectedClient) return;
        try {
            const { saveQuestionnaire } = await import('../actions/clients');
            await saveQuestionnaire(selectedClient.id, questionnaireForm);
            toast.success('Анкета сохранена'); setShowEditQuestionnaire(false);
            fetchClientDetail(selectedClient.id);
        } catch { toast.error('Ошибка при сохранении'); }
    };

    const handleArchive = async (id: string) => {
        try {
            const { archiveClient } = await import('../actions/clients');
            await archiveClient(id);
            toast.success('Клиент перемещён в архив');
            setSelectedClient(null); fetchClients();
        } catch { toast.error('Ошибка'); }
    };

    const handleRestore = async (id: string) => {
        try {
            const { restoreClient } = await import('../actions/clients');
            await restoreClient(id);
            toast.success('Клиент восстановлен');
            setSelectedClient(null); fetchClients();
        } catch { toast.error('Ошибка'); }
    };

    const handleDelete = async () => {
        if (!selectedClient) return;
        try {
            const { deleteClient } = await import('../actions/clients');
            await deleteClient(selectedClient.id);
            toast.success('Клиент удалён'); setShowDeleteConfirm(false); setDeleteConfirmName('');
            setSelectedClient(null); fetchClients();
        } catch { toast.error('Ошибка при удалении'); }
    };

    const saveNotes = async (sessionId: string, notes: string) => {
        try {
            const { updateSessionNotes } = await import('../actions/clients');
            await updateSessionNotes(sessionId, notes);
        } catch { /* silent */ }
    };

    const handleNotesChange = (sessionId: string, notes: string) => {
        setEditingNotes({ sessionId, notes });
        if (notesTimer.current) clearTimeout(notesTimer.current);
        notesTimer.current = setTimeout(() => saveNotes(sessionId, notes), 2000);
    };

    const clientName = (c: Client) => c.questionnaire?.data?.fullName || c.name;
    const clientInitials = (c: Client) => (clientName(c) || '?').slice(0, 2).toUpperCase();

    const now = new Date();
    const futureSessions = selectedClient?.sessions?.filter(s => new Date(s.date) >= now && s.status !== 'cancelled') || [];
    const pastSessions = selectedClient?.sessions?.filter(s => new Date(s.date) < now || s.status === 'completed') || [];
    const sessionsWithNotes = selectedClient?.sessions?.filter(s => s.notes) || [];

    // Alphabet index
    const alphabet = Array.from(new Set(clients.map(c => (clientName(c) || '?')[0].toUpperCase()))).sort();

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    );

    // ======================== MOBILE CLIENT DETAIL ========================
    if (isMobile && selectedClient) {
        return (
            <div className="space-y-0 -mx-4 -mt-4">
                {/* Header */}
                <div className="bg-card border-b border-border px-4 pt-4 pb-3">
                    <button onClick={() => setSelectedClient(null)} className="flex items-center gap-1 text-primary text-sm font-medium mb-3 active:opacity-70">
                        <ChevronLeft className="w-4 h-4" /> Клиенты
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full border-2 border-primary/30 flex items-center justify-center text-primary font-bold text-lg uppercase shrink-0">
                            {clientInitials(selectedClient)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-xl font-bold text-foreground truncate">{clientName(selectedClient)}</h2>
                            <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                                {selectedClient.phone && <span>{selectedClient.phone}</span>}
                                <span>{selectedClient.totalSessions} сессий</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-card border-b border-border px-1 overflow-x-auto telegram-miniapp-scrollbar-hide">
                    {([
                        { key: 'sessions' as const, icon: Calendar, label: 'Записи' },
                        { key: 'notes' as const, icon: StickyNote, label: 'Заметки' },
                        { key: 'questionnaire' as const, icon: ClipboardList, label: 'Анкета' },
                        { key: 'documents' as const, icon: FileText, label: 'Документы' },
                        { key: 'manage' as const, icon: Settings2, label: 'Управление' },
                    ]).map(t => (
                        <button key={t.key} onClick={() => setMobileTab(t.key)}
                            className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 text-xs font-semibold transition-colors border-b-2 min-w-[70px] ${mobileTab === t.key ? 'text-primary border-primary' : 'text-muted-foreground border-transparent'}`}>
                            <t.icon className="w-4 h-4" /> {t.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="px-4 py-4">
                    {mobileTab === 'sessions' && (
                        <div className="space-y-4">
                            {futureSessions.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Предстоящие</h3>
                                    {futureSessions.map(s => <SessionCard key={s.id} s={s} onEdit={() => { setEditingSession(s); setShowNewSession(true); }} accent />)}
                                </div>
                            )}
                            {pastSessions.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Прошедшие</h3>
                                    {pastSessions.map(s => <SessionCard key={s.id} s={s} onEdit={() => { setEditingSession(s); setShowNewSession(true); }} />)}
                                </div>
                            )}
                            {!futureSessions.length && !pastSessions.length && (
                                <div className="text-center py-12 text-muted-foreground text-sm">Нет сессий</div>
                            )}
                            <button onClick={() => { setEditingSession(null); setShowNewSession(true); }}
                                className="w-full py-3.5 bg-accent text-accent-foreground rounded-xl font-medium shadow-sm active:scale-[0.98] transition-all">
                                Запланировать сессию
                            </button>
                        </div>
                    )}

                    {mobileTab === 'notes' && (
                        <div className="space-y-3">
                            {editingNotes ? (
                                <div className="fixed inset-0 z-50 bg-background flex flex-col">
                                    <div className="flex items-center justify-between p-4 border-b border-border">
                                        <button onClick={() => { saveNotes(editingNotes.sessionId, editingNotes.notes); setEditingNotes(null); fetchClientDetail(selectedClient.id); }}
                                            className="text-primary font-semibold text-sm">← Назад</button>
                                        <span className="text-xs text-muted-foreground">Автосохранение</span>
                                    </div>
                                    <textarea autoFocus value={editingNotes.notes}
                                        onChange={e => handleNotesChange(editingNotes.sessionId, e.target.value)}
                                        className="flex-1 p-4 text-foreground bg-background resize-none focus:outline-none text-base leading-relaxed"
                                        placeholder="Заметки о сессии..." />
                                </div>
                            ) : (
                                <>
                                    {selectedClient.sessions?.map(s => (
                                        <button key={s.id} onClick={() => setEditingNotes({ sessionId: s.id, notes: s.notes || '' })}
                                            className="w-full text-left p-4 bg-card border border-border rounded-2xl transition-all active:scale-[0.98]">
                                            <div className="text-xs font-semibold text-muted-foreground mb-1">
                                                {new Date(s.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · {s.time}
                                            </div>
                                            <div className="text-sm text-foreground line-clamp-2">
                                                {s.notes || <span className="text-muted-foreground italic">Нет заметок — нажмите, чтобы добавить</span>}
                                            </div>
                                        </button>
                                    ))}
                                    {!selectedClient.sessions?.length && (
                                        <div className="text-center py-12 text-muted-foreground text-sm">Нет сессий для заметок</div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {mobileTab === 'questionnaire' && (
                        <div className="space-y-4">
                            <QuestionnaireView data={selectedClient.questionnaire?.data} />
                            <button onClick={() => { setShowEditQuestionnaire(true); setQuestionnaireForm(selectedClient.questionnaire?.data || { fullName: selectedClient.name, gender: selectedClient.gender || undefined, phone: selectedClient.phone || undefined, email: selectedClient.email || undefined }); }}
                                className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium shadow-sm active:scale-[0.98]">
                                {selectedClient.questionnaire?.data ? 'Редактировать' : 'Заполнить анкету'}
                            </button>
                        </div>
                    )}

                    {mobileTab === 'documents' && (
                        <div className="space-y-4">
                            <DocumentsView client={selectedClient} />
                        </div>
                    )}

                    {mobileTab === 'manage' && (
                        <div className="space-y-3">
                            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                                <h3 className="font-bold text-foreground text-sm">Контакты</h3>
                                <div className="text-sm text-muted-foreground space-y-1">
                                    {selectedClient.phone && <div>📱 {selectedClient.phone}</div>}
                                    {selectedClient.email && <div>✉️ {selectedClient.email}</div>}
                                    {selectedClient.gender && <div>👤 {selectedClient.gender === 'male' ? 'Мужской' : 'Женский'}</div>}
                                </div>
                            </div>
                            <button onClick={() => {
                                navigator.clipboard.writeText(`https://cmpas.ru/bot/book/${selectedClient.psychologistId}?c=${selectedClient.id}`);
                                toast.success('Персональная ссылка скопирована');
                            }}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium active:scale-[0.98]">
                                <ClipboardList className="w-4 h-4" /> Скопировать ссылку для бронирования
                            </button>
                            {selectedClient.status === 'active' ? (
                                <button onClick={() => handleArchive(selectedClient.id)}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-muted text-foreground rounded-xl font-medium active:scale-[0.98]">
                                    <Archive className="w-4 h-4" /> В архив
                                </button>
                            ) : (
                                <button onClick={() => handleRestore(selectedClient.id)}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-primary/10 text-primary rounded-xl font-medium active:scale-[0.98]">
                                    <RotateCcw className="w-4 h-4" /> Восстановить
                                </button>
                            )}
                            <button onClick={() => { setShowDeleteConfirm(true); setDeleteConfirmName(''); }}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-destructive/10 text-destructive rounded-xl font-medium active:scale-[0.98]">
                                <Trash2 className="w-4 h-4" /> Удалить клиента
                            </button>
                        </div>
                    )}
                </div>

                {renderDeleteModal()}
                {renderQuestionnaireModal()}
                <SessionModal isOpen={showNewSession} onClose={() => { setShowNewSession(false); setEditingSession(null); }}
                    onSave={() => { fetchClients(); fetchClientDetail(selectedClient.id); }}
                    initialClient={{ id: selectedClient.id, name: selectedClient.name }}
                    editSession={editingSession} clients={clients.map(c => ({ id: c.id, name: c.name }))} />
            </div>
        );
    }

    // ======================== MAIN LIST / DESKTOP ========================
    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Клиенты</h1>
                    <p className="text-muted-foreground text-sm mt-1">{clients.length} клиентов</p>
                </div>
                <button onClick={() => setShowNewClient(true)}
                    className="flex items-center gap-2 px-6 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-all font-semibold self-start shadow-sm active:scale-[0.98]">
                    <Plus className="w-4 h-4" /> Добавить
                </button>
            </div>

            {/* Search + Filter */}
            <div className="flex gap-3 items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input type="text" placeholder="Поиск по имени..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm transition-all" />
                </div>
                <div className="flex bg-muted rounded-xl p-1 gap-0.5 shrink-0">
                    {[{ v: 'active', l: 'Активные' }, { v: 'archived', l: 'Архив' }].map(f => (
                        <button key={f.v} onClick={() => setStatusFilter(f.v)}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${statusFilter === f.v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                            {f.l}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Client List */}
                <div className="flex flex-col space-y-2 relative">
                    {/* Alphabet sidebar - mobile */}
                    {isMobile && alphabet.length > 3 && (
                        <div className="fixed right-1 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-0.5">
                            {alphabet.map(letter => (
                                <button key={letter} onClick={() => {
                                    const el = document.getElementById(`client-letter-${letter}`);
                                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }} className="text-[10px] font-bold text-primary/60 w-5 h-5 flex items-center justify-center active:text-primary">{letter}</button>
                            ))}
                        </div>
                    )}
                    {clients.map((c, i) => {
                        const letter = (clientName(c) || '?')[0].toUpperCase();
                        const prevLetter = i > 0 ? (clientName(clients[i - 1]) || '?')[0].toUpperCase() : '';
                        const showLetter = letter !== prevLetter;
                        const nextSession = c.sessions?.find(s => new Date(s.date) >= now && s.status !== 'cancelled');
                        return (
                            <div key={c.id}>
                                {showLetter && <div id={`client-letter-${letter}`} className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1 pt-3 pb-1">{letter}</div>}
                                <button onClick={() => { setSelectedClient(c); fetchClientDetail(c.id); setMobileTab('sessions'); setDesktopTab('sessions'); }}
                                    className={`w-full p-4 bg-card rounded-2xl border text-left hover:shadow-md transition-all flex items-center gap-4 ${selectedClient?.id === c.id ? 'border-primary ring-2 ring-primary ring-inset shadow-sm' : 'border-border shadow-sm'}`}>
                                    <div className="w-12 h-12 rounded-full border-2 border-primary/30 flex items-center justify-center text-primary font-bold text-base shrink-0 uppercase">
                                        {clientInitials(c)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-foreground text-base truncate mb-0.5">{clientName(c)}</p>
                                        {nextSession ? (
                                            <p className="text-xs font-medium text-green-600 dark:text-green-400">
                                                📅 {new Date(nextSession.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} · {nextSession.time}
                                            </p>
                                        ) : (
                                            <p className="text-sm font-medium text-muted-foreground">{c.totalSessions} сессий</p>
                                        )}
                                    </div>
                                    {c.status === 'archived' && <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-semibold">Архив</span>}
                                    <ChevronRight className="w-5 h-5 text-muted-foreground/50 shrink-0" />
                                </button>
                            </div>
                        );
                    })}
                    {clients.length === 0 && <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-sm"><p className="text-muted-foreground font-medium text-sm">Нет клиентов</p></div>}
                </div>

                {/* Desktop Detail */}
                <div className="lg:col-span-2 hidden lg:block">
                    {!selectedClient ? (
                        <div className="bg-card rounded-2xl border border-border shadow-sm p-12 text-center h-full flex flex-col items-center justify-center min-h-[400px]">
                            <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
                            <p className="text-muted-foreground font-medium">Выберите клиента</p>
                        </div>
                    ) : (
                        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-12rem)] min-h-[600px]">
                            {/* Header */}
                            <div className="p-6 pb-0">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 rounded-full border-2 border-primary/30 flex items-center justify-center text-primary font-bold text-xl uppercase">{clientInitials(selectedClient)}</div>
                                    <div className="flex-1">
                                        <h2 className="text-2xl font-bold text-foreground mb-1">{clientName(selectedClient)}</h2>
                                        <div className="flex gap-4 text-sm text-muted-foreground">
                                            {selectedClient.phone && <span>{selectedClient.phone}</span>}
                                            {selectedClient.email && <span>{selectedClient.email}</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => {
                                            navigator.clipboard.writeText(`https://cmpas.ru/bot/book/${selectedClient.psychologistId}?c=${selectedClient.id}`);
                                            toast.success('Персональная ссылка скопирована');
                                        }} className="p-2 hover:bg-muted rounded-xl transition-colors" title="Скопировать ссылку для клиента"><ClipboardList className="w-5 h-5 text-primary" /></button>
                                        {selectedClient.status === 'active' ? (
                                            <button onClick={() => handleArchive(selectedClient.id)} className="p-2 hover:bg-muted rounded-xl transition-colors" title="В архив"><Archive className="w-5 h-5 text-muted-foreground" /></button>
                                        ) : (
                                            <button onClick={() => handleRestore(selectedClient.id)} className="p-2 hover:bg-muted rounded-xl transition-colors" title="Восстановить"><RotateCcw className="w-5 h-5 text-primary" /></button>
                                        )}
                                        <button onClick={() => { setShowDeleteConfirm(true); setDeleteConfirmName(''); }} className="p-2 hover:bg-destructive/10 rounded-xl transition-colors" title="Удалить"><Trash2 className="w-5 h-5 text-destructive" /></button>
                                    </div>
                                </div>
                                {/* Next session highlight */}
                                {futureSessions.length > 0 && (
                                    <div className="mt-4 p-4 border border-border rounded-2xl flex items-center gap-4 bg-transparent shadow-sm">
                                        <Calendar className="w-8 h-8 text-primary shrink-0 opacity-80" />
                                        <div>
                                            <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Ближайшая запись</div>
                                            <div className="text-base font-semibold text-foreground">
                                                {new Date(futureSessions[0].date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · {futureSessions[0].time}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Tabs */}
                            <div className="flex mt-4 px-6 border-b border-border">
                                {([
                                    { key: 'sessions' as const, label: `Записи (${(selectedClient.sessions?.length || 0)})` },
                                    { key: 'questionnaire' as const, label: 'Анкета' },
                                    { key: 'notes' as const, label: `Заметки (${sessionsWithNotes.length})` },
                                    { key: 'documents' as const, label: 'Документы' },
                                ]).map(t => (
                                    <button key={t.key} onClick={() => setDesktopTab(t.key)}
                                        className={`flex-1 px-6 py-4 font-semibold text-sm border-b-2 transition-colors ${desktopTab === t.key ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}>
                                        {t.label}
                                    </button>
                                ))}
                            </div>

                            {/* Content */}
                            <div className="p-6 flex-1 overflow-auto telegram-miniapp-scrollbar-hide">
                                {desktopTab === 'sessions' && (
                                    <div className="space-y-4">
                                        {futureSessions.length > 0 && (
                                            <div><h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Предстоящие</h3>{futureSessions.map(s => <SessionCard key={s.id} s={s} onEdit={() => { setEditingSession(s); setShowNewSession(true); }} accent />)}</div>
                                        )}
                                        {pastSessions.length > 0 && (
                                            <div><h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Прошедшие</h3>{pastSessions.map(s => <SessionCard key={s.id} s={s} onEdit={() => { setEditingSession(s); setShowNewSession(true); }} />)}</div>
                                        )}
                                        {!futureSessions.length && !pastSessions.length && <div className="text-center py-12 text-muted-foreground text-sm">Нет сессий</div>}
                                    </div>
                                )}
                                {desktopTab === 'questionnaire' && (
                                    <div className="space-y-6 max-w-2xl">
                                        <QuestionnaireView data={selectedClient.questionnaire?.data} />
                                        <button onClick={() => { setShowEditQuestionnaire(true); setQuestionnaireForm(selectedClient.questionnaire?.data || { fullName: selectedClient.name, gender: selectedClient.gender || undefined, phone: selectedClient.phone || undefined, email: selectedClient.email || undefined }); }}
                                            className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 shadow-sm active:scale-[0.98]">
                                            {selectedClient.questionnaire?.data ? 'Редактировать анкету' : 'Заполнить анкету'}
                                        </button>
                                    </div>
                                )}
                                {desktopTab === 'notes' && (
                                    <div className="space-y-3">
                                        {selectedClient.sessions?.map(s => (
                                            <div key={s.id} className="p-4 bg-muted/30 border border-border rounded-2xl">
                                                <div className="text-xs font-semibold text-muted-foreground mb-2">
                                                    {new Date(s.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })} · {s.time} · {statusLabels[s.status]}
                                                </div>
                                                <textarea value={editingNotes?.sessionId === s.id ? editingNotes.notes : (s.notes || '')}
                                                    onFocus={() => setEditingNotes({ sessionId: s.id, notes: s.notes || '' })}
                                                    onChange={e => handleNotesChange(s.id, e.target.value)}
                                                    onBlur={() => { if (editingNotes) { saveNotes(editingNotes.sessionId, editingNotes.notes); setEditingNotes(null); fetchClientDetail(selectedClient.id); } }}
                                                    className="w-full bg-background border border-border rounded-xl p-3 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring/50 min-h-[80px] transition-all"
                                                    placeholder="Добавить заметки..." />
                                            </div>
                                        ))}
                                        {!selectedClient.sessions?.length && <div className="text-center py-12 text-muted-foreground text-sm">Нет сессий</div>}
                                    </div>
                                )}
                                {desktopTab === 'documents' && (
                                    <div className="space-y-6 max-w-2xl">
                                        <DocumentsView client={selectedClient} />
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-border bg-card">
                                <button onClick={() => { setEditingSession(null); setShowNewSession(true); }}
                                    className="w-full py-3.5 bg-accent text-accent-foreground rounded-xl font-medium hover:bg-accent/90 shadow-sm active:scale-[0.98]">
                                    Запланировать сессию
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* New Client Modal */}
            {showNewClient && <NewClientModal newClient={newClient} setNewClient={setNewClient} onCreate={handleCreateClient} onClose={() => setShowNewClient(false)} />}

            {renderDeleteModal()}
            {renderQuestionnaireModal()}

            <SessionModal isOpen={showNewSession} onClose={() => { setShowNewSession(false); setEditingSession(null); }}
                onSave={() => { fetchClients(); if (selectedClient) fetchClientDetail(selectedClient.id); }}
                initialClient={selectedClient ? { id: selectedClient.id, name: selectedClient.name } : undefined}
                editSession={editingSession} clients={clients.map(c => ({ id: c.id, name: c.name }))} />
        </div>
    );

    // ======================== MODALS ========================
    function renderDeleteModal() {
        if (!showDeleteConfirm || !selectedClient) return null;
        const name = clientName(selectedClient);
        return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-card rounded-3xl w-full max-w-md shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200 p-6">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-8 h-8 text-destructive" />
                        </div>
                        <h2 className="text-xl font-bold text-foreground mb-2">Удалить клиента?</h2>
                        <p className="text-sm text-muted-foreground">Это действие <strong>необратимо</strong> и удалит все сессии, заметки и анкету клиента.</p>
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-semibold mb-2 text-foreground">Введите «{name}» для подтверждения</label>
                        <input type="text" value={deleteConfirmName} onChange={e => setDeleteConfirmName(e.target.value)}
                            className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-destructive/50 text-foreground text-sm" placeholder={name} />
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium">Отмена</button>
                        <button onClick={handleDelete} disabled={deleteConfirmName !== name}
                            className={`flex-1 py-3 rounded-xl font-medium transition-all ${deleteConfirmName === name ? 'bg-destructive text-destructive-foreground shadow-sm active:scale-[0.98]' : 'bg-destructive/20 text-destructive/40 cursor-not-allowed'}`}>
                            Удалить навсегда
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    function renderQuestionnaireModal() {
        if (!showEditQuestionnaire) return null;
        return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-card rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between p-6 border-b border-border/50">
                        <h2 className="text-xl font-bold text-foreground">Анкета клиента</h2>
                        <button onClick={() => setShowEditQuestionnaire(false)} className="p-2 hover:bg-muted rounded-xl"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="p-6 overflow-auto telegram-miniapp-scrollbar-hide space-y-8 flex-1">
                        <QSection title="1. Персональная информация">
                            <QInput label="ФИО" value={questionnaireForm.fullName || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, fullName: v }))} />
                            <DatePicker label="Дата рождения" value={questionnaireForm.dateOfBirth}
                                onChange={date => { if (date) { const o = date.getTimezoneOffset(); const d = new Date(date.getTime() - o * 60000); setQuestionnaireForm(f => ({ ...f, dateOfBirth: d.toISOString().split('T')[0] })); } }} />
                            <QInput type="number" label="Возраст" value={String(questionnaireForm.age || '')} onChange={v => setQuestionnaireForm(f => ({ ...f, age: Number(v) || undefined }))} />
                            <div><label className="block text-sm font-semibold mb-2">Пол</label>
                                <div className="flex gap-3">{[{ v: 'male', l: 'Мужской' }, { v: 'female', l: 'Женский' }].map(g => (
                                    <button key={g.v} type="button" onClick={() => setQuestionnaireForm(f => ({ ...f, gender: g.v }))}
                                        className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${questionnaireForm.gender === g.v ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:border-primary/50'}`}>{g.l}</button>))}
                                </div></div>
                        </QSection>
                        <QSection title="2. Семья и социальный контекст">
                            <QInput label="Семейный статус" value={questionnaireForm.familyStatus || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, familyStatus: v }))} />
                            <QInput label="Дети" value={questionnaireForm.children || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, children: v }))} />
                            <QInput label="Проживает с" value={questionnaireForm.livingWith || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, livingWith: v }))} />
                            <QInput label="Значимые фигуры" value={questionnaireForm.significantFigures || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, significantFigures: v }))} multiline />
                        </QSection>
                        <QSection title="3. Работа и стресс">
                            <QInput label="Род деятельности" value={questionnaireForm.occupation || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, occupation: v }))} />
                            <QInput label="Должность" value={questionnaireForm.position || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, position: v }))} />
                            <div><label className="block text-sm font-semibold mb-2">Уровень стресса (1-10)</label>
                                <input type="range" min="1" max="10" value={questionnaireForm.stressLevel || 5} onChange={e => setQuestionnaireForm(f => ({ ...f, stressLevel: Number(e.target.value) }))} className="w-full accent-primary h-2 bg-muted rounded-lg appearance-none cursor-pointer" />
                                <div className="flex justify-between text-xs font-semibold text-muted-foreground mt-2"><span>1</span><span className="text-primary text-sm">{questionnaireForm.stressLevel || 5}</span><span>10</span></div></div>
                        </QSection>
                        <QSection title="4. Психическое здоровье">
                            <QInput label="Наличие расстройства" value={questionnaireForm.mentalDisorders || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, mentalDisorders: v }))} multiline />
                            <QInput label="Лекарства" value={questionnaireForm.medications || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, medications: v }))} />
                            <QInput type="number" label="Сон (часов)" value={String(questionnaireForm.sleepHours || '')} onChange={v => setQuestionnaireForm(f => ({ ...f, sleepHours: Number(v) || undefined }))} />
                            <div><label className="block text-sm font-semibold mb-2">Качество сна</label>
                                <div className="flex gap-3">{[{ v: 'excellent', l: 'Отличное' }, { v: 'good', l: 'Хорошее' }, { v: 'poor', l: 'Плохое' }].map(q => (
                                    <button key={q.v} type="button" onClick={() => setQuestionnaireForm(f => ({ ...f, sleepQuality: q.v }))}
                                        className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${questionnaireForm.sleepQuality === q.v ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:border-primary/50'}`}>{q.l}</button>))}
                                </div></div>
                        </QSection>
                        <QSection title="5. История">
                            <div><label className="block text-sm font-semibold mb-2">Предыдущая терапия</label>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setQuestionnaireForm(f => ({ ...f, previousTherapy: true }))} className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium ${questionnaireForm.previousTherapy === true ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:border-primary/50'}`}>Да</button>
                                    <button type="button" onClick={() => setQuestionnaireForm(f => ({ ...f, previousTherapy: false }))} className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium ${questionnaireForm.previousTherapy === false ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:border-primary/50'}`}>Нет</button>
                                </div></div>
                            {questionnaireForm.previousTherapy && <>
                                <QInput label="Методы" value={questionnaireForm.previousTherapyMethods || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, previousTherapyMethods: v }))} />
                                <QInput label="Результат" value={questionnaireForm.previousTherapyResult || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, previousTherapyResult: v }))} multiline />
                            </>}
                            <QInput label="Ключевые травмы" value={questionnaireForm.keyTraumas || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, keyTraumas: v }))} multiline />
                        </QSection>
                        <QSection title="6. Цели терапии">
                            <QInput label="Краткосрочные (1-3 мес)" value={questionnaireForm.shortTermGoals || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, shortTermGoals: v }))} multiline />
                            <QInput label="Долгосрочные (6-12 мес)" value={questionnaireForm.longTermGoals || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, longTermGoals: v }))} multiline />
                        </QSection>
                        <QSection title="7. Заметки психолога">
                            <QInput label="Важные моменты" value={questionnaireForm.therapistNotes || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, therapistNotes: v }))} multiline />
                            <QInput label="Подходящий метод" value={questionnaireForm.preferredMethod || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, preferredMethod: v }))} />
                        </QSection>
                    </div>
                    <div className="p-6 border-t border-border/50 flex gap-4">
                        <button onClick={() => setShowEditQuestionnaire(false)} className="flex-1 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium">Отмена</button>
                        <button onClick={handleSaveQuestionnaire} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-medium shadow-sm">Сохранить</button>
                    </div>
                </div>
            </div>
        );
    }
}

// ======================== SUB-COMPONENTS ========================
function DocumentsView({ client }: { client: Client }) {
    if (!client.consentDate) {
        return (
            <div className="text-center py-12">
                <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground font-medium text-sm">Документы не подписаны</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Клиент еще не дал согласие на обработку ПДн.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
                <div className="flex items-start gap-4 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-foreground text-sm">Согласие на обработку ПДн</h3>
                        <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-0.5">Подписано электронной подписью</p>
                    </div>
                </div>

                <div className="space-y-3 bg-background rounded-xl p-4 border border-border">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">Версия документа</span>
                        <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded w-fit">{client.consentVersion}</span>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">Дата подписания</span>
                        <span className="text-sm font-medium text-foreground">
                            {new Date(client.consentDate).toLocaleString('ru-RU', {
                                day: 'numeric', month: 'long', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                            })}
                        </span>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">Цифровая подпись (SHA-256)</span>
                        <span className="text-xs font-mono text-muted-foreground break-all bg-muted/50 p-2 rounded-lg border border-border/50">
                            {client.consentHash}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SessionCard({ s, onEdit, accent }: { s: Session; onEdit: () => void; accent?: boolean }) {
    return (
        <button onClick={onEdit}
            className={`w-full text-left p-4 rounded-2xl border flex items-center gap-4 transition-all active:scale-[0.98] mb-2 ${accent ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-card border-border hover:shadow-md'}`}>
            <div className={`w-1.5 h-12 rounded-full ${statusDot[s.status] || 'bg-muted-foreground'}`} />
            <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">
                    {new Date(s.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · {s.time}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                    {s.type === 'individual' ? 'Индивид.' : s.type === 'couple' ? 'Парная' : 'Семейная'} · {s.duration} мин
                </div>
                {s.notes && <div className="mt-1.5 text-xs text-foreground/70 line-clamp-1 italic">{s.notes}</div>}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
        </button>
    );
}

function QuestionnaireView({ data }: { data?: QuestionnaireData | null }) {
    if (!data) return <div className="text-center py-8"><FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" /><p className="text-muted-foreground text-sm">Анкета не заполнена</p></div>;
    const sections: { title: string; fields: { k: string; l: string; s?: string; t?: (v: unknown) => string }[] }[] = [
        { title: '1. Персональная информация', fields: [{ k: 'fullName', l: 'ФИО' }, { k: 'dateOfBirth', l: 'Дата рождения' }, { k: 'age', l: 'Возраст', s: ' лет' }, { k: 'gender', l: 'Пол', t: (v: unknown) => v === 'male' ? 'Мужской' : 'Женский' }] },
        { title: '2. Семья', fields: [{ k: 'familyStatus', l: 'Семейный статус' }, { k: 'children', l: 'Дети' }, { k: 'livingWith', l: 'Проживает с' }, { k: 'significantFigures', l: 'Значимые фигуры' }] },
        { title: '3. Работа и стресс', fields: [{ k: 'occupation', l: 'Род деятельности' }, { k: 'position', l: 'Должность' }, { k: 'stressLevel', l: 'Уровень стресса', s: '/10' }] },
        { title: '4. Здоровье', fields: [{ k: 'mentalDisorders', l: 'Расстройства' }, { k: 'medications', l: 'Лекарства' }, { k: 'sleepHours', l: 'Сон', s: 'ч' }] },
        { title: '5. История', fields: [{ k: 'previousTherapy', l: 'Предыд. терапия', t: (v: unknown) => v ? 'Да' : 'Нет' }, { k: 'keyTraumas', l: 'Травмы' }] },
        { title: '6. Цели', fields: [{ k: 'shortTermGoals', l: 'Краткосрочные' }, { k: 'longTermGoals', l: 'Долгосрочные' }] },
        { title: '7. Заметки', fields: [{ k: 'therapistNotes', l: 'Важные моменты' }, { k: 'preferredMethod', l: 'Метод' }] },
    ];
    return <>{sections.map(sec => {
        const has = sec.fields.some(f => { const v = data[f.k as keyof QuestionnaireData]; return v !== undefined && v !== null && v !== ''; });
        if (!has) return null;
        return (
            <div key={sec.title} className="bg-muted/30 p-4 rounded-2xl border border-border/50 mb-3">
                <h3 className="text-sm font-bold mb-3 text-foreground">{sec.title}</h3>
                <div className="space-y-2">{sec.fields.map(f => {
                    const v = data[f.k as keyof QuestionnaireData];
                    if (v === undefined || v === null || v === '') return null;
                    return <div key={f.k} className="flex gap-3 text-sm"><span className="text-muted-foreground w-1/3 shrink-0">{f.l}</span><span className="text-foreground font-medium">{f.t ? f.t(v) : `${v}${f.s || ''}`}</span></div>;
                })}</div>
            </div>);
    })}</>;
}

function NewClientModal({ newClient, setNewClient, onCreate, onClose }: { newClient: { name: string; phone: string; email: string; gender: string }; setNewClient: (fn: (s: typeof newClient) => typeof newClient) => void; onCreate: () => void; onClose: () => void }) {
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-card rounded-3xl w-full max-w-md shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 pb-4 border-b border-border/50">
                    <h2 className="text-xl font-bold">Новый клиент</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-5">
                    <div><label className="block text-sm font-semibold mb-2">Имя *</label>
                        <input type="text" value={newClient.name} onChange={e => setNewClient(s => ({ ...s, name: e.target.value }))} className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm" placeholder="ФИО" /></div>
                    <div><label className="block text-sm font-semibold mb-2">Телефон</label>
                        <PhoneInput value={newClient.phone} onChange={v => setNewClient(s => ({ ...s, phone: v }))} className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50" /></div>
                    <div><label className="block text-sm font-semibold mb-2">Email</label>
                        <input type="email" value={newClient.email} onChange={e => setNewClient(s => ({ ...s, email: e.target.value }))} className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm" placeholder="email@example.com" /></div>
                    <div><label className="block text-sm font-semibold mb-2">Пол</label>
                        <div className="flex gap-3">{[{ v: 'male', l: 'Мужской' }, { v: 'female', l: 'Женский' }].map(g => (
                            <button key={g.v} type="button" onClick={() => setNewClient(s => ({ ...s, gender: g.v }))}
                                className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium ${newClient.gender === g.v ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:border-primary/50'}`}>{g.l}</button>
                        ))}</div></div>
                </div>
                <div className="p-6 pt-4 border-t border-border/50 flex gap-4">
                    <button onClick={onClose} className="flex-1 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium">Отмена</button>
                    <button onClick={onCreate} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-medium shadow-sm">Создать</button>
                </div>
            </div>
        </div>
    );
}

function QInput({ label, value, onChange, multiline, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; type?: string }) {
    return (<div><label className="block text-sm font-semibold mb-2">{label}</label>
        {multiline ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm resize-none" />
            : <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm" />}
    </div>);
}

function QSection({ title, children }: { title: string; children: React.ReactNode }) {
    return <div><h3 className="text-base font-semibold mb-3 text-primary">{title}</h3><div className="space-y-3">{children}</div></div>;
}
