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

    const [newSession, setNewSession] = useState({
        clientId: '',
        date: '',
        time: '10:00',
        duration: 50,
        type: 'individual',
        format: 'online',
    });

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

    const handleCreateSession = async () => {
        if (!newSession.clientId || !newSession.date || !newSession.time) {
            toast.error('Заполните все обязательные поля');
            return;
        }
        try {
            const { createSession } = await import('./actions/sessions');
            await createSession(newSession);
            toast.success('Запись создана');
            setShowNewSession(false);
            setNewSession({ clientId: '', date: '', time: '10:00', duration: 50, type: 'individual', format: 'online' });
            fetchSessions();
        } catch {
            toast.error('Ошибка при создании записи');
        }
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
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-semibold">Календарь</h1>
                    <p className="text-muted-foreground text-sm mt-1">Управляйте своими записями</p>
                </div>
                <button
                    onClick={() => { setShowNewSession(true); setNewSession(s => ({ ...s, date: selectedDate.toISOString().slice(0, 10) })); }}
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
            {showNewSession && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-auto">
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <h2 className="text-xl font-semibold">Новая запись</h2>
                            <button onClick={() => setShowNewSession(false)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2"><User className="w-4 h-4 inline mr-1" />Клиент</label>
                                <select
                                    value={newSession.clientId}
                                    onChange={e => setNewSession(s => ({ ...s, clientId: e.target.value }))}
                                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                                >
                                    <option value="">Выберите клиента</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2"><CalendarIcon className="w-4 h-4 inline mr-1" />Дата</label>
                                <input type="date" value={newSession.date} onChange={e => setNewSession(s => ({ ...s, date: e.target.value }))}
                                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2"><Clock className="w-4 h-4 inline mr-1" />Время</label>
                                    <input type="time" value={newSession.time} onChange={e => setNewSession(s => ({ ...s, time: e.target.value }))}
                                        className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Длительность</label>
                                    <select value={newSession.duration} onChange={e => setNewSession(s => ({ ...s, duration: Number(e.target.value) }))}
                                        className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
                                        <option value={50}>50 мин</option>
                                        <option value={80}>80 мин</option>
                                        <option value={90}>90 мин</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Тип</label>
                                <div className="flex gap-2">
                                    {[{ v: 'individual', l: 'Индивид.' }, { v: 'couple', l: 'Парная' }, { v: 'family', l: 'Семейная' }].map(t => (
                                        <button key={t.v} type="button" onClick={() => setNewSession(s => ({ ...s, type: t.v }))}
                                            className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${newSession.type === t.v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}>
                                            {t.l}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Формат</label>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setNewSession(s => ({ ...s, format: 'online' }))}
                                        className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors flex items-center justify-center gap-2 ${newSession.format === 'online' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}>
                                        <Video className="w-4 h-4" />Онлайн
                                    </button>
                                    <button type="button" onClick={() => setNewSession(s => ({ ...s, format: 'offline' }))}
                                        className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors flex items-center justify-center gap-2 ${newSession.format === 'offline' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}>
                                        <MapPin className="w-4 h-4" />Офлайн
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-border flex gap-3">
                            <button onClick={() => setShowNewSession(false)} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                                Отмена
                            </button>
                            <button onClick={handleCreateSession} className="flex-1 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">
                                Создать
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
