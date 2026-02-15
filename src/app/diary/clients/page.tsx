'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, X, ChevronRight, FileText } from 'lucide-react';
import { toast } from 'sonner';

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

    const handleCreateClient = async () => {
        if (!newClient.name.trim()) { toast.error('Введите имя клиента'); return; }
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
        pending: 'bg-accent',
        completed: 'bg-muted-foreground',
        cancelled: 'bg-destructive',
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
                    <h1 className="text-2xl md:text-3xl font-semibold">Клиенты</h1>
                    <p className="text-muted-foreground text-sm mt-1">{clients.length} клиентов</p>
                </div>
                <button onClick={() => setShowNewClient(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium self-start">
                    <Plus className="w-4 h-4" />Новый клиент
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" placeholder="Поиск по имени..." value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Client List */}
                <div className="space-y-2">
                    {clients.map(c => (
                        <button key={c.id} onClick={() => { setSelectedClient(c); fetchClientDetail(c.id); setActiveTab('questionnaire'); }}
                            className={`w-full p-4 bg-white rounded-lg border text-left hover:border-primary/50 transition-colors flex items-center gap-3 ${selectedClient?.id === c.id ? 'border-primary ring-1 ring-primary' : 'border-border'}`}>
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                                {c.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{c.name}</p>
                                <p className="text-xs text-muted-foreground">{c.totalSessions} сессий</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </button>
                    ))}
                    {clients.length === 0 && (
                        <div className="bg-white rounded-lg border border-border p-8 text-center">
                            <p className="text-muted-foreground text-sm">Нет клиентов</p>
                        </div>
                    )}
                </div>

                {/* Client Detail */}
                <div className="lg:col-span-2">
                    {!selectedClient ? (
                        <div className="bg-white rounded-lg border border-border p-12 text-center">
                            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                            <p className="text-muted-foreground">Выберите клиента</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg border border-border overflow-hidden">
                            {/* Client header */}
                            <div className="p-6 border-b border-border">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                                        {selectedClient.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-xl font-semibold">{selectedClient.name}</h2>
                                        <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                                            {selectedClient.phone && <span>{selectedClient.phone}</span>}
                                            {selectedClient.email && <span>{selectedClient.email}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    <div className="bg-[#f5f5f5] p-3 rounded-lg">
                                        <div className="text-sm text-muted-foreground">Всего сессий</div>
                                        <div className="text-2xl font-semibold mt-1">{selectedClient.totalSessions}</div>
                                    </div>
                                    <div className="bg-[#f5f5f5] p-3 rounded-lg">
                                        <div className="text-sm text-muted-foreground">Следующая запись</div>
                                        <div className="text-sm font-medium mt-1 truncate">
                                            {selectedClient.nextSessionDate
                                                ? new Date(selectedClient.nextSessionDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
                                                : 'Не запланирована'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b border-border">
                                <button onClick={() => setActiveTab('questionnaire')}
                                    className={`flex-1 px-6 py-3 font-medium transition-colors text-sm ${activeTab === 'questionnaire' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                                    Анкета
                                </button>
                                <button onClick={() => setActiveTab('sessions')}
                                    className={`flex-1 px-6 py-3 font-medium transition-colors text-sm ${activeTab === 'sessions' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                                    Сессии ({selectedClient.sessions?.length || 0})
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 overflow-auto max-h-[60vh]">
                                {activeTab === 'questionnaire' ? (
                                    <div className="space-y-6 max-w-2xl">
                                        {selectedClient.questionnaire?.data ? (
                                            <>
                                                <QuestionnaireSection title="1. Персональная информация" data={selectedClient.questionnaire.data}
                                                    fields={[
                                                        { key: 'fullName', label: 'ФИО' },
                                                        { key: 'dateOfBirth', label: 'Дата рождения' },
                                                        { key: 'age', label: 'Возраст', suffix: ' лет' },
                                                        { key: 'gender', label: 'Пол', transform: (v: unknown) => v === 'male' ? 'Мужской' : v === 'female' ? 'Женский' : 'Другое' },
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
                                        <button onClick={() => { setShowEditQuestionnaire(true); setQuestionnaireForm(selectedClient.questionnaire?.data || {}); }}
                                            className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors">
                                            {selectedClient.questionnaire?.data ? 'Редактировать анкету' : 'Заполнить анкету'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {(selectedClient.sessions?.length || 0) === 0 ? (
                                            <p className="text-muted-foreground text-sm text-center py-8">Нет сессий</p>
                                        ) : (
                                            selectedClient.sessions?.map(s => (
                                                <div key={s.id} className="p-4 bg-[#f5f5f5] rounded-lg flex items-center gap-3">
                                                    <div className={`w-1 h-10 rounded-full ${statusColors[s.status]}`} />
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium">
                                                            {new Date(s.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · {s.time}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {s.type === 'individual' ? 'Индивидуальная' : s.type === 'couple' ? 'Парная' : 'Семейная'} · {s.duration} мин
                                                        </div>
                                                    </div>
                                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[s.status]}/10`}>
                                                        {statusLabels[s.status]}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* New Client Modal */}
            {showNewClient && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <h2 className="text-xl font-semibold">Новый клиент</h2>
                            <button onClick={() => setShowNewClient(false)} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Имя *</label>
                                <input type="text" value={newClient.name} onChange={e => setNewClient(s => ({ ...s, name: e.target.value }))}
                                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="ФИО" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Телефон</label>
                                <input type="tel" value={newClient.phone} onChange={e => setNewClient(s => ({ ...s, phone: e.target.value }))}
                                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="+7 (___) ___-__-__" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Email</label>
                                <input type="email" value={newClient.email} onChange={e => setNewClient(s => ({ ...s, email: e.target.value }))}
                                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="email@example.com" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Пол</label>
                                <div className="flex gap-2">
                                    {[{ v: 'male', l: 'Мужской' }, { v: 'female', l: 'Женский' }, { v: 'other', l: 'Другое' }].map(g => (
                                        <button key={g.v} type="button" onClick={() => setNewClient(s => ({ ...s, gender: g.v }))}
                                            className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${newClient.gender === g.v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}>
                                            {g.l}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-border flex gap-3">
                            <button onClick={() => setShowNewClient(false)} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">Отмена</button>
                            <button onClick={handleCreateClient} className="flex-1 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">Создать</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Questionnaire Edit Modal */}
            {showEditQuestionnaire && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
                        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-white z-10">
                            <h2 className="text-xl font-semibold">Анкета клиента</h2>
                            <button onClick={() => setShowEditQuestionnaire(false)} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-8">
                            {/* Section 1 */}
                            <div>
                                <h3 className="text-base font-semibold mb-3 text-primary">1. Персональная информация</h3>
                                <div className="space-y-3">
                                    <QInput label="ФИО" value={questionnaireForm.fullName || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, fullName: v }))} />
                                    <QInput label="Дата рождения" value={questionnaireForm.dateOfBirth || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, dateOfBirth: v }))} />
                                    <QInput label="Возраст" value={String(questionnaireForm.age || '')} onChange={v => setQuestionnaireForm(f => ({ ...f, age: Number(v) || undefined }))} />
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Пол</label>
                                        <div className="flex gap-2">
                                            {[{ v: 'male', l: 'М' }, { v: 'female', l: 'Ж' }, { v: 'other', l: 'Другое' }].map(g => (
                                                <button key={g.v} type="button" onClick={() => setQuestionnaireForm(f => ({ ...f, gender: g.v }))}
                                                    className={`px-4 py-1.5 rounded-lg border text-sm ${questionnaireForm.gender === g.v ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>
                                                    {g.l}
                                                </button>
                                            ))}
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
                                        <label className="block text-sm font-medium mb-1">Уровень стресса (1-10)</label>
                                        <input type="range" min="1" max="10" value={questionnaireForm.stressLevel || 5}
                                            onChange={e => setQuestionnaireForm(f => ({ ...f, stressLevel: Number(e.target.value) }))}
                                            className="w-full accent-primary" />
                                        <div className="flex justify-between text-xs text-muted-foreground"><span>1</span><span>{questionnaireForm.stressLevel || 5}</span><span>10</span></div>
                                    </div>
                                </div>
                            </div>
                            {/* Section 4 */}
                            <div>
                                <h3 className="text-base font-semibold mb-3 text-primary">4. Психическое здоровье</h3>
                                <div className="space-y-3">
                                    <QInput label="Наличие расстройства" value={questionnaireForm.mentalDisorders || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, mentalDisorders: v }))} multiline />
                                    <QInput label="Лекарства" value={questionnaireForm.medications || ''} onChange={v => setQuestionnaireForm(f => ({ ...f, medications: v }))} />
                                    <QInput label="Сон (часов)" value={String(questionnaireForm.sleepHours || '')} onChange={v => setQuestionnaireForm(f => ({ ...f, sleepHours: Number(v) || undefined }))} />
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Качество сна</label>
                                        <div className="flex gap-2">
                                            {[{ v: 'excellent', l: 'Отличное' }, { v: 'good', l: 'Хорошее' }, { v: 'poor', l: 'Плохое' }].map(q => (
                                                <button key={q.v} type="button" onClick={() => setQuestionnaireForm(f => ({ ...f, sleepQuality: q.v }))}
                                                    className={`px-3 py-1.5 rounded-lg border text-sm ${questionnaireForm.sleepQuality === q.v ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>
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
                                        <label className="block text-sm font-medium mb-1">Предыдущая терапия</label>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => setQuestionnaireForm(f => ({ ...f, previousTherapy: true }))}
                                                className={`px-4 py-1.5 rounded-lg border text-sm ${questionnaireForm.previousTherapy === true ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>Да</button>
                                            <button type="button" onClick={() => setQuestionnaireForm(f => ({ ...f, previousTherapy: false }))}
                                                className={`px-4 py-1.5 rounded-lg border text-sm ${questionnaireForm.previousTherapy === false ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>Нет</button>
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
                        <div className="p-6 border-t border-border flex gap-3 sticky bottom-0 bg-white">
                            <button onClick={() => setShowEditQuestionnaire(false)} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">Отмена</button>
                            <button onClick={handleSaveQuestionnaire} className="flex-1 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">Сохранить</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper Components
function QInput({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
    return (
        <div>
            <label className="block text-sm font-medium mb-1">{label}</label>
            {multiline ? (
                <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm resize-none" />
            ) : (
                <input type="text" value={value} onChange={e => onChange(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm" />
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
        <div>
            <h3 className="text-base font-semibold mb-3 text-primary">{title}</h3>
            <div className="space-y-2 pl-4">
                {fields.map(f => {
                    const val = data[f.key as keyof QuestionnaireData];
                    if (val === undefined || val === null || val === '') return null;
                    return (
                        <div key={f.key} className="flex gap-2">
                            <span className="text-sm text-muted-foreground whitespace-nowrap">{f.label}:</span>
                            <span className="text-sm">{f.transform ? f.transform(val) : `${val}${f.suffix || ''}`}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
