'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X,
    Clock, User, Video, MapPin, ArrowRightLeft, Loader2,
    Link as LinkIcon, AlertTriangle, FileText, Sparkles, List
} from 'lucide-react';
import { toast } from 'sonner';
import { SessionModal } from '../components/SessionModal';
import { RescheduleModal } from '../components/RescheduleModal';

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
    structuredNotes: any;
    privateNotes: any;
    clientSummary: string | null;
    client: { id: string; name: string; questionnaire?: { data: any } | null };
};

type Client = {
    id: string;
    name: string;
    questionnaire?: { data: any } | null;
};

type ViewMode = 'month' | 'week' | 'day' | 'list';

function isSameDay(d1: Date, d2: Date) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function formatDate(d: Date) {
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

const statusDotColor: Record<string, string> = {
    confirmed: 'bg-success-500',
    pending: 'bg-orange-500',
    completed: 'bg-muted-foreground',
    cancelled: 'bg-red-500',
};

const statusBadge: Record<string, string> = {
    confirmed: 'bg-success-soft text-success-500',
    pending: 'bg-orange-soft text-orange-500',
    completed: 'bg-sage-100 text-muted-foreground',
    cancelled: 'bg-red-soft text-red-500',
};

const statusLabels: Record<string, string> = {
    confirmed: 'Подтверждено',
    pending: 'Ожидает',
    completed: 'Завершено',
    cancelled: 'Отменено',
};

export default function DiaryCalendarView() {
    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [sessions, setSessions] = useState<Session[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [showNewSession, setShowNewSession] = useState(false);
    const [editingSession, setEditingSession] = useState<Session | null>(null);
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [newSessionDefaults, setNewSessionDefaults] = useState<{ date?: Date }>({});
    const [rescheduleTarget, setRescheduleTarget] = useState<Session | null>(null);
    const [mobileFreeTimes, setMobileFreeTimes] = useState<{ time: string; format: string; addressId: string | null }[]>([]);
    const [loadingFreeTimes, setLoadingFreeTimes] = useState(false);
    const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

    const fetchSessions = useCallback(async () => {
        try {
            const { getSessions } = await import('../actions/sessions');
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
            const { getClients } = await import('../actions/clients');
            const data = await getClients();
            setClients(data.map(c => ({ id: c.id, name: c.name })));
        } catch { /* empty */ }
    }, []);

    const fetchSettings = useCallback(async () => {
        try {
            const { getSettings } = await import('../actions/settings');
            const res = await getSettings();
            if (res.success && res.data) {
                setSettings(res.data);
            }
        } catch (e: any) {
            console.error('fetchSettings error:', e);
        }
    }, []);

    useEffect(() => { fetchSessions(); }, [fetchSessions]);
    useEffect(() => { fetchClients(); }, [fetchClients]);
    useEffect(() => { fetchSettings(); }, [fetchSettings]);

    useEffect(() => {
        const loadFreeTimes = async () => {
            setLoadingFreeTimes(true);
            try {
                const { getAvailableTimesForReschedule } = await import('../actions/sessions');
                const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
                const times = await getAvailableTimesForReschedule(dateStr);
                setMobileFreeTimes(times);
            } catch { setMobileFreeTimes([]); }
            setLoadingFreeTimes(false);
        };
        loadFreeTimes();
    }, [selectedDate, sessions.length]);

    const handleSessionSave = () => { fetchSessions(); setShowNewSession(false); };

    const handleStatusChange = async (id: string, status: string) => {
        try {
            if (status === 'cancelled') {
                const { deleteSession } = await import('../actions/sessions');
                await deleteSession(id);
                toast.success('Запись удалена из календаря');
            } else {
                const { updateSession } = await import('../actions/sessions');
                await updateSession(id, { status });
                toast.success('Статус обновлён');
            }
            fetchSessions();
        } catch { toast.error('Ошибка'); }
    };

    const navigateDate = (direction: 'prev' | 'next') => {
        const d = new Date(currentDate);
        if (viewMode === 'month' || viewMode === 'list') {
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
        if (viewMode === 'month' || viewMode === 'list') {
            return currentDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
        }
        if (viewMode === 'week') {
            const startStr = getWeekDays()[0].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
            const endStr = getWeekDays()[6].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
            return `${startStr} – ${endStr}`;
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
    const selectedSessions = sessions.filter(s => isSameDay(new Date(s.date), selectedDate)).sort((a, b) => a.time.localeCompare(b.time));

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
        <div className="space-y-6 pb-12">
            {/* ── TOOLBAR ── */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-3">
                    {/* View switcher */}
                    <div className="flex items-center bg-sage-50 border border-border p-1 rounded-xl gap-0.5">
                        {(['month', 'week', 'day', 'list'] as ViewMode[]).map((m) => (
                            <button key={m} onClick={() => setViewMode(m)}
                                className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all ${viewMode === m ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                {m === 'month' ? 'Месяц' : m === 'week' ? 'Неделя' : m === 'day' ? 'День' : 'Список'}
                            </button>
                        ))}
                    </div>

                    {/* Date navigation */}
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => navigateDate('prev')} className="p-2 hover:bg-sage-100 rounded-xl transition-colors">
                            <ChevronLeft className="w-4.5 h-4.5 text-muted-foreground" />
                        </button>
                        <button
                            onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }}
                            className="px-3 py-1.5 text-[13px] font-semibold text-forest-700 bg-sage-100 hover:bg-sage-150 rounded-lg transition-colors"
                        >
                            Сегодня
                        </button>
                        <button onClick={() => navigateDate('next')} className="p-2 hover:bg-sage-100 rounded-xl transition-colors">
                            <ChevronRight className="w-4.5 h-4.5 text-muted-foreground" />
                        </button>
                    </div>

                    <span className="text-[15px] font-bold text-foreground capitalize hidden md:inline">{getHeaderText()}</span>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        onClick={() => { setShowNewSession(true); setNewSessionDefaults({ date: selectedDate }); }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl shadow-card hover:bg-forest-700 transition-all font-semibold active:scale-[0.97] text-sm"
                    >
                        <Plus className="w-4 h-4" /> Запись
                    </button>
                </div>
            </div>

            {/* Mobile date label */}
            <div className="md:hidden text-[15px] font-bold text-foreground capitalize -mt-2">{getHeaderText()}</div>

            {/* ── CONTENT ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Calendar Grid / Week / Day */}
                <div className="lg:col-span-2">
                    {viewMode === 'month' && (
                        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
                            <div className="grid grid-cols-7 bg-sage-50">
                                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
                                    <div key={d} className="p-3 md:p-4 text-center text-small-meta font-bold text-muted-foreground border-r border-b border-border/40 last:border-r-0 uppercase tracking-wider">{d}</div>
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
                                            className={`p-1.5 md:p-2.5 border-r border-b border-border/30 last:border-r-0 hover:bg-sage-50 transition-colors text-center relative min-h-[52px] md:min-h-[80px] ${!isCurrentMonth ? 'opacity-35' : ''} ${isToday ? 'bg-sage-50' : ''} ${isSelected ? 'bg-primary/5 ring-2 ring-primary ring-inset' : ''}`}
                                        >
                                            <div className="flex flex-col items-center gap-1 md:gap-2">
                                                <span className={`text-[13px] font-bold w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-lg transition-colors ${isToday ? 'bg-primary text-primary-foreground shadow-sm' : isSelected ? 'bg-primary/15 text-primary' : 'text-foreground'}`}>
                                                    {day.getDate()}
                                                </span>
                                                {daySessions.length > 0 && (
                                                    <div className="flex gap-1 justify-center flex-wrap">
                                                        {daySessions.slice(0, 4).map(s => (
                                                            <div key={s.id} className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${statusDotColor[s.status] || 'bg-border'}`} />
                                                        ))}
                                                        {daySessions.length > 4 && (
                                                            <span className="text-[9px] font-bold text-muted-foreground">+{daySessions.length - 4}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {viewMode === 'week' && (() => {
                        const weekDaysList = getWeekDays();
                        return (
                            <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
                                {/* Week Header */}
                                <div className="grid grid-cols-7 border-b border-border bg-sage-50">
                                    {weekDaysList.map((date, i) => {
                                        const isToday = isSameDay(date, new Date());
                                        return (
                                            <div key={i} className={`p-3 md:p-4 text-center border-r border-border/30 last:border-r-0 ${isToday ? 'bg-primary/5' : ''}`}>
                                                <div className="text-small-meta font-bold text-muted-foreground uppercase tracking-wider mb-1">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][i]}</div>
                                                <div className={`text-[18px] font-bold w-10 h-10 mx-auto flex items-center justify-center rounded-xl ${isToday ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground'}`}>
                                                    {date.getDate()}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Week Body */}
                                <div className="grid grid-cols-7 min-h-[300px]">
                                    {weekDaysList.map((date, i) => {
                                        const daySessions = sessions.filter(s => isSameDay(new Date(s.date), date)).sort((a, b) => a.time.localeCompare(b.time));
                                        const isToday = isSameDay(date, new Date());
                                        return (
                                            <div key={i} className={`p-2 border-r border-border/30 last:border-r-0 ${isToday ? 'bg-primary/[0.02]' : ''}`}>
                                                <div className="space-y-1.5 mt-1">
                                                    {daySessions.map(s => {
                                                        const cn = s.client?.name || clients.find(c => c.id === s.clientId)?.name || 'Клиент';
                                                        return (
                                                            <button key={s.id} onClick={() => { setSelectedDate(date); setEditingSession(s); setShowNewSession(true); }}
                                                                className="w-full text-left p-2 bg-sage-50 border border-border/40 rounded-lg text-[12px] font-semibold transition-all hover:border-primary/30 hover:shadow-sm active:scale-[0.97] overflow-hidden"
                                                            >
                                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotColor[s.status]}`} />
                                                                    <span className="text-muted-foreground tabular-nums">{s.time}</span>
                                                                </div>
                                                                <div className="truncate text-foreground">{cn}</div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    {viewMode === 'day' && (
                        <div className="space-y-3">
                            {selectedSessions.length === 0 ? (
                                <div className="bg-card rounded-2xl border border-border shadow-card p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
                                    <div className="w-16 h-16 rounded-3xl bg-sage-100 flex items-center justify-center mb-4">
                                        <CalendarIcon className="w-8 h-8 text-forest-600" />
                                    </div>
                                    <p className="text-foreground font-bold text-lg mb-1">Нет записей</p>
                                    <p className="text-muted-foreground text-body-secondary">{formatDate(currentDate)}</p>
                                    <button
                                        onClick={() => { setShowNewSession(true); setNewSessionDefaults({ date: currentDate }); }}
                                        className="mt-5 text-sm text-forest-700 font-bold flex items-center gap-2 hover:bg-sage-100 px-4 py-2.5 rounded-xl transition-colors"
                                    >
                                        <Plus className="w-4 h-4" /> Добавить запись
                                    </button>
                                </div>
                            ) : (
                                selectedSessions.map(s => (
                                    <div key={s.id} onClick={() => { setEditingSession(s); setShowNewSession(true); }}
                                        className="bg-card rounded-2xl border border-border shadow-card p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-all hover:border-primary/30 hover:shadow-card-hover cursor-pointer"
                                    >
                                        <div className={`hidden sm:block w-1 h-14 rounded-full ${statusDotColor[s.status]}`} />
                                        <div className="flex-1 min-w-0">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); window.location.href = `/diary/clients?clientId=${s.client.id}`; }}
                                                className="font-bold text-foreground text-lg mb-1 hover:text-primary transition-colors text-left block truncate"
                                            >
                                                {s.client.questionnaire?.data && (s.client.questionnaire.data as any).fullName
                                                    ? (s.client.questionnaire.data as any).fullName
                                                    : s.client.name}
                                            </button>
                                            <div className="text-body-secondary text-muted-foreground flex items-center gap-2">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span className="tabular-nums">{s.time} – {s.endTime}</span>
                                                <span>·</span>
                                                <span>{s.duration} мин</span>
                                            </div>
                                        </div>
                                        <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                                            <span className={`text-[12px] px-2.5 py-1 rounded-lg font-bold ${statusBadge[s.status]}`}>
                                                {statusLabels[s.status]}
                                            </span>
                                            <span className="text-[12px] px-2.5 py-1 bg-sage-50 text-muted-foreground rounded-lg font-semibold flex items-center gap-1.5">
                                                {s.format === 'online' ? <Video className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                                                {s.format === 'online' ? 'Онлайн' : 'Офлайн'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {viewMode === 'list' && (() => {
                        // Group sessions by date within the current month
                        const monthSessions = sessions.filter(s => {
                            const d = new Date(s.date);
                            return d.getMonth() === month && d.getFullYear() === year;
                        }).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

                        const grouped: { date: Date; sessions: Session[] }[] = [];
                        monthSessions.forEach(s => {
                            const d = new Date(s.date);
                            const last = grouped[grouped.length - 1];
                            if (last && isSameDay(last.date, d)) {
                                last.sessions.push(s);
                            } else {
                                grouped.push({ date: d, sessions: [s] });
                            }
                        });

                        if (grouped.length === 0) {
                            return (
                                <div className="bg-card rounded-2xl border border-border shadow-card p-12 text-center flex flex-col items-center justify-center">
                                    <List className="w-10 h-10 text-muted-foreground/30 mb-3" />
                                    <p className="text-foreground font-bold text-lg mb-1">Нет записей</p>
                                    <p className="text-muted-foreground text-body-secondary">В этом месяце пока нет сессий</p>
                                </div>
                            );
                        }

                        return (
                            <div className="space-y-4">
                                {grouped.map(group => (
                                    <div key={group.date.toISOString()} className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
                                        <div className="px-5 py-3 bg-sage-50 border-b border-border/40 flex items-center justify-between">
                                            <span className="text-[14px] font-bold text-foreground capitalize">
                                                {group.date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
                                            </span>
                                            <span className="text-small-meta text-muted-foreground font-semibold">
                                                {group.sessions.length} {group.sessions.length === 1 ? 'сессия' : group.sessions.length < 5 ? 'сессии' : 'сессий'}
                                            </span>
                                        </div>
                                        <div className="divide-y divide-border/30">
                                            {group.sessions.map(s => {
                                                const cn = s.client?.name || 'Клиент';
                                                return (
                                                    <button key={s.id} onClick={() => { setEditingSession(s); setShowNewSession(true); }}
                                                        className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-sage-50 transition-colors text-left"
                                                    >
                                                        <div className={`w-2 h-2 rounded-full shrink-0 ${statusDotColor[s.status]}`} />
                                                        <span className="text-[14px] font-bold text-foreground tabular-nums w-[70px] shrink-0">{s.time}</span>
                                                        <span className="text-body-primary text-foreground flex-1 truncate">{cn}</span>
                                                        <span className="text-small-meta text-muted-foreground shrink-0">{s.duration} мин</span>
                                                        <span className="text-small-meta text-muted-foreground shrink-0 hidden md:inline">
                                                            {s.format === 'online' ? 'Онлайн' : 'Офлайн'}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>

                {/* ── Day Detail Panel (Right Rail) ── */}
                <div className="space-y-4">
                    <div className="bg-card rounded-2xl border border-border shadow-card p-5 flex flex-col">
                        <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
                            <h3 className="font-bold text-foreground text-[17px] tracking-tight capitalize">
                                {selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                            </h3>
                            <span className="min-w-[28px] h-[28px] flex items-center justify-center rounded-lg bg-sage-100 text-[13px] font-bold text-forest-700 px-2">
                                {selectedSessions.filter(s => s.status !== 'cancelled').length}
                            </span>
                        </div>

                        {selectedSessions.length === 0 ? (
                            <div className="text-center py-10 flex-1 flex flex-col items-center justify-center">
                                <p className="text-body-secondary text-muted-foreground font-medium">Нет записей в этот день</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {selectedSessions.map(s => (
                                    <div key={s.id} className="p-4 bg-sage-50 rounded-xl border border-border/40 hover:border-border transition-colors">
                                        <div className="flex items-center gap-2.5 mb-3">
                                            <div className={`w-2.5 h-2.5 rounded-full ${statusDotColor[s.status]}`} />
                                            <span className="font-bold text-[15px] text-foreground flex items-center gap-1.5 tabular-nums">
                                                <Clock className="w-3.5 h-3.5 text-forest-600" />
                                                {s.time} – {s.endTime}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => window.location.href = `/diary/clients?clientId=${s.client.id}`}
                                            className="text-[15px] font-semibold mb-3 text-foreground hover:text-primary transition-colors flex items-center gap-2 text-left active:scale-[0.97]"
                                        >
                                            <User className="w-4 h-4 text-muted-foreground" />
                                            {s.client.name}
                                        </button>
                                        <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold mb-4">
                                            <span className="bg-card border border-border/50 text-muted-foreground px-2.5 py-1 rounded-lg">{s.type === 'individual' ? 'Индивид.' : s.type === 'couple' ? 'Парная' : 'Семейная'}</span>
                                            <span className="bg-card border border-border/50 text-muted-foreground px-2.5 py-1 rounded-lg flex items-center gap-1">
                                                {s.format === 'online' ? <Video className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                                                {s.format === 'online' ? 'Онлайн' : 'Офлайн'}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2 pt-3 border-t border-border/30">
                                            {s.status !== 'completed' && (
                                                <button onClick={() => handleStatusChange(s.id, 'completed')} className="text-[12px] px-3 py-2 font-bold bg-primary text-primary-foreground rounded-lg hover:bg-forest-700 transition-all active:scale-[0.97]">
                                                    Проведена ✓
                                                </button>
                                            )}
                                            <button onClick={() => { setEditingSession(s); setShowNewSession(true); }} className="text-[12px] px-3 py-2 font-bold bg-card border border-border text-foreground rounded-lg hover:bg-sage-50 transition-all active:scale-[0.97]">
                                                Открыть
                                            </button>
                                            {s.status !== 'completed' && s.status !== 'cancelled' && (
                                                <button onClick={() => setRescheduleTarget(s)} className="text-[12px] px-3 py-2 font-bold bg-orange-soft text-orange-500 rounded-lg hover:bg-orange-500/15 transition-all active:scale-[0.97] flex items-center gap-1">
                                                    <ArrowRightLeft className="w-3 h-3" /> Перенести
                                                </button>
                                            )}
                                            {s.status !== 'cancelled' && (
                                                confirmCancelId === s.id ? (
                                                    <div className="flex gap-1.5">
                                                        <button onClick={() => setConfirmCancelId(null)} className="text-[12px] px-3 py-2 font-bold bg-card border border-border rounded-lg">Нет</button>
                                                        <button onClick={() => { handleStatusChange(s.id, 'cancelled'); setConfirmCancelId(null); }} className="text-[12px] px-3 py-2 font-bold bg-red-500 text-white rounded-lg">Да, отменить</button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setConfirmCancelId(s.id)} className="text-[12px] px-3 py-2 font-bold bg-red-soft text-red-500 rounded-lg hover:bg-red-500/15 transition-all">✕</button>
                                                )
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Session Modal */}
            <SessionModal
                isOpen={showNewSession}
                onClose={() => { setShowNewSession(false); setEditingSession(null); }}
                onSave={handleSessionSave}
                initialDate={newSessionDefaults.date}
                editSession={editingSession}
                clients={clients}
            />

            {rescheduleTarget && (
                <RescheduleModal
                    isOpen={!!rescheduleTarget}
                    onClose={() => setRescheduleTarget(null)}
                    onSave={() => { fetchSessions(); setRescheduleTarget(null); }}
                    sessionId={rescheduleTarget.id}
                    currentDate={new Date(rescheduleTarget.date).toISOString().split('T')[0]}
                    currentTime={rescheduleTarget.time}
                    clientName={rescheduleTarget.client.name}
                    clientId={rescheduleTarget.client.id}
                />
            )}
        </div>
    );
}
