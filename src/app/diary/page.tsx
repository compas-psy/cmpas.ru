'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Clock, User, Video, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { SessionModal } from './components/SessionModal';

type Session = {
    id: string;
    clientId: string;
    date: string;
    time: string;
    endTime: string | null;
    duration: number;
    type: string;
    format: string;
    status: string;
    notes: string | null;
    client: { id: string; name: string; questionnaire?: { data: any } | null };
};

type Client = {
    id: string;
    name: string;
    questionnaire?: { data: any } | null;
};

type ViewMode = 'month' | 'week' | 'day';

function isSameDay(d1: Date, d2: Date) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function formatDate(d: Date) {
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

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

export default function DiaryCalendarPage() {
    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [sessions, setSessions] = useState<Session[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [showNewSession, setShowNewSession] = useState(false);
    const [loading, setLoading] = useState(true);

    const [newSessionDefaults, setNewSessionDefaults] = useState<{ date?: Date }>({});

    const fetchSessions = useCallback(async () => {
        try {
            const { getSessions } = await import('./actions/sessions');
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const from = new Date(year, month - 1, 1);
            const to = new Date(year, month + 2, 0);
            const data = await getSessions(from, to);
            setSessions(data.map(s => ({ ...s, date: new Date(s.date).toISOString() })));
        } catch { /* empty */ }
        setLoading(false);
    }, [currentDate]);

    const fetchClients = useCallback(async () => {
        try {
            const { getClients } = await import('./actions/clients');
            const data = await getClients();
            setClients(data.map(c => ({ id: c.id, name: c.name })));
        } catch { /* empty */ }
    }, []);

    useEffect(() => { fetchSessions(); }, [fetchSessions]);
    useEffect(() => { fetchClients(); }, [fetchClients]);

    const handleSessionSave = () => {
        fetchSessions();
        setShowNewSession(false);
    };

    const handleStatusChange = async (id: string, status: string) => {
        try {
            const { updateSession } = await import('./actions/sessions');
            await updateSession(id, { status });
            toast.success('Статус обновлён');
            fetchSessions();
        } catch {
            toast.error('Ошибка');
        }
    };

    const navigateDate = (direction: 'prev' | 'next') => {
        const d = new Date(currentDate);
        if (viewMode === 'month') {
            d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1));
        } else if (viewMode === 'week') {
            d.setDate(d.getDate() + (direction === 'next' ? 7 : -7));
        } else {
            d.setDate(d.getDate() + (direction === 'next' ? 1 : -1));
        }
        setCurrentDate(d);
        if (viewMode === 'day') setSelectedDate(d);
    };

    const getHeaderText = () => {
        if (viewMode === 'month') {
            return currentDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
        }
        if (viewMode === 'week') {
            const startStr = getWeekDays()[0].toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
            const endStr = getWeekDays()[6].toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
            return `${startStr} - ${endStr}`;
        }
        return currentDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    // Calendar grid
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startOffset);
    const calendarDays: Date[] = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        calendarDays.push(d);
    }

    const getSessionsForDay = (day: Date) => sessions.filter(s => isSameDay(new Date(s.date), day));
    const selectedSessions = sessions.filter(s => isSameDay(new Date(s.date), selectedDate));

    // Week view
    const getWeekDays = () => {
        const start = new Date(currentDate);
        const dayOfWeek = (start.getDay() + 6) % 7;
        start.setDate(start.getDate() - dayOfWeek);
        const days: Date[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.push(d);
        }
        return days;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Календарь</h1>
                    <p className="text-muted-foreground text-base mt-2">Управляйте своими записями</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={() => window.location.href = '/diary/availability'}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-transparent text-foreground hover:bg-muted font-semibold rounded-lg transition-all md:w-auto w-full"
                    >
                        <Plus className="w-4 h-4" /> Окно
                    </button>
                    <button
                        onClick={() => { setShowNewSession(true); setNewSessionDefaults({ date: selectedDate }); }}
                        className="flex items-center justify-center gap-2 px-6 py-2 bg-accent text-accent-foreground rounded-lg shadow-sm hover:bg-accent/90 transition-all font-semibold active:scale-[0.98] md:w-auto w-full"
                    >
                        <Plus className="w-4 h-4" /> Запись
                    </button>
                </div>
            </div>

            {/* Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card py-3 px-4 rounded-xl border border-border bg-white flex items-start gap-4 transition-all hover:shadow-sm">
                    <div className="mt-1 text-muted-foreground">
                        <CalendarIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold tracking-tight text-foreground leading-none mb-1">{sessions.filter(s => {
                            const d = new Date(s.date);
                            const now = new Date();
                            const startOfWeek = new Date(now);
                            startOfWeek.setDate(now.getDate() - (now.getDay() + 6) % 7);
                            const endOfWeek = new Date(startOfWeek);
                            endOfWeek.setDate(startOfWeek.getDate() + 6);
                            return d >= startOfWeek && d <= endOfWeek;
                        }).length}</div>
                        <div className="text-xs font-medium text-muted-foreground">Записей на неделе</div>
                    </div>
                </div>
                <div className="bg-card py-3 px-4 rounded-xl border border-border bg-white flex items-start gap-4 transition-all hover:shadow-sm">
                    <div className="mt-1 text-accent">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold tracking-tight text-foreground leading-none mb-1">{sessions.filter(s => s.status === 'pending').length}</div>
                        <div className="text-xs font-medium text-muted-foreground">Свободных окон</div>
                    </div>
                </div>
                <div className="bg-card py-3 px-4 rounded-xl border border-border bg-white flex items-start gap-4 transition-all hover:shadow-sm">
                    <div className="mt-1 text-primary">
                        <User className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold tracking-tight text-foreground leading-none mb-1">{clients.length}</div>
                        <div className="text-xs font-medium text-muted-foreground">Всего клиентов</div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-2 rounded-2xl border border-border shadow-sm">
                {/* View Mode Tabs */}
                <div className="flex gap-1 bg-muted/50 p-1.5 rounded-xl w-full md:w-auto">
                    {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
                        <button
                            key={mode}
                            onClick={() => {
                                setViewMode(mode);
                                if (mode === 'day') setCurrentDate(selectedDate);
                            }}
                            className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-semibold transition-all min-h-[40px] ${viewMode === mode ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                        >
                            {mode === 'month' ? 'Месяц' : mode === 'week' ? 'Неделя' : 'День'}
                        </button>
                    ))}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between gap-4 px-2 w-full md:w-auto">
                    <button onClick={() => navigateDate('prev')} className="p-2.5 hover:bg-muted rounded-xl transition-colors active:scale-95">
                        <ChevronLeft className="w-5 h-5 text-foreground" />
                    </button>
                    <h2 className="text-lg font-bold tracking-tight capitalize min-w-[200px] text-center text-foreground">
                        {getHeaderText()}
                    </h2>
                    <button onClick={() => navigateDate('next')} className="p-2.5 hover:bg-muted rounded-xl transition-colors active:scale-95">
                        <ChevronRight className="w-5 h-5 text-foreground" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendar Grid / Week / List */}
                <div className="lg:col-span-2">
                    {viewMode === 'month' && (
                        <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
                            <div className="grid grid-cols-7 bg-muted/50">
                                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
                                    <div key={d} className="p-4 text-center text-sm font-bold text-foreground border-r border-b border-border/50 last:border-r-0 tracking-tight">{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7">
                                {calendarDays.map((day, i) => {
                                    const daySessions = getSessionsForDay(day);
                                    const isToday = isSameDay(day, new Date());
                                    const isCurrentMonth = day.getMonth() === month;
                                    const isSelected = isSameDay(day, selectedDate);
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => setSelectedDate(day)}
                                            className={`p-2 border-r border-b border-border/50 last:border-r-0 hover:bg-muted/50 transition-colors text-center relative min-h-[80px] md:aspect-square ${!isCurrentMonth ? 'bg-muted/10 opacity-50' : 'bg-background'} ${isToday ? 'bg-primary/5' : ''} ${isSelected ? 'bg-primary/5 ring-2 ring-primary ring-inset overflow-hidden' : ''}`}
                                        >
                                            <div className="flex flex-col items-center gap-2 h-full">
                                                <span className={`text-sm font-bold w-8 h-8 flex items-center justify-center rounded-xl transition-colors ${isToday ? 'bg-primary text-primary-foreground shadow-sm' : isSelected ? 'bg-primary/20 text-primary' : isCurrentMonth ? 'text-foreground hover:bg-muted' : 'text-muted-foreground hover:bg-muted'}`}>
                                                    {day.getDate()}
                                                </span>
                                                {daySessions.length > 0 && (
                                                    <div className="flex gap-1.5 justify-center flex-wrap px-1">
                                                        {daySessions.slice(0, 4).map(s => (
                                                            <div key={s.id} className={`w-2.5 h-2.5 rounded-full shadow-sm ${statusColors[s.status] || 'bg-border'}`} />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {viewMode === 'week' && (
                        <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden min-h-[500px]">
                            <div className="grid grid-cols-7 h-full">
                                {getWeekDays().map((day, i) => {
                                    const daySessions = getSessionsForDay(day);
                                    const isToday = isSameDay(day, new Date());
                                    const isSelected = isSameDay(day, selectedDate);
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => setSelectedDate(day)}
                                            className={`p-4 border-r border-border/50 last:border-r-0 hover:bg-muted/30 transition-colors text-center h-full flex flex-col bg-background ${isToday ? 'bg-primary/5' : ''} ${isSelected ? 'bg-primary/5' : ''}`}
                                        >
                                            <div className="text-sm font-semibold text-muted-foreground mb-2 tracking-tight">
                                                {day.toLocaleDateString('ru-RU', { weekday: 'short' })}
                                            </div>
                                            <div className={`text-xl w-10 h-10 rounded-xl flex items-center justify-center mx-auto font-bold mb-5 ${isToday ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground'}`}>
                                                {day.getDate()}
                                            </div>
                                            <div className="space-y-3 flex-1 w-full text-left">
                                                {daySessions.map(s => (
                                                    <div key={s.id} className={`text-xs p-2.5 rounded-xl border-l-4 text-left shadow-sm bg-card`} style={{ borderLeftColor: 'var(--color-primary)' }}>
                                                        <div className="font-bold truncate mb-1 text-foreground">{s.time}</div>
                                                        <div className="text-muted-foreground font-medium truncate">
                                                            {s.client.questionnaire?.data && (s.client.questionnaire.data as any).fullName
                                                                ? (s.client.questionnaire.data as any).fullName
                                                                : s.client.name}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {viewMode === 'day' && (
                        <div className="space-y-4">
                            {selectedSessions.length === 0 ? (
                                <div className="bg-card rounded-3xl border border-border shadow-sm p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
                                    <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-5 text-muted-foreground">
                                        <CalendarIcon className="w-10 h-10 opacity-50" />
                                    </div>
                                    <p className="text-foreground font-bold text-lg mb-2">Нет записей</p>
                                    <p className="text-muted-foreground text-base">Ничего не запланировано на {formatDate(currentDate)}</p>
                                    <button
                                        onClick={() => { setShowNewSession(true); setNewSessionDefaults({ date: currentDate }); }}
                                        className="mt-6 text-sm text-primary font-semibold flex items-center gap-2 hover:bg-primary/5 px-4 py-2 rounded-xl transition-colors"
                                    >
                                        <Plus className="w-4 h-4" /> Добавить запись
                                    </button>
                                </div>
                            ) : (
                                selectedSessions.map(s => (
                                    <div key={s.id} className="bg-card rounded-3xl border border-border shadow-sm p-6 flex flex-col sm:flex-row sm:items-center gap-5 transition-all hover:border-primary/30">
                                        <div className={`hidden sm:block w-1.5 h-16 rounded-full ${statusColors[s.status]}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-foreground text-xl mb-1.5">
                                                {s.client.questionnaire?.data && (s.client.questionnaire.data as any).fullName
                                                    ? (s.client.questionnaire.data as any).fullName
                                                    : s.client.name}
                                            </div>
                                            <div className="text-sm font-semibold text-muted-foreground flex items-center gap-2.5">
                                                <div className="flex items-center gap-1.5 text-foreground">
                                                    <Clock className="w-4 h-4 text-primary" />
                                                    {s.time} – {s.endTime}
                                                </div>
                                                <span className="text-border">•</span>
                                                <span>{s.duration} мин</span>
                                            </div>
                                        </div>
                                        <div className="flex sm:flex-col items-center sm:items-end gap-3 shrink-0 pt-4 sm:pt-0 border-t sm:border-0 border-border/50">
                                            <span className={`text-xs px-3 py-1.5 rounded-xl ${statusColors[s.status]}/10 ${statusColors[s.status].replace('bg-', 'text-')} font-bold tracking-tight`}>
                                                {statusLabels[s.status]}
                                            </span>
                                            <span className="text-xs px-3 py-1.5 bg-secondary text-secondary-foreground rounded-xl font-bold flex items-center gap-2">
                                                {s.format === 'online' ? <Video className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                                                {s.format === 'online' ? 'Онлайн' : 'Офлайн'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Day detail panel */}
                <div className="space-y-4">
                    <div className="bg-card rounded-3xl border border-border shadow-sm p-6 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-6 border-b border-border/50 pb-5">
                            <h3 className="font-bold text-foreground text-xl tracking-tight">{formatDate(selectedDate)}</h3>
                            <div className="px-3 py-1 rounded-full bg-primary/10 text-primary font-bold text-sm">
                                {selectedSessions.length} {selectedSessions.length === 1 ? 'запись' : selectedSessions.length > 1 && selectedSessions.length < 5 ? 'записи' : 'записей'}
                            </div>
                        </div>

                        {selectedSessions.length === 0 ? (
                            <div className="text-center py-12 flex-1 flex flex-col items-center justify-center">
                                <p className="text-base text-muted-foreground font-medium">Нет записей в этот день</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {selectedSessions.map(s => (
                                    <div key={s.id} className="p-5 bg-background rounded-2xl border border-border/50 hover:border-border transition-colors shadow-sm">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className={`w-3 h-3 rounded-full ${statusColors[s.status]} shadow-sm`} />
                                            <span className="font-bold text-lg text-foreground flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-primary" />
                                                {s.time} – {s.endTime}
                                            </span>
                                        </div>
                                        <div className="text-base font-bold mb-2 text-foreground flex items-center gap-2">
                                            <User className="w-5 h-5 text-muted-foreground" />
                                            {s.client.name}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold mt-4 mb-5">
                                            <span className="bg-secondary text-secondary-foreground px-3 py-1.5 rounded-xl">{s.type === 'individual' ? 'Индивидуальная' : s.type === 'couple' ? 'Парная' : 'Семейная'}</span>
                                            <span className="bg-secondary text-secondary-foreground px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                                                {s.format === 'online' ? <Video className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                                                {s.format === 'online' ? 'Онлайн' : 'Офлайн'}
                                            </span>
                                        </div>
                                        <div className="flex gap-3 mt-4 pt-4 border-t border-border/50">
                                            {s.status !== 'completed' && (
                                                <button onClick={() => handleStatusChange(s.id, 'completed')} className="text-sm px-4 py-2 min-h-[40px] font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all flex-1 active:scale-[0.98]">
                                                    Завершить
                                                </button>
                                            )}
                                            {s.status !== 'cancelled' && (
                                                <button onClick={() => handleStatusChange(s.id, 'cancelled')} className="text-sm px-4 py-2 min-h-[40px] font-semibold bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition-all flex-1 active:scale-[0.98]">
                                                    Отменить
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* New Session Modal */}
            <SessionModal
                isOpen={showNewSession}
                onClose={() => setShowNewSession(false)}
                onSave={handleSessionSave}
                initialDate={newSessionDefaults.date}
                clients={clients}
            />
        </div>);
}
