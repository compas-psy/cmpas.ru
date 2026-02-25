'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, X, ChevronRight, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { SessionModal } from '../components/SessionModal';
import { DatePicker } from '@/components/ui/date-picker';
import { PhoneInput } from '@/components/ui/phone-input';

type QuestionnaireData = {
    fullName?: string;
    dateOfBirth?: string;
    age?: number;
    gender?: string;
    phone?: string;
    email?: string;
    familyStatus?: string;
    children?: string;
    livingWith?: string;
    significantFigures?: string;
    occupation?: string;
    position?: string;
    stressLevel?: number;
    stressCoping?: {
        sport?: boolean;
        meditation?: boolean;
        hobbies?: boolean;
        communication?: boolean;
        alcohol?: boolean;
        isolation?: boolean;
        other?: string;
    };
    mentalDisorders?: string;
    currentSymptoms?: {
        insomnia?: boolean;
        headache?: boolean;
        bodyPain?: boolean;
        none?: boolean;
        other?: string;
    };
    medications?: string;
    sleepHours?: number;
    sleepQuality?: string;
    previousTherapy?: boolean;
    previousTherapyMethods?: string;
    previousTherapyResult?: string;
    psychiatricDiagnoses?: boolean;
    keyTraumas?: string;
    shortTermGoals?: string;
    longTermGoals?: string;
    therapistNotes?: string;
    preferredMethod?: string;
};

type Client = {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    gender: string | null;
    totalSessions: number;
    nextSessionDate: string | null;
    status: string;
    questionnaire: { id: string; data: QuestionnaireData } | null;
    sessions?: Session[];
};

type Session = {
    id: string;
    date: string;
    time: string;
    endTime: string | null;
    duration: number;
    type: string;
    format: string;
    status: string;
    notes: string | null;
};

export default function ClientsPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [search, setSearch] = useState('');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [activeTab, setActiveTab] = useState<'questionnaire' | 'sessions'>('questionnaire');
    const [showNewClient, setShowNewClient] = useState(false);
    const [showEditQuestionnaire, setShowEditQuestionnaire] = useState(false);
    const [showNewSession, setShowNewSession] = useState(false);
    const [editingSession, setEditingSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    const [newClient, setNewClient] = useState({ name: '', phone: '', email: '', gender: '' });
    const [questionnaireForm, setQuestionnaireForm] = useState<QuestionnaireData>({});

    const fetchClients = useCallback(async () => {
        try {
            const { getClients } = await import('../actions/clients');
            const data = await getClients(search || undefined);
            setClients(data as unknown as Client[]);
        } catch { /* empty */ }
        setLoading(false);
    }, [search]);

    const fetchClientDetail = useCallback(async (id: string) => {
        try {
            const { getClient } = await import('../actions/clients');
            const data = await getClient(id);
            if (data) {
                setSelectedClient(data as unknown as Client);
                if (data.questionnaire?.data) {
                    setQuestionnaireForm(data.questionnaire.data as QuestionnaireData);
                }
            }
        } catch { /* empty */ }
    }, []);

    useEffect(() => { fetchClients(); }, [fetchClients]);

    // Auto-calculate age
    useEffect(() => {
        if (questionnaireForm.dateOfBirth) {
            const birthDate = new Date(questionnaireForm.dateOfBirth);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            if (age >= 0 && age !== questionnaireForm.age) {
                setQuestionnaireForm(f => ({ ...f, age }));
            }
        }
    }, [questionnaireForm.dateOfBirth]);


    const handleCreateClient = async () => {
        if (!newClient.name.trim()) { toast.error('Введите имя клиента'); return; }
        if (newClient.email && !validateEmail(newClient.email)) { toast.error('Некорректный email'); return; }
        try {
            const { createClient } = await import('../actions/clients');
            await createClient(newClient);
            toast.success('Клиент добавлен');
            setShowNewClient(false);
            setNewClient({ name: '', phone: '', email: '', gender: '' });
            fetchClients();
        } catch {
            toast.error('Ошибка при создании клиента');
        }
    };

    const handleSaveQuestionnaire = async () => {
        if (!selectedClient) return;
        try {
            const { saveQuestionnaire } = await import('../actions/clients');
            await saveQuestionnaire(selectedClient.id, questionnaireForm);
            toast.success('Анкета сохранена');
            setShowEditQuestionnaire(false);
            fetchClientDetail(selectedClient.id);
        } catch {
            toast.error('Ошибка при сохранении');
        }
    };

    const statusColors: Record<string, string> = {
        confirmed: 'bg-primary',
        pending: 'bg-accent text-accent-foreground',
        completed: 'bg-muted-foreground',
        cancelled: 'bg-destructive text-destructive-foreground',
    };

    const statusLabels: Record<string, string> = {
        confirmed: 'Подтверждено',
        pending: 'Ожидает',
        completed: 'Завершено',
        cancelled: 'Отменено',
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

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

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input type="text" placeholder="Поиск по имени..." value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm transition-all" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Mobile Client Selector */}
                <div className="lg:hidden">
                    <div className="relative">
                        <select
                            className="w-full appearance-none bg-card border border-border text-foreground font-semibold py-3 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                            value={selectedClient?.id || ''}
                            onChange={(e) => {
                                const client = clients.find(c => c.id === e.target.value);
                                if (client) {
                                    setSelectedClient(client);
                                    fetchClientDetail(client.id);
                                    setActiveTab('questionnaire');
                                }
                            }}
                        >
                            <option value="" disabled>Выберите клиента</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.questionnaire?.data?.fullName || c.name}</option>
                            ))}
                        </select>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground rotate-90 pointer-events-none" />
                    </div>
                </div>

                {/* Desktop Client List */}
                <div className="hidden lg:flex flex-col space-y-3">
                    {clients.map(c => (
                        <button key={c.id} onClick={() => { setSelectedClient(c); fetchClientDetail(c.id); setActiveTab('questionnaire'); }}
                            className={`w-full p-4 bg-card rounded-2xl border text-left hover:border-border hover:shadow-md transition-all flex items-center gap-4 ${selectedClient?.id === c.id ? 'border-primary ring-2 ring-primary ring-inset shadow-sm' : 'border-border shadow-sm'}`}>
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base flex-shrink-0 uppercase">
                                {(c.questionnaire?.data?.fullName || c.name || '?').slice(0, 2)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-foreground text-base truncate mb-0.5">{c.questionnaire?.data?.fullName || c.name}</p>
                                <p className="text-sm font-medium text-muted-foreground">{c.totalSessions} сессий</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground/50 flex-shrink-0" />
                        </button>
                    ))}
                    {clients.length === 0 && (
                        <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-sm">
                            <p className="text-muted-foreground font-medium text-sm">Нет клиентов</p>
                        </div>
                    )}
                </div>

                {/* Client Detail */}
                <div className="lg:col-span-2">
                    {!selectedClient ? (
                        <div className="bg-card rounded-2xl border border-border shadow-sm p-12 text-center h-full flex flex-col items-center justify-center min-h-[400px]">
                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
                                <FileText className="w-8 h-8 opacity-50" />
                            </div>
                            <p className="text-muted-foreground font-medium">Выберите клиента для просмотра информации</p>
                        </div>
                    ) : (
                        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-12rem)] min-h-[600px]">
                            {/* Client header */}
                            <div className="p-6 pb-0">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl uppercase">
                                        {(selectedClient.questionnaire?.data?.fullName || selectedClient.name || '?').slice(0, 2)}
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-2xl font-bold text-foreground mb-1">{selectedClient.questionnaire?.data?.fullName || selectedClient.name}</h2>
                                        <div className="flex gap-4 text-sm font-medium text-muted-foreground">
                                            {selectedClient.phone && <span>{selectedClient.phone}</span>}
                                            {selectedClient.email && <span>{selectedClient.email}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-6">
                                    <div className="bg-muted p-4 rounded-xl border border-border/50">
                                        <div className="text-sm font-medium text-muted-foreground">Всего сессий</div>
                                        <div className="text-2xl font-bold text-foreground mt-1">{selectedClient.totalSessions}</div>
                                    </div>
                                    <div className="bg-muted p-4 rounded-xl border border-border/50">
                                        <div className="text-sm font-medium text-muted-foreground">Следующая запись</div>
                                        <div className="text-base font-semibold text-foreground mt-1 truncate">
                                            {selectedClient.nextSessionDate
                                                ? new Date(selectedClient.nextSessionDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
                                                : 'Не запланирована'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex mt-2 px-6 border-b border-border">
                                <button onClick={() => setActiveTab('questionnaire')}
                                    className={`flex-1 px-6 py-4 font-semibold transition-colors text-sm border-b-2 ${activeTab === 'questionnaire' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}>
                                    Анкета
                                </button>
                                <button onClick={() => setActiveTab('sessions')}
                                    className={`flex-1 px-6 py-4 font-semibold transition-colors text-sm border-b-2 ${activeTab === 'sessions' ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}>
                                    Сессии ({selectedClient.sessions?.length || 0})
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 flex-1 overflow-auto telegram-miniapp-scrollbar-hide relative">
                                {activeTab === 'questionnaire' ? (
                                    <div className="space-y-6 max-w-2xl">
                                        {selectedClient.questionnaire?.data ? (
                                            <>
                                                <QuestionnaireSection title="1. Персональная информация" data={selectedClient.questionnaire.data}
                                                    fields={[
                                                        { key: 'fullName', label: 'ФИО' },
                                                        { key: 'dateOfBirth', label: 'Дата рождения' },
                                                        { key: 'age', label: 'Возраст', suffix: ' лет' },
                                                        { key: 'age', label: 'Возраст', suffix: ' лет' },
                                                        { key: 'gender', label: 'Пол', transform: (v: unknown) => v === 'male' ? 'Мужской' : 'Женский' },
                                                    ]} />
                                                <QuestionnaireSection title="2. Семья и социальный контекст" data={selectedClient.questionnaire.data}
                                                    fields={[
                                                        { key: 'familyStatus', label: 'Семейный статус' },
                                                        { key: 'children', label: 'Дети' },
                                                        { key: 'livingWith', label: 'Проживает с' },
                                                        { key: 'significantFigures', label: 'Значимые фигуры' },
                                                    ]} />
                                                <QuestionnaireSection title="3. Работа и стресс" data={selectedClient.questionnaire.data}
                                                    fields={[
                                                        { key: 'occupation', label: 'Род деятельности' },
                                                        { key: 'position', label: 'Должность' },
                                                        { key: 'stressLevel', label: 'Уровень стресса', suffix: '/10' },
                                                    ]} />
                                                <QuestionnaireSection title="4. Психическое здоровье" data={selectedClient.questionnaire.data}
                                                    fields={[
                                                        { key: 'mentalDisorders', label: 'Наличие расстройства' },
                                                        { key: 'medications', label: 'Лекарства' },
                                                        { key: 'sleepHours', label: 'Сон', suffix: 'ч' },
                                                        { key: 'sleepQuality', label: 'Качество сна', transform: (v: unknown) => v === 'excellent' ? 'Отличное' : v === 'good' ? 'Хорошее' : 'Плохое' },
                                                    ]} />
                                                <QuestionnaireSection title="5. История психического здоровья" data={selectedClient.questionnaire.data}
                                                    fields={[
                                                        { key: 'previousTherapy', label: 'Предыдущая терапия', transform: (v: unknown) => v ? 'Да' : 'Нет' },
                                                        { key: 'previousTherapyMethods', label: 'Методы' },
                                                        { key: 'previousTherapyResult', label: 'Результат' },
                                                        { key: 'keyTraumas', label: 'Ключевые травмы' },
                                                    ]} />
                                                <QuestionnaireSection title="6. Цели терапии" data={selectedClient.questionnaire.data}
                                                    fields={[
                                                        { key: 'shortTermGoals', label: 'Краткосрочные (1-3 мес)' },
                                                        { key: 'longTermGoals', label: 'Долгосрочные (6-12 мес)' },
                                                    ]} />
                                                <QuestionnaireSection title="7. Заметки психолога" data={selectedClient.questionnaire.data}
                                                    fields={[
                                                        { key: 'therapistNotes', label: 'Важные моменты' },
                                                        { key: 'preferredMethod', label: 'Подходящий метод' },
                                                    ]} />
                                            </>
                                        ) : (
                                            <div className="text-center py-8">
                                                <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                                                <p className="text-muted-foreground text-sm mb-3">Анкета не заполнена</p>
                                            </div>
                                        )}
                                        <button onClick={() => { setShowEditQuestionnaire(true); setQuestionnaireForm(selectedClient.questionnaire?.data || { fullName: selectedClient.name, gender: selectedClient.gender || undefined, phone: selectedClient.phone || undefined, email: selectedClient.email || undefined }); }}
                                            className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all shadow-sm active:scale-[0.98] mt-6">
                                            {selectedClient.questionnaire?.data ? 'Редактировать анкету' : 'Заполнить анкету'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {(selectedClient.sessions?.length || 0) === 0 ? (
                                            <div className="text-center py-12">
                                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                                                    <FileText className="w-8 h-8 opacity-50" />
                                                </div>
                                                <p className="text-muted-foreground font-medium text-sm">Нет сессий</p>
                                            </div>
                                        ) : (
                                            selectedClient.sessions?.map(s => (
                                                <div key={s.id}
                                                    onClick={() => { setEditingSession(s); setShowNewSession(true); }}
                                                    className="p-5 bg-card border border-border rounded-2xl flex items-center gap-4 cursor-pointer hover:border-border hover:shadow-md transition-all shadow-sm group"
                                                >
                                                    <div className={`w-1.5 h-16 rounded-full ${statusColors[s.status]}`} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-base font-semibold text-foreground mb-1">
                                                            {new Date(s.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })} <span className="text-muted-foreground mx-1">·</span> {s.time}
                                                        </div>
                                                        <div className="text-sm font-medium text-muted-foreground flex gap-2 items-center">
                                                            {s.type === 'individual' ? 'Индивидуальная' : s.type === 'couple' ? 'Парная' : 'Семейная'} <span className="text-muted-foreground/30">•</span> {s.duration} мин
                                                        </div>
                                                        {s.notes && <div className="mt-2 text-sm text-foreground/80 line-clamp-1 italic bg-muted/50 p-2 rounded-lg">{s.notes}</div>}
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusColors[s.status]}/10 ${statusColors[s.status].replace('bg-', 'text-')}`}>
                                                            {statusLabels[s.status]}
                                                        </span>
                                                        <ChevronRight className="w-5 h-5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0" />
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Schedule Footer */}
                            <div className="p-6 border-t border-border bg-card">
                                <button
                                    onClick={() => { setEditingSession(null); setShowNewSession(true); }}
                                    className="w-full py-3.5 bg-accent text-accent-foreground rounded-xl font-medium hover:bg-accent/90 transition-all shadow-sm active:scale-[0.98]"
                                >
                                    Запланировать следующую сессию
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* New Client Modal */}
            {showNewClient && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-card rounded-3xl w-full max-w-md shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-6 pb-4 border-b border-border/50">
                            <h2 className="text-xl font-bold text-foreground">Новый клиент</h2>
                            <button onClick={() => setShowNewClient(false)} className="p-2 hover:bg-muted rounded-xl transition-colors"><X className="w-5 h-5 text-foreground" /></button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-semibold mb-2 text-foreground">Имя *</label>
                                <input type="text" value={newClient.name} onChange={e => setNewClient(s => ({ ...s, name: e.target.value }))}
                                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground transition-all" placeholder="ФИО" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-2 text-foreground">Телефон</label>
                                <PhoneInput
                                    value={newClient.phone}
                                    onChange={(value) => setNewClient(s => ({ ...s, phone: value }))}
                                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-2 text-foreground">Email</label>
                                <input type="email" value={newClient.email} onChange={e => setNewClient(s => ({ ...s, email: e.target.value }))}
                                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground transition-all" placeholder="email@example.com" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-2 text-foreground">Пол</label>
                                <div className="flex gap-3">
                                    {[{ v: 'male', l: 'Мужской' }, { v: 'female', l: 'Женский' }].map(g => (
                                        <button key={g.v} type="button" onClick={() => setNewClient(s => ({ ...s, gender: g.v }))}
                                            className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${newClient.gender === g.v ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-background hover:border-primary/50 text-foreground'}`}>
                                            {g.l}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 pt-4 border-t border-border/50 flex gap-4">
                            <button onClick={() => setShowNewClient(false)} className="flex-1 px-4 py-3 min-h-[44px] bg-secondary text-secondary-foreground rounded-xl text-sm font-medium hover:bg-secondary/80 transition-all">Отмена</button>
                            <button onClick={handleCreateClient} className="flex-1 px-4 py-3 min-h-[44px] bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all shadow-sm">Создать</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Questionnaire Edit Modal */}
            {showEditQuestionnaire && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-card rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-border/50 bg-card z-10">
                            <h2 className="text-xl font-bold text-foreground">Анкета клиента</h2>
                            <button onClick={() => setShowEditQuestionnaire(false)} className="p-2 hover:bg-muted rounded-xl transition-colors"><X className="w-5 h-5 text-foreground" /></button>
                        </div>
                        <div className="p-6 overflow-auto telegram-miniapp-scrollbar-hide space-y-10 flex-1 relative">
                            {/* Section 1 */}
                            <div>
                                <h3 className="text-base font-semibold mb-3 text-primary">1. Персональная информация</h3>
                                <div className="space-y-3">
                                    <QInput label="ФИО" value={questionnaireForm.fullName || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, fullName: v }))} />
                                    <DatePicker
                                        label="Дата рождения"
                                        value={questionnaireForm.dateOfBirth}
                                        onChange={date => {
                                            if (date) {
                                                const offset = date.getTimezoneOffset();
                                                const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
                                                setQuestionnaireForm(f => ({ ...f, dateOfBirth: adjustedDate.toISOString().split('T')[0] }));
                                            }
                                        }}
                                    />
                                    <QInput type="number" label="Возраст" value={String(questionnaireForm.age || '')} onChange={v => setQuestionnaireForm(f => ({ ...f, age: Number(v) || undefined }))} />
                                    <div>
                                        <label className="block text-sm font-semibold mb-2 text-foreground">Пол</label>
                                        <div className="flex gap-3">
                                            <div className="flex gap-3 w-full">
                                                {[{ v: 'male', l: 'Мужской' }, { v: 'female', l: 'Женский' }].map(g => (
                                                    <button key={g.v} type="button" onClick={() => setQuestionnaireForm(f => ({ ...f, gender: g.v }))}
                                                        className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${questionnaireForm.gender === g.v ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-background hover:border-primary/50 text-foreground'}`}>
                                                        {g.l}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Section 2 */}
                            <div>
                                <h3 className="text-base font-semibold mb-3 text-primary">2. Семья и социальный контекст</h3>
                                <div className="space-y-3">
                                    <QInput label="Семейный статус" value={questionnaireForm.familyStatus || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, familyStatus: v }))} />
                                    <QInput label="Дети" value={questionnaireForm.children || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, children: v }))} />
                                    <QInput label="Проживает с" value={questionnaireForm.livingWith || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, livingWith: v }))} />
                                    <QInput label="Значимые фигуры" value={questionnaireForm.significantFigures || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, significantFigures: v }))} multiline />
                                </div>
                            </div>
                            {/* Section 3 */}
                            <div>
                                <h3 className="text-base font-semibold mb-3 text-primary">3. Работа и стресс</h3>
                                <div className="space-y-3">
                                    <QInput label="Род деятельности" value={questionnaireForm.occupation || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, occupation: v }))} />
                                    <QInput label="Должность" value={questionnaireForm.position || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, position: v }))} />
                                    <div>
                                        <label className="block text-sm font-semibold mb-2 text-foreground">Уровень стресса (1-10)</label>
                                        <input type="range" min="1" max="10" value={questionnaireForm.stressLevel || 5}
                                            onChange={e => setQuestionnaireForm(f => ({ ...f, stressLevel: Number(e.target.value) }))}
                                            className="w-full accent-primary h-2 bg-muted rounded-lg appearance-none cursor-pointer" />
                                        <div className="flex justify-between text-xs font-semibold text-muted-foreground mt-2"><span>1</span><span className="text-primary text-sm">{questionnaireForm.stressLevel || 5}</span><span>10</span></div>
                                    </div>
                                </div>
                            </div>
                            {/* Section 4 */}
                            <div>
                                <h3 className="text-base font-semibold mb-3 text-primary">4. Психическое здоровье</h3>
                                <div className="space-y-3">
                                    <QInput label="Наличие расстройства" value={questionnaireForm.mentalDisorders || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, mentalDisorders: v }))} multiline />
                                    <QInput label="Лекарства" value={questionnaireForm.medications || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, medications: v }))} />
                                    <QInput type="number" label="Сон (часов)" value={String(questionnaireForm.sleepHours || '')} onChange={v => setQuestionnaireForm(f => ({ ...f, sleepHours: Number(v) || undefined }))} />
                                    <div>
                                        <label className="block text-sm font-semibold mb-2 text-foreground">Качество сна</label>
                                        <div className="flex gap-3">
                                            {[{ v: 'excellent', l: 'Отличное' }, { v: 'good', l: 'Хорошее' }, { v: 'poor', l: 'Плохое' }].map(q => (
                                                <button key={q.v} type="button" onClick={() => setQuestionnaireForm(f => ({ ...f, sleepQuality: q.v }))}
                                                    className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${questionnaireForm.sleepQuality === q.v ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-background hover:border-primary/50 text-foreground'}`}>
                                                    {q.l}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Section 5 */}
                            <div>
                                <h3 className="text-base font-semibold mb-3 text-primary">5. История психического здоровья</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-semibold mb-2 text-foreground">Предыдущая терапия</label>
                                        <div className="flex gap-3">
                                            <button type="button" onClick={() => setQuestionnaireForm(f => ({ ...f, previousTherapy: true }))}
                                                className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${questionnaireForm.previousTherapy === true ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-background hover:border-primary/50 text-foreground'}`}>Да</button>
                                            <button type="button" onClick={() => setQuestionnaireForm(f => ({ ...f, previousTherapy: false }))}
                                                className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${questionnaireForm.previousTherapy === false ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-background hover:border-primary/50 text-foreground'}`}>Нет</button>
                                        </div>
                                    </div>
                                    {questionnaireForm.previousTherapy && (
                                        <>
                                            <QInput label="Методы" value={questionnaireForm.previousTherapyMethods || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, previousTherapyMethods: v }))} />
                                            <QInput label="Результат" value={questionnaireForm.previousTherapyResult || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, previousTherapyResult: v }))} multiline />
                                        </>
                                    )}
                                    <QInput label="Ключевые травмы" value={questionnaireForm.keyTraumas || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, keyTraumas: v }))} multiline />
                                </div>
                            </div>
                            {/* Section 6 */}
                            <div>
                                <h3 className="text-base font-semibold mb-3 text-primary">6. Цели терапии</h3>
                                <div className="space-y-3">
                                    <QInput label="Краткосрочные (1-3 мес)" value={questionnaireForm.shortTermGoals || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, shortTermGoals: v }))} multiline />
                                    <QInput label="Долгосрочные (6-12 мес)" value={questionnaireForm.longTermGoals || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, longTermGoals: v }))} multiline />
                                </div>
                            </div>
                            {/* Section 7 */}
                            <div>
                                <h3 className="text-base font-semibold mb-3 text-primary">7. Заметки психолога</h3>
                                <div className="space-y-3">
                                    <QInput label="Важные моменты" value={questionnaireForm.therapistNotes || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, therapistNotes: v }))} multiline />
                                    <QInput label="Подходящий метод" value={questionnaireForm.preferredMethod || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, preferredMethod: v }))} />
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-border/50 bg-card flex gap-4 mt-auto">
                            <button onClick={() => setShowEditQuestionnaire(false)} className="flex-1 px-4 py-3 min-h-[44px] bg-secondary text-secondary-foreground rounded-xl text-sm font-medium hover:bg-secondary/80 transition-all">Отмена</button>
                            <button onClick={handleSaveQuestionnaire} className="flex-1 px-4 py-3 min-h-[44px] bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all shadow-sm">Сохранить</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Session Modal */}
            <SessionModal
                isOpen={showNewSession}
                onClose={() => { setShowNewSession(false); setEditingSession(null); }}
                onSave={() => { fetchClients(); if (selectedClient) fetchClientDetail(selectedClient.id); }}
                initialClient={selectedClient ? { id: selectedClient.id, name: selectedClient.name } : undefined}
                editSession={editingSession}
                clients={clients.map(c => ({ id: c.id, name: c.name }))}
            />
        </div>
    )
}

// Helper Components
function QInput({ label, value, onChange, multiline, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; type?: string }) {
    return (
        <div>
            <label className="block text-sm font-semibold mb-2 text-foreground">{label}</label>
            {multiline ? (
                <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground text-sm resize-none transition-all" />
            ) : (
                <input type={type} value={value} onChange={e => onChange(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 text-foreground text-sm transition-all" />
            )}
        </div>
    );
}

function QuestionnaireSection({ title, data, fields }: {
    title: string;
    data: QuestionnaireData;
    fields: { key: string; label: string; suffix?: string; transform?: (v: unknown) => string }[];
}) {
    const hasAnyData = fields.some(f => {
        const val = data[f.key as keyof QuestionnaireData];
        return val !== undefined && val !== null && val !== '';
    });
    if (!hasAnyData) return null;

    return (
        <div className="bg-muted/30 p-5 rounded-2xl border border-border/50">
            <h3 className="text-base font-bold mb-4 text-foreground">{title}</h3>
            <div className="space-y-3">
                {fields.map(f => {
                    const val = data[f.key as keyof QuestionnaireData];
                    if (val === undefined || val === null || val === '') return null;
                    return (
                        <div key={f.key} className="flex gap-4 items-start border-b border-border/50 last:border-0 pb-3 last:pb-0">
                            <span className="text-sm font-medium text-muted-foreground w-1/3 shrink-0">{f.label}</span>
                            <span className="text-sm font-medium text-foreground">{f.transform ? f.transform(val) : `${val}${f.suffix || ''}`}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};
