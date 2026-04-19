'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Clock, User, Video, MapPin, ArrowRightLeft, Loader2, Link as LinkIcon, AlertTriangle, FileText, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { SessionModal } from '../components/SessionModal';
import { RescheduleModal } from '../components/RescheduleModal';
import { WelcomeStrip } from '@/components/psidairy/WelcomeStrip';

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
    const [mobileViewMode, setMobileViewMode] = useState<ViewMode>('month');
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

    // Fetch free times for mobile timeline
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

    const handleSessionSave = () => {
        fetchSessions();
        setShowNewSession(false);
    };

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
            {/* Welcome strip for new psychologists */}
            

            
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 bg-card border border-border p-1 rounded-2xl shadow-sm">
                    {['month', 'week', 'day'].map((m) => (
                        <button key={m} onClick={() => setViewMode(m as ViewMode)} className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all ${viewMode === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                            {m === 'month' ? 'Месяц' : m === 'week' ? 'Неделя' : 'День'}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => navigateDate('prev')} className="p-2 hover:bg-muted rounded-xl transition-colors"><ChevronLeft className="w-5 h-5"/></button>
                    <span className="text-sm font-bold text-foreground min-w-[120px] text-center capitalize">{getHeaderText()}</span>
                    <button onClick={() => navigateDate('next')} className="p-2 hover:bg-muted rounded-xl transition-colors"><ChevronRight className="w-5 h-5"/></button>
                </div>
            </div>

            
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 bg-card border border-border p-1 rounded-2xl shadow-sm">
                    {['month', 'week', 'day'].map((m) => (
                        <button key={m} onClick={() => setViewMode(m as ViewMode)} className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all ${viewMode === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                            {m === 'month' ? 'Месяц' : m === 'week' ? 'Неделя' : 'День'}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => navigateDate('prev')} className="p-2 hover:bg-muted rounded-xl transition-colors"><ChevronLeft className="w-5 h-5"/></button>
                    <span className="text-sm font-bold text-foreground min-w-[120px] text-center capitalize">{getHeaderText()}</span>
                    <button onClick={() => navigateDate('next')} className="p-2 hover:bg-muted rounded-xl transition-colors"><ChevronRight className="w-5 h-5"/></button>
                </div>
            </div>

            <div className="hidden md:grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                                            className={`p-1 md:p-2 border-r border-b border-border/50 last:border-r-0 hover:bg-muted/50 transition-colors text-center relative min-h-[50px] md:min-h-[80px] md:aspect-square ${!isCurrentMonth ? 'bg-muted/10 opacity-50' : 'bg-background'} ${isToday ? 'bg-primary/5' : ''} ${isSelected ? 'bg-primary/5 ring-2 ring-primary ring-inset overflow-hidden' : ''}`}
                                        >
                                            <div className="flex flex-col items-center gap-1 md:gap-2 h-full">
                                                <span className={`text-sm md:text-sm font-bold w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-xl transition-colors ${isToday ? 'bg-primary text-primary-foreground shadow-sm' : isSelected ? 'bg-primary/20 text-primary' : isCurrentMonth ? 'text-foreground hover:bg-muted' : 'text-muted-foreground hover:bg-muted'}`}>
                                                    {day.getDate()}
                                                </span>
                                                {daySessions.length > 0 && (
                                                    <div className="flex gap-1 md:gap-1.5 justify-center flex-wrap px-0.5 w-full max-w-[30px] md:max-w-none">
                                                        {daySessions.slice(0, 4).map(s => (
                                                            <div key={s.id} className={`w-1.5 h-1.5 md:w-2.5 md:h-2.5 rounded-full shadow-sm ${statusColors[s.status] || 'bg-border'}`} />
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

                    {viewMode === 'week' && (() => {
                        const weekDaysList = getWeekDays();
                        return (
                            <div className="bg-background rounded-2xl border border-border shadow-sm overflow-hidden h-full flex flex-col">
                                {/* Week View Header - Desktop only */}
                                <div className="hidden md:grid grid-cols-7 border-b border-border bg-muted/30">
                                    {weekDaysList.map((date, i) => (
                                        <div key={i} className={`p-4 text-center border-r border-border/50 last:border-r-0 ${new Date().toDateString() === date.toDateString() ? 'bg-primary/5' : ''}`}>
                                            <div className="text-sm font-semibold text-muted-foreground mb-1">{['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][date.getDay()]}</div>
                                            <div className={`text-xl font-bold w-10 h-10 mx-auto flex items-center justify-center rounded-xl ${new Date().toDateString() === date.toDateString() ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground'}`}>
                                                {date.getDate()}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Week View Body */}
                                <div className="flex-1 overflow-auto">
                                    {/* Desktop Grid */}
                                    <div className="hidden md:grid grid-cols-7 min-h-full" style={{ tableLayout: 'fixed' }}>
                                        {weekDaysList.map((date, i) => {
                                            const daySessions = sessions.filter(s => new Date(s.date).toDateString() === date.toDateString());
                                            const isToday = new Date().toDateString() === date.toDateString();
                                            return (
                                                <div key={i} className={`p-2 border-r border-border/50 last:border-r-0 min-h-[200px] ${isToday ? 'bg-primary/[0.02]' : ''}`}>
                                                    <div className="space-y-2 mt-2">
                                                        {daySessions.sort((a, b) => a.time.localeCompare(b.time)).map(session => {
                                                            const client = clients.find(c => c.id === session.clientId);
                                                            return (
                                                                <div key={session.id}
                                                                    onClick={() => setSelectedDate(new Date(session.date))}
                                                                    className="p-2.5 bg-background border border-border rounded-xl shadow-sm hover:shadow-md transition-all group relative cursor-pointer hover:border-primary/30 flex flex-col justify-between overflow-hidden"
                                                                >
                                                                    <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${statusColors[session.status] || 'bg-border'}`} />
                                                                    <div>
                                                                        <div className="text-xs font-bold text-foreground/90 mb-1 pl-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-muted-foreground" /> {session.time}</div>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); window.location.href = `/diary/clients?clientId=${client?.id}`; }}
                                                                            className="text-sm font-semibold w-full truncate pl-2 hover:text-primary transition-colors text-left active:scale-95 z-10 relative block"
                                                                        >
                                                                            {client?.name || 'Нет клиента'}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Mobile Vertical List */}
                                    <div className="md:hidden flex flex-col divide-y divide-border/50">
                                        {weekDaysList.map((date, i) => {
                                            const daySessions = sessions.filter(s => new Date(s.date).toDateString() === date.toDateString());
                                            const isToday = new Date().toDateString() === date.toDateString();
                                            return (
                                                <div key={i} className={`py-4 px-3 ${isToday ? 'bg-primary/[0.02]' : ''}`}>
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="flex flex-col items-center justify-center w-12">
                                                            <div className="text-xs font-semibold text-muted-foreground uppercase">{['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][date.getDay()]}</div>
                                                            <div className={`text-lg font-bold w-10 h-10 flex items-center justify-center rounded-xl ${isToday ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground'}`}>
                                                                {date.getDate()}
                                                            </div>
                                                        </div>
                                                        <div className="h-px bg-border/50 flex-1"></div>
                                                    </div>
                                                    <div className="space-y-2 pl-14">
                                                        {daySessions.length === 0 ? (
                                                            <div className="text-sm text-muted-foreground italic py-2">Нет записей</div>
                                                        ) : (
                                                            daySessions.sort((a, b) => a.time.localeCompare(b.time)).map(session => {
                                                                const client = clients.find(c => c.id === session.clientId);
                                                                return (
                                                                    <div key={session.id}
                                                                        onClick={() => { const d = new Date(session.date); setSelectedDate(d); setCurrentDate(d); setMobileViewMode('day'); }}
                                                                        className="p-3 bg-background border border-border rounded-xl shadow-sm hover:shadow-md transition-all relative cursor-pointer active:scale-[0.98]">
                                                                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${statusColors[session.status] || 'bg-border'}`} />
                                                                        <div className="flex justify-between items-start pl-2">
                                                                            <div className="flex-1 min-w-0 pr-2">
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); window.location.href = `/diary/clients?clientId=${client?.id}`; }}
                                                                                    className="text-sm font-bold text-foreground mb-0.5 hover:text-primary transition-colors text-left w-full truncate active:scale-95"
                                                                                >
                                                                                    {client?.name || 'Нет клиента'}
                                                                                </button>
                                                                                <div className="text-xs font-medium text-foreground/80 flex items-center gap-1.5 mt-1">
                                                                                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                                                                    {session.time} • {session.duration} мин
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex flex-col gap-2 items-end shrink-0">
                                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${statusColors[session.status]?.replace('bg-', 'text-').replace('border-', 'text-') || 'text-muted-foreground'} bg-muted/30`}>
                                                                                    {session.status === 'confirmed' ? 'Подтверждена' : 'Ожидание'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

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
                                    <div key={s.id} onClick={() => { setEditingSession(s); setShowNewSession(true); }} className="bg-card rounded-3xl border border-border shadow-sm p-6 flex flex-col sm:flex-row sm:items-center gap-5 transition-all hover:border-primary/30 cursor-pointer">
                                        <div className={`hidden sm:block w-1.5 h-16 rounded-full ${statusColors[s.status]}`} />
                                        <div className="flex-1 min-w-0">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); window.location.href = `/diary/clients?clientId=${s.client.id}`; }}
                                                className="font-bold text-foreground text-xl mb-1.5 hover:text-primary transition-colors text-left block"
                                            >
                                                {s.client.questionnaire?.data && (s.client.questionnaire.data as any).fullName
                                                    ? (s.client.questionnaire.data as any).fullName
                                                    : s.client.name}
                                            </button>
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
                                            {s.format === 'online' && settings?.onlineSessionLink && (
                                                <a
                                                    href={settings.onlineSessionLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[10px] text-primary hover:underline flex items-center gap-1 font-bold bg-primary/5 px-2 py-1 rounded-lg"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Video className="w-3 h-3" /> Ссылка
                                                </a>
                                            )}
                                            {s.format === 'offline' && settings?.officeAddress && (
                                                <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-bold bg-muted px-2 py-1 rounded-lg">
                                                    <MapPin className="w-3 h-3" /> {settings.officeAddress}
                                                </span>
                                            )}
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
                                            <div className="ml-auto flex gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); setEditingSession(s); setShowNewSession(true); }} className="p-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors">
                                                    Редактировать
                                                </button>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => window.location.href = `/diary/clients?clientId=${s.client.id}`}
                                            className="text-base font-bold mb-2 text-foreground hover:text-primary transition-colors flex items-center gap-2 text-left w-fit active:scale-95"
                                        >
                                            <User className="w-5 h-5 text-muted-foreground" />
                                            {s.client.name}
                                        </button>
                                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold mt-4 mb-5">
                                            <span className="bg-secondary text-secondary-foreground px-3 py-1.5 rounded-xl">{s.type === 'individual' ? 'Индивидуальная' : s.type === 'couple' ? 'Парная' : 'Семейная'}</span>
                                            <span className="bg-secondary text-secondary-foreground px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                                                {s.format === 'online' ? <Video className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                                                {s.format === 'online' ? 'Онлайн' : 'Офлайн'}
                                            </span>
                                            {s.format === 'online' && settings?.onlineSessionLink && (
                                                <a
                                                    href={settings.onlineSessionLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[10px] text-primary hover:underline flex items-center gap-1 font-bold bg-primary/5 px-2 py-1 rounded-lg"
                                                >
                                                    <Video className="w-3 h-3" /> Ссылка на встречу
                                                </a>
                                            )}
                                            {s.format === 'offline' && settings?.officeAddress && (
                                                <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-bold bg-muted px-2 py-1 rounded-lg">
                                                    <MapPin className="w-3 h-3" /> {settings.officeAddress}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/50">
                                            {s.status !== 'completed' && (
                                                <button onClick={() => handleStatusChange(s.id, 'completed')} className="text-xs px-3 py-2 min-h-[36px] font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98]">
                                                    Проведена ✓
                                                </button>
                                            )}
                                            {s.status !== 'completed' && s.status !== 'cancelled' && (
                                                <button onClick={() => setRescheduleTarget(s)} className="text-xs px-3 py-2 min-h-[36px] font-semibold bg-accent/10 text-accent rounded-xl hover:bg-accent/20 transition-all active:scale-[0.98] flex items-center gap-1">
                                                    <ArrowRightLeft className="w-3 h-3" /> Перенести
                                                </button>
                                            )}
                                            {s.status !== 'cancelled' && (
                                                confirmCancelId === s.id ? (
                                                    <>
                                                        <button onClick={() => setConfirmCancelId(null)} className="text-xs px-3 py-2 min-h-[36px] font-semibold bg-secondary text-secondary-foreground rounded-xl transition-all active:scale-[0.98]">
                                                            Нет
                                                        </button>
                                                        <button onClick={() => { handleStatusChange(s.id, 'cancelled'); setConfirmCancelId(null); }} className="text-xs px-3 py-2 min-h-[36px] font-semibold bg-destructive text-destructive-foreground rounded-xl transition-all active:scale-[0.98]">
                                                            Да, отменить
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button onClick={() => setConfirmCancelId(s.id)} className="text-xs px-3 py-2 min-h-[36px] font-semibold bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition-all active:scale-[0.98]">
                                                        ✕
                                                    </button>
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

            {
                rescheduleTarget && (
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
                )
            }
        </div >);
}
