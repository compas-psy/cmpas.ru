'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Clock, User, Video, MapPin } from 'lucide-react';
import { toast } from 'sonner';

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
    client: { id: string; name: string };
};

type Client = {
    id: string;
    name: string;
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
        <div className="space-y-6">
            {/* Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                        <CalendarIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold">{sessions.filter(s => {
                            const d = new Date(s.date);
                            const now = new Date();
                            // Check if in current week (approx)
                            const startOfWeek = new Date(now);
                            startOfWeek.setDate(now.getDate() - (now.getDay() + 6) % 7);
                            const endOfWeek = new Date(startOfWeek);
                            endOfWeek.setDate(startOfWeek.getDate() + 6);
                            return d >= startOfWeek && d <= endOfWeek;
                        }).length}</div>
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Записей на неделю</div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                        <User className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold">{clients.length}</div>
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Всего клиентов</div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold">{sessions.filter(s => s.status === 'pending').length}</div>
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Ожидают подтверждения</div>
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-semibold">Календарь</h1>
                    <p className="text-muted-foreground text-sm mt-1">Управляйте своими записями</p>
                </div>
                <button
                    onClick={() => { setShowNewSession(true); setNewSessionDefaults({ date: selectedDate }); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium self-start"
                >
                    <Plus className="w-4 h-4" />
                    Новая запись
                </button>
            </div>

            {/* View Mode Tabs */}
            <div className="flex gap-1 bg-muted/50 p-1 rounded-lg w-fit">
                {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
                    <button
                        key={mode}
                        onClick={() => {
                            setViewMode(mode);
                            // Sync current date with selected date when switching to day view
                            if (mode === 'day') setCurrentDate(selectedDate);
                        }}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === mode ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        {mode === 'month' ? 'Месяц' : mode === 'week' ? 'Неделя' : 'День'}
                    </button>
                ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigateDate('prev')} className="p-2 hover:bg-muted rounded-lg transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-semibold capitalize min-w-[200px] text-center">
                    {getHeaderText()}
                </h2>
                <button onClick={() => navigateDate('next')} className="p-2 hover:bg-muted rounded-lg transition-colors">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendar Grid / Week / List */}
                <div className="lg:col-span-2">
                    {viewMode === 'month' && (
                        <div className="bg-white rounded-lg border border-border overflow-hidden">
                            <div className="grid grid-cols-7 bg-muted/30">
                                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
                                    <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground border-r border-b border-border last:border-r-0">{d}</div>
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
                                            className={`p-2 border-r border-b border-border last:border-r-0 hover:bg-muted/50 transition-colors text-center relative min-h-[56px] md:aspect-square ${!isCurrentMonth ? 'bg-muted/20' : ''} ${isToday ? 'bg-primary/5' : ''} ${isSelected ? 'bg-primary/10 ring-2 ring-primary ring-inset' : ''}`}
                                        >
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={`text-xs font-medium ${isToday ? 'w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center' : isSelected ? 'w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center' : isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                    {day.getDate()}
                                                </span>
                                                {daySessions.length > 0 && (
                                                    <div className="flex gap-0.5 justify-center flex-wrap">
                                                        {daySessions.slice(0, 4).map(s => (
                                                            <div key={s.id} className={`w-1.5 h-1.5 rounded-full ${statusColors[s.status] || 'bg-border'}`} />
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
                        <div className="bg-white rounded-lg border border-border overflow-hidden">
                            <div className="grid grid-cols-7">
                                {getWeekDays().map((day, i) => {
                                    const daySessions = getSessionsForDay(day);
                                    const isToday = isSameDay(day, new Date());
                                    const isSelected = isSameDay(day, selectedDate);
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => setSelectedDate(day)}
                                            className={`p-3 border-r border-border last:border-r-0 hover:bg-muted/50 transition-colors text-center ${isToday ? 'bg-primary/5' : ''} ${isSelected ? 'bg-primary/10' : ''}`}
                                        >
                                            <div className="text-xs text-muted-foreground mb-1">
                                                {day.toLocaleDateString('ru-RU', { weekday: 'short' })}
                                            </div>
                                            <div className={`text-lg font-semibold mb-2 ${isToday ? 'text-primary' : ''}`}>
                                                {day.getDate()}
                                            </div>
                                            <div className="space-y-1">
                                                {daySessions.map(s => (
                                                    <div key={s.id} className={`text-xs p-1 rounded ${statusColors[s.status]}/10 border-l-2 text-left`} style={{ borderLeftColor: 'var(--color-primary)' }}>
                                                        <div className="font-medium truncate">{s.time}</div>
                                                        <div className="text-muted-foreground truncate">{s.client.name}</div>
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
                        <div className="space-y-3">
                            {selectedSessions.length === 0 ? (
                                <div className="bg-white rounded-lg border border-border p-12 text-center">
                                    <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                                    <p className="text-muted-foreground">Нет записей на {formatDate(currentDate)}</p>
                                </div>
                            ) : (
                                selectedSessions.map(s => (
                                    <div key={s.id} className="bg-white rounded-lg border border-border p-4 flex items-center gap-4">
                                        <div className={`w-1 h-12 rounded-full ${statusColors[s.status]}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium">{s.client.name}</div>
                                            <div className="text-sm text-muted-foreground">{s.time} – {s.endTime} · {s.duration} мин</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs px-2 py-1 rounded-full ${statusColors[s.status]}/10 font-medium`}>
                                                {statusLabels[s.status]}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{s.format === 'online' ? '💻 Онлайн' : '🏢 Офлайн'}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Day detail panel */}
                <div className="space-y-4">
                    <div className="bg-white rounded-lg border border-border p-4">
                        <h3 className="font-semibold mb-3">{formatDate(selectedDate)}</h3>
                        {selectedSessions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Нет записей</p>
                        ) : (
                            <div className="space-y-3">
                                {selectedSessions.map(s => (
                                    <div key={s.id} className="p-3 bg-[#f5f5f5] rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={`w-2 h-2 rounded-full ${statusColors[s.status]}`} />
                                            <span className="font-medium text-sm">{s.time} – {s.endTime}</span>
                                        </div>
                                        <div className="text-sm mb-1">{s.client.name}</div>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                            <span>{s.type === 'individual' ? 'Индивидуальная' : s.type === 'couple' ? 'Парная' : 'Семейная'}</span>
                                            <span>{s.format === 'online' ? '💻' : '🏢'}</span>
                                        </div>
                                        <div className="flex gap-1 mt-2">
                                            {s.status !== 'completed' && (
                                                <button onClick={() => handleStatusChange(s.id, 'completed')} className="text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors">
                                                    Завершить
                                                </button>
                                            )}
                                            {s.status !== 'cancelled' && (
                                                <button onClick={() => handleStatusChange(s.id, 'cancelled')} className="text-xs px-2 py-1 bg-destructive/10 text-destructive rounded hover:bg-destructive/20 transition-colors">
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
        </div>
    );
}

import { SessionModal } from './components/SessionModal';
        </div >
    );
}
