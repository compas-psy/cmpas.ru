'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Clock, User, Video, MapPin, ArrowRightLeft, Loader2, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { SessionModal } from './components/SessionModal';
import { RescheduleModal } from './components/RescheduleModal';

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
    const [viewMode, setViewMode] = useState<ViewMode>('day');
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
    const [mobileViewMode, setMobileViewMode] = useState<ViewMode>('day');

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

    const fetchSettings = useCallback(async () => {
        try {
            const { getSettings } = await import('./actions/settings');
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
                const { getAvailableTimesForReschedule } = await import('./actions/sessions');
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
                const { deleteSession } = await import('./actions/sessions');
                await deleteSession(id);
                toast.success('Запись удалена из календаря');
            } else {
                const { updateSession } = await import('./actions/sessions');
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
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Календарь</h1>
                    <p className="text-muted-foreground text-base mt-2">Управляйте своими записями</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto telegram-miniapp-scrollbar-hide pb-2 md:pb-0">
                    {settings?.psychologistId && (
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(`https://cmpas.ru/bot/book/${settings.psychologistId}`);
                                toast.success('Ссылка на запись скопирована');
                            }}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 font-semibold rounded-lg transition-all whitespace-nowrap"
                            title="Скопировать общую ссылку на форму записи"
                        >
                            <LinkIcon className="w-4 h-4" /> <span className="hidden sm:inline">Ссылка</span>
                        </button>
                    )}
                    <button
                        onClick={() => window.location.href = '/diary/availability'}
                        className="hidden md:flex items-center justify-center gap-2 px-4 py-2 bg-transparent text-foreground hover:bg-muted font-semibold rounded-lg transition-all whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" /> Окно
                    </button>
                    <button
                        onClick={() => { setShowNewSession(true); setNewSessionDefaults({ date: selectedDate }); }}
                        className="flex items-center justify-center gap-2 px-6 py-2 bg-accent text-accent-foreground rounded-lg shadow-sm hover:bg-accent/90 transition-all font-semibold active:scale-[0.98] whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" /> Запись
                    </button>
                </div>
            </div>

            {/* Widgets */}
            <div className="hidden md:grid grid-cols-3 gap-2 md:gap-4">
                <div className="bg-card py-2 md:py-3 px-2 md:px-4 rounded-xl border border-border bg-white flex flex-col items-center justify-center md:flex-row md:items-start md:justify-start gap-1 md:gap-4 transition-all hover:shadow-sm text-center md:text-left">
                    <div className="md:mt-1 text-muted-foreground hidden md:block">
                        <CalendarIcon className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col items-center md:items-start">
                        <div className="text-lg md:text-2xl font-bold tracking-tight text-foreground leading-none mb-0.5 md:mb-1">{sessions.filter(s => {
                            const d = new Date(s.date);
                            const now = new Date();
                            const startOfWeek = new Date(now);
                            startOfWeek.setDate(now.getDate() - (now.getDay() + 6) % 7);
                            const endOfWeek = new Date(startOfWeek);
                            endOfWeek.setDate(startOfWeek.getDate() + 6);
                            return d >= startOfWeek && d <= endOfWeek;
                        }).length}</div>
                        <div className="text-[10px] md:text-xs font-medium text-muted-foreground leading-none md:leading-tight">Сессий<br className="hidden md:block" /> в нед.</div>
                    </div>
                </div>
                <div className="bg-card py-2 md:py-3 px-2 md:px-4 rounded-xl border border-border bg-white flex flex-col items-center justify-center md:flex-row md:items-start md:justify-start gap-1 md:gap-4 transition-all hover:shadow-sm text-center md:text-left">
                    <div className="md:mt-1 text-accent hidden md:block">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col items-center md:items-start">
                        <div className="text-lg md:text-2xl font-bold tracking-tight text-foreground leading-none mb-0.5 md:mb-1">{sessions.filter(s => s.status === 'pending').length}</div>
                        <div className="text-[10px] md:text-xs font-medium text-muted-foreground leading-none md:leading-tight">Окон<br className="hidden md:block" /> свободно</div>
                    </div>
                </div>
                <div className="bg-card py-2 md:py-3 px-2 md:px-4 rounded-xl border border-border bg-white flex flex-col items-center justify-center md:flex-row md:items-start md:justify-start gap-1 md:gap-4 transition-all hover:shadow-sm text-center md:text-left">
                    <div className="md:mt-1 text-primary hidden md:block">
                        <User className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col items-center md:items-start">
                        <div className="text-lg md:text-2xl font-bold tracking-tight text-foreground leading-none mb-0.5 md:mb-1">{clients.length}</div>
                        <div className="text-[10px] md:text-xs font-medium text-muted-foreground leading-none md:leading-tight">Всего<br className="hidden md:block" /> клиентов</div>
                    </div>
                </div>
            </div>

            {/* ============ MOBILE TIMELINE ============ */}
            <div className="md:hidden">
                {/* Mobile View Toggle */}
                <div className="flex gap-1 bg-muted/50 p-1 rounded-xl mb-3">
                    {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
                        <button
                            key={mode}
                            onClick={() => {
                                setMobileViewMode(mode);
                                if (mode === 'day') setCurrentDate(selectedDate);
                            }}
                            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mobileViewMode === mode ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                        >
                            {mode === 'month' ? 'Месяц' : mode === 'week' ? 'Неделя' : 'День'}
                        </button>
                    ))}
                </div>

                {/* === MOBILE DAY VIEW === */}
                {mobileViewMode === 'day' && (
                    <>
                        {/* Date navigation */}
                        <div className="flex items-center justify-between bg-card rounded-2xl border border-border p-3 mb-4 shadow-sm">
                            <button onClick={() => {
                                const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d); setCurrentDate(d);
                            }} className="p-2.5 hover:bg-muted rounded-xl transition-colors active:scale-95">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div className="text-center">
                                <div className="text-lg font-bold capitalize">
                                    {selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                                </div>
                                <div className="text-xs text-muted-foreground font-medium">
                                    {selectedDate.toLocaleDateString('ru-RU', { weekday: 'long' })}
                                    {isSameDay(selectedDate, new Date()) && <span className="text-primary ml-1">· Сегодня</span>}
                                </div>
                            </div>
                            <button onClick={() => {
                                const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d); setCurrentDate(d);
                            }} className="p-2.5 hover:bg-muted rounded-xl transition-colors active:scale-95">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Stats bar */}
                        <div className="flex gap-3 mb-4">
                            <div className="flex-1 bg-card rounded-xl border border-border px-3 py-2 text-center">
                                <div className="text-lg font-bold text-foreground">{selectedSessions.length}</div>
                                <div className="text-[10px] font-medium text-muted-foreground">Сессий</div>
                            </div>
                            <div className="flex-1 bg-card rounded-xl border border-border px-3 py-2 text-center">
                                <div className="text-lg font-bold text-primary">{mobileFreeTimes.length}</div>
                                <div className="text-[10px] font-medium text-muted-foreground">Свободных</div>
                            </div>
                        </div>

                        {/* Timeline */}
                        <div className="space-y-3">
                            {(() => {
                                // Merge sessions and free times into a sorted timeline
                                type TimelineItem = { type: 'session'; data: Session; time: string } | { type: 'free'; data: typeof mobileFreeTimes[0]; time: string };
                                const items: TimelineItem[] = [];

                                selectedSessions.forEach(s => items.push({ type: 'session', data: s, time: s.time }));
                                mobileFreeTimes.forEach(t => items.push({ type: 'free', data: t, time: t.time }));
                                items.sort((a, b) => a.time.localeCompare(b.time));

                                if (items.length === 0 && !loadingFreeTimes) {
                                    return (
                                        <div className="bg-card rounded-2xl border border-border p-10 text-center shadow-sm">
                                            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                                <CalendarIcon className="w-8 h-8 text-muted-foreground/50" />
                                            </div>
                                            <p className="font-bold text-foreground mb-1">Нет записей</p>
                                            <p className="text-sm text-muted-foreground">{formatDate(selectedDate)}</p>
                                        </div>
                                    );
                                }

                                if (loadingFreeTimes && selectedSessions.length === 0) {
                                    return (
                                        <div className="flex items-center justify-center py-12">
                                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                        </div>
                                    );
                                }

                                return items.map((item, idx) => {
                                    if (item.type === 'session') {
                                        const s = item.data;
                                        const client = clients.find(c => c.id === s.clientId);
                                        const clientName = s.client?.questionnaire?.data && (s.client.questionnaire.data as any).fullName
                                            ? (s.client.questionnaire.data as any).fullName
                                            : (client?.name || s.client?.name || 'Клиент');
                                        return (
                                            <div key={`s-${s.id}`} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                                                <div className="flex items-stretch">
                                                    <div className={`w-1.5 ${statusColors[s.status] || 'bg-border'} shrink-0`} />
                                                    <div className="flex-1 p-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <Clock className="w-4 h-4 text-primary" />
                                                                <span className="font-bold text-foreground">{s.time}</span>
                                                                <span className="text-muted-foreground text-sm">– {s.endTime || ''}</span>
                                                            </div>
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${s.status === 'confirmed' ? 'bg-primary/10 text-primary' : s.status === 'completed' ? 'bg-muted text-muted-foreground' : s.status === 'pending' ? 'bg-accent/10 text-accent' : 'bg-destructive/10 text-destructive'}`}>
                                                                {statusLabels[s.status]}
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() => window.location.href = `/diary/clients?clientId=${s.client?.id || s.clientId}`}
                                                            className="font-bold text-foreground text-base mb-1 hover:text-primary transition-colors text-left active:scale-95 block"
                                                        >
                                                            {clientName}
                                                        </button>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                                            {s.format === 'online'
                                                                ? <><Video className="w-3.5 h-3.5" /> Онлайн</>
                                                                : <><MapPin className="w-3.5 h-3.5" /> Офлайн</>
                                                            }
                                                            <span>·</span>
                                                            <span>{s.duration} мин</span>
                                                            {s.format === 'online' && settings?.onlineSessionLink && (
                                                                <a href={settings.onlineSessionLink} target="_blank" rel="noopener noreferrer" className="text-primary font-bold hover:underline ml-1">Ссылка</a>
                                                            )}
                                                        </div>
                                                        {/* Quick actions */}
                                                        <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                                                            {s.status !== 'completed' && (
                                                                <button onClick={() => handleStatusChange(s.id, 'completed')} className="text-xs px-3 py-2 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-95 transition-all">
                                                                    Проведена ✓
                                                                </button>
                                                            )}
                                                            {s.status !== 'completed' && s.status !== 'cancelled' && (
                                                                <button onClick={() => setRescheduleTarget(s)} className="text-xs px-3 py-2 rounded-xl bg-accent/10 text-accent font-semibold active:scale-95 transition-all flex items-center gap-1">
                                                                    <ArrowRightLeft className="w-3 h-3" /> Перенести
                                                                </button>
                                                            )}
                                                            {s.status !== 'cancelled' && (
                                                                <button onClick={() => handleStatusChange(s.id, 'cancelled')} className="text-xs px-3 py-2 rounded-xl bg-destructive/10 text-destructive font-semibold active:scale-95 transition-all ml-auto">
                                                                    ✕
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    } else {
                                        const t = item.data;
                                        return (
                                            <button
                                                key={`f-${t.time}-${idx}`}
                                                className="w-full bg-card/50 rounded-2xl border border-dashed border-border/80 p-4 flex items-center gap-3 hover:bg-primary/5 hover:border-primary/30 transition-all active:scale-[0.98] group"
                                                onClick={() => { setShowNewSession(true); setNewSessionDefaults({ date: selectedDate }); }}
                                            >
                                                <div className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                                    <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-sm font-bold text-muted-foreground group-hover:text-foreground transition-colors">{t.time}</div>
                                                    <div className="text-[10px] text-muted-foreground/70">Свободное окно</div>
                                                </div>
                                            </button>
                                        );
                                    }
                                });
                            })()}
                        </div>
                    </>
                )}

                {/* === MOBILE WEEK VIEW === */}
                {mobileViewMode === 'week' && (() => {
                    const weekDaysList = getWeekDays();
                    return (
                        <>
                            {/* Week navigation */}
                            <div className="flex items-center justify-between bg-card rounded-2xl border border-border p-3 mb-3 shadow-sm">
                                <button onClick={() => {
                                    const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d);
                                }} className="p-2 hover:bg-muted rounded-xl transition-colors active:scale-95">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="text-sm font-bold text-foreground capitalize">
                                    {weekDaysList[0].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} – {weekDaysList[6].toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                                </div>
                                <button onClick={() => {
                                    const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d);
                                }} className="p-2 hover:bg-muted rounded-xl transition-colors active:scale-95">
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                            {/* Week days strip */}
                            <div className="grid grid-cols-7 gap-1.5 mb-4">
                                {weekDaysList.map((date, i) => {
                                    const daySessions = getSessionsForDay(date);
                                    const isToday = isSameDay(date, new Date());
                                    const isSelected = isSameDay(date, selectedDate);
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => { setSelectedDate(date); setMobileViewMode('day'); setCurrentDate(date); }}
                                            className={`flex flex-col items-center py-2.5 rounded-xl transition-all active:scale-95 ${isSelected ? 'bg-primary/10 border border-primary/30' : 'bg-card border border-border'}`}
                                        >
                                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                                                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][i]}
                                            </span>
                                            <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-lg mt-0.5 ${isToday ? 'bg-primary text-primary-foreground' : isSelected ? 'text-primary' : 'text-foreground'}`}>
                                                {date.getDate()}
                                            </span>
                                            {daySessions.length > 0 && (
                                                <div className="flex gap-0.5 mt-1">
                                                    {daySessions.slice(0, 3).map((s, si) => (
                                                        <div key={si} className={`w-1.5 h-1.5 rounded-full ${statusColors[s.status] || 'bg-border'}`} />
                                                    ))}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            {/* Quick list for the week */}
                            <div className="space-y-2">
                                {weekDaysList.map((date, i) => {
                                    const daySessions = getSessionsForDay(date);
                                    if (daySessions.length === 0) return null;
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => { setSelectedDate(date); setMobileViewMode('day'); setCurrentDate(date); }}
                                            className="w-full bg-card rounded-xl border border-border p-3 flex items-center gap-3 shadow-sm hover:border-primary/30 transition-colors active:scale-[0.98]"
                                        >
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${isSameDay(date, new Date()) ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-foreground'}`}>
                                                {date.getDate()}
                                            </div>
                                            <div className="flex-1 text-left">
                                                <div className="text-sm font-bold text-foreground">{date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                                                <div className="text-xs text-muted-foreground font-medium">{daySessions.length} {daySessions.length === 1 ? 'сессия' : daySessions.length < 5 ? 'сессии' : 'сессий'}</div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    );
                })()}

                {/* === MOBILE MONTH VIEW === */}
                {mobileViewMode === 'month' && (
                    <>
                        {/* Month navigation */}
                        <div className="flex items-center justify-between bg-card rounded-2xl border border-border p-3 mb-3 shadow-sm">
                            <button onClick={() => {
                                const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d);
                            }} className="p-2 hover:bg-muted rounded-xl transition-colors active:scale-95">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div className="text-sm font-bold text-foreground capitalize">
                                {currentDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                            </div>
                            <button onClick={() => {
                                const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d);
                            }} className="p-2 hover:bg-muted rounded-xl transition-colors active:scale-95">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                        {/* Mini calendar grid */}
                        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                            <div className="grid grid-cols-7">
                                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
                                    <div key={d} className="p-2 text-center text-[10px] font-bold text-muted-foreground border-b border-border/50">{d}</div>
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
                                            onClick={() => { setSelectedDate(day); setMobileViewMode('day'); setCurrentDate(day); }}
                                            className={`p-1.5 text-center relative min-h-[44px] transition-colors active:scale-95 ${!isCurrentMonth ? 'opacity-30' : ''} ${isSelected ? 'bg-primary/10' : ''}`}
                                        >
                                            <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-lg mx-auto ${isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
                                                {day.getDate()}
                                            </span>
                                            {daySessions.length > 0 && (
                                                <div className="flex gap-0.5 justify-center mt-0.5">
                                                    {daySessions.slice(0, 3).map((s, si) => (
                                                        <div key={si} className={`w-1 h-1 rounded-full ${statusColors[s.status] || 'bg-border'}`} />
                                                    ))}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                {/* FAB — New Session */}
                <button
                    onClick={() => { setShowNewSession(true); setNewSessionDefaults({ date: selectedDate }); }}
                    className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all"
                >
                    <Plus className="w-6 h-6" />
                </button>
            </div>

            {/* ============ DESKTOP LAYOUT ============ */}
            <div className="hidden md:flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-2 rounded-2xl border border-border shadow-sm">
                {/* View Mode Tabs */}
                <div className="flex gap-1 bg-muted/50 p-1.5 rounded-xl w-full md:w-auto">
                    {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
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
                                                                    onClick={() => setEditingSession(session)}
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
                                                                        onClick={() => setEditingSession(session)}
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
                                                <button onClick={() => handleStatusChange(s.id, 'cancelled')} className="text-xs px-3 py-2 min-h-[36px] font-semibold bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition-all active:scale-[0.98]">
                                                    ✕
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
