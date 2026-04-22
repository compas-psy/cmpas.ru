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

// Session type color coding (mockup: green=individual, orange=couple, blue=family)
const typeColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    individual: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    couple: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
    family: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
    group: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
};
const defaultTypeColor = { bg: 'bg-sage-50', border: 'border-border/40', text: 'text-foreground', dot: 'bg-sage-400' };

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
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);

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
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight text-foreground leading-[1.1]">Календарь</h1>
                    </div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                        {/* View switcher */}
                        <div className="flex items-center bg-sage-50 border border-border p-1 rounded-xl gap-0.5">
                            {(['day', 'week', 'month', 'list'] as ViewMode[]).map((m) => (
                                <button key={m} onClick={() => setViewMode(m)}
                                    className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all ${viewMode === m ? 'bg-card shadow-card text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    {m === 'month' ? 'Месяц' : m === 'week' ? 'Неделя' : m === 'day' ? 'День' : 'Список'}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => window.location.href = '/diary/settings'}
                            className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-muted-foreground border border-border rounded-xl hover:bg-sage-50 transition-colors"
                        >
                            Настройки
                        </button>
                        <button
                            onClick={() => { setShowNewSession(true); setNewSessionDefaults({ date: selectedDate }); }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl shadow-card hover:bg-forest-700 transition-all font-semibold active:scale-[0.97] text-sm"
                        >
                            <Plus className="w-4 h-4" /> Запись
                        </button>
                    </div>
                </div>
                {/* Date navigation row */}
                <div className="flex items-center gap-3">
                    <button onClick={() => navigateDate('prev')} className="p-2 hover:bg-sage-100 rounded-xl transition-colors">
                        <ChevronLeft className="w-4.5 h-4.5 text-muted-foreground" />
                    </button>
                    <span className="text-[15px] font-bold text-foreground capitalize min-w-[160px]">{getHeaderText()}</span>
                    <button onClick={() => navigateDate('next')} className="p-2 hover:bg-sage-100 rounded-xl transition-colors">
                        <ChevronRight className="w-4.5 h-4.5 text-muted-foreground" />
                    </button>
                    <button
                        onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }}
                        className="px-3 py-1.5 text-[13px] font-semibold text-forest-700 bg-sage-100 hover:bg-sage-150 rounded-lg transition-colors"
                    >
                        Сегодня
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
                                {['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'].map(d => (
                                    <div key={d} className="p-2 md:p-3 text-center text-[11px] font-bold text-muted-foreground border-r border-b border-border/40 last:border-r-0 uppercase tracking-wider">{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7">
                                {calendarDays.map((day, i) => {
                                    const daySessions = getSessionsForDay(day).sort((a, b) => a.time.localeCompare(b.time));
                                    const isToday = isSameDay(day, new Date());
                                    const isCurrentMonth = day.getMonth() === month;
                                    const isSelected = isSameDay(day, selectedDate);
                                    const maxShow = 3;
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => { setSelectedDate(day); setSelectedSession(null); }}
                                            className={`p-1.5 md:p-2 border-r border-b border-border/30 last:border-r-0 hover:bg-sage-50/50 transition-colors text-left relative min-h-[52px] md:min-h-[100px] ${!isCurrentMonth ? 'opacity-30' : ''} ${isToday ? 'bg-sage-50/80' : ''} ${isSelected ? 'bg-primary/5 ring-2 ring-primary ring-inset' : ''}`}
                                        >
                                            {/* Day number */}
                                            <span className={`text-[13px] font-bold w-7 h-7 flex items-center justify-center rounded-lg mb-1 ${isToday ? 'bg-primary text-primary-foreground' : isSelected ? 'bg-primary/15 text-primary' : 'text-foreground'}`}>
                                                {day.getDate()}
                                            </span>
                                            {/* Session labels */}
                                            {daySessions.length > 0 && (
                                                <div className="space-y-0.5 hidden md:block">
                                                    {daySessions.slice(0, maxShow).map(s => {
                                                        const tc = typeColors[s.type] || defaultTypeColor;
                                                        const cn = s.client?.name || 'Клиент';
                                                        return (
                                                            <div key={s.id} className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-semibold truncate ${tc.bg} ${tc.text}`}>
                                                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${tc.dot}`} />
                                                                <span className="tabular-nums shrink-0">{s.time}</span>
                                                                <span className="truncate">{cn}</span>
                                                            </div>
                                                        );
                                                    })}
                                                    {daySessions.length > maxShow && (
                                                        <div className="text-[10px] font-bold text-muted-foreground pl-1">+{daySessions.length - maxShow} ещё</div>
                                                    )}
                                                </div>
                                            )}
                                            {/* Mobile: just dots */}
                                            {daySessions.length > 0 && (
                                                <div className="flex gap-0.5 mt-0.5 md:hidden">
                                                    {daySessions.slice(0, 4).map(s => (
                                                        <div key={s.id} className={`w-1.5 h-1.5 rounded-full ${(typeColors[s.type] || defaultTypeColor).dot}`} />
                                                    ))}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {viewMode === 'week' && (() => {
                        const weekDaysList = getWeekDays();
                        const hourStart = 8, hourEnd = 21;
                        const hours = Array.from({ length: hourEnd - hourStart }, (_, i) => i + hourStart);
                        const rowH = 56; // px per hour
                        const now = new Date();

                        return (
                            <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
                                {/* Week Header: time col + 7 day cols */}
                                <div className="grid grid-cols-[50px_repeat(7,1fr)] border-b border-border bg-sage-50">
                                    <div className="border-r border-border/30" />
                                    {weekDaysList.map((date, i) => {
                                        const isToday = isSameDay(date, new Date());
                                        return (
                                            <div key={i} className={`py-2.5 px-1 text-center border-r border-border/30 last:border-r-0 ${isToday ? 'bg-primary/5' : ''}`}>
                                                <div className="text-[11px] font-bold text-muted-foreground uppercase">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][i]}</div>
                                                <div className={`text-[16px] font-bold w-8 h-8 mx-auto flex items-center justify-center rounded-lg mt-0.5 ${isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
                                                    {date.getDate()}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Time grid body */}
                                <div className="grid grid-cols-[50px_repeat(7,1fr)] relative" style={{ height: `${hours.length * rowH}px` }}>
                                    {/* Hour labels */}
                                    <div className="border-r border-border/30">
                                        {hours.map(h => (
                                            <div key={h} className="border-b border-border/20 text-[11px] font-medium text-muted-foreground/50 text-right pr-2 pt-0.5 tabular-nums" style={{ height: `${rowH}px` }}>
                                                {String(h).padStart(2, '0')}:00
                                            </div>
                                        ))}
                                    </div>

                                    {/* Day columns */}
                                    {weekDaysList.map((date, di) => {
                                        const daySessions = sessions.filter(s => isSameDay(new Date(s.date), date) && s.status !== 'cancelled').sort((a, b) => a.time.localeCompare(b.time));
                                        const isToday = isSameDay(date, new Date());
                                        return (
                                            <div key={di} className={`relative border-r border-border/20 last:border-r-0 ${isToday ? 'bg-primary/[0.02]' : ''}`}>
                                                {/* Hour grid lines */}
                                                {hours.map(h => (
                                                    <div key={h} className="border-b border-border/15" style={{ height: `${rowH}px` }} />
                                                ))}

                                                {/* Session blocks */}
                                                {daySessions.map(s => {
                                                    const [sh, sm] = s.time.split(':').map(Number);
                                                    const topMin = (sh - hourStart) * 60 + sm;
                                                    const top = (topMin / 60) * rowH;
                                                    const dur = s.duration || 60;
                                                    const height = Math.max((dur / 60) * rowH - 2, 24);
                                                    const tc = typeColors[s.type] || defaultTypeColor;
                                                    const cn = s.client?.name || clients.find(c => c.id === s.clientId)?.name || 'Клиент';

                                                    return (
                                                        <button
                                                            key={s.id}
                                                            onClick={() => { setSelectedDate(date); setSelectedSession(s); }}
                                                            className={`absolute left-0.5 right-0.5 ${tc.bg} border ${tc.border} rounded-md px-1.5 py-1 text-left overflow-hidden transition-all hover:shadow-md hover:z-10 active:scale-[0.98]`}
                                                            style={{ top: `${top}px`, height: `${height}px` }}
                                                        >
                                                            <div className={`text-[10px] font-bold tabular-nums ${tc.text}`}>
                                                                {s.time} – {s.endTime}
                                                            </div>
                                                            <div className={`text-[11px] font-semibold truncate ${tc.text}`}>{cn}</div>
                                                            {height > 40 && (
                                                                <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                    {s.format === 'online' ? '💻' : '📍'} {s.format === 'online' ? 'Онлайн' : 'Офлайн'}
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })}

                                                {/* Current time marker */}
                                                {isToday && (() => {
                                                    const ch = now.getHours(), cm = now.getMinutes();
                                                    if (ch >= hourStart && ch < hourEnd) {
                                                        const markerTop = ((ch - hourStart) * 60 + cm) / 60 * rowH;
                                                        return (
                                                            <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${markerTop}px` }}>
                                                                <div className="flex items-center">
                                                                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                                                                    <div className="h-[2px] flex-1 bg-red-500/40" />
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    {viewMode === 'day' && (() => {
                        const hourStart = 8, hourEnd = 21;
                        const hours = Array.from({ length: hourEnd - hourStart }, (_, i) => i + hourStart);
                        const rowH = 72; // px per hour — bigger for day view
                        const now = new Date();
                        const isToday = isSameDay(currentDate, now);
                        const sorted = selectedSessions.sort((a, b) => a.time.localeCompare(b.time));

                        return (
                            <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
                                {/* Day subtitle */}
                                <div className="px-5 py-3 border-b border-border/50 text-center">
                                    <span className="text-[14px] font-semibold text-muted-foreground capitalize">
                                        {currentDate.toLocaleDateString('ru-RU', { weekday: 'long' })}, {formatDate(currentDate)}
                                    </span>
                                </div>

                                {sorted.length === 0 ? (
                                    <div className="p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
                                        <div className="w-16 h-16 rounded-3xl bg-sage-100 flex items-center justify-center mb-4">
                                            <CalendarIcon className="w-8 h-8 text-forest-600" />
                                        </div>
                                        <p className="text-foreground font-bold text-lg mb-1">Нет записей</p>
                                        <button
                                            onClick={() => { setShowNewSession(true); setNewSessionDefaults({ date: currentDate }); }}
                                            className="mt-5 text-sm text-forest-700 font-bold flex items-center gap-2 hover:bg-sage-100 px-4 py-2.5 rounded-xl transition-colors"
                                        >
                                            <Plus className="w-4 h-4" /> Добавить запись
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-[50px_1fr] relative" style={{ minHeight: `${hours.length * rowH}px` }}>
                                        {/* Hour labels */}
                                        <div className="border-r border-border/30">
                                            {hours.map(h => (
                                                <div key={h} className="border-b border-border/15 text-[11px] font-medium text-muted-foreground/50 text-right pr-2 pt-0.5 tabular-nums" style={{ height: `${rowH}px` }}>
                                                    {String(h).padStart(2, '0')}:00
                                                </div>
                                            ))}
                                        </div>

                                        {/* Sessions column */}
                                        <div className="relative">
                                            {/* Grid lines */}
                                            {hours.map(h => (
                                                <div key={h} className="border-b border-border/10" style={{ height: `${rowH}px` }} />
                                            ))}

                                            {/* Session cards */}
                                            {sorted.map(s => {
                                                const [sh, sm] = s.time.split(':').map(Number);
                                                const topMin = (sh - hourStart) * 60 + sm;
                                                const top = (topMin / 60) * rowH;
                                                const dur = s.duration || 60;
                                                const height = Math.max((dur / 60) * rowH - 4, 40);
                                                const tc = typeColors[s.type] || defaultTypeColor;
                                                const cn = s.client?.name || 'Клиент';
                                                const typeLabel = s.type === 'individual' ? 'Регулярная сессия' : s.type === 'couple' ? 'Парная сессия' : s.type === 'family' ? 'Семейная сессия' : 'Сессия';
                                                const isActive = selectedSession?.id === s.id;

                                                return (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => setSelectedSession(s)}
                                                        className={`absolute left-2 right-2 rounded-xl px-4 py-3 text-left overflow-hidden transition-all hover:shadow-md cursor-pointer flex items-center gap-4 ${isActive ? 'ring-2 ring-primary shadow-card-hover bg-card' : 'bg-card border border-border/50 hover:border-border'}`}
                                                        style={{ top: `${top}px`, height: `${height}px` }}
                                                    >
                                                        {/* Colored left bar */}
                                                        <div className={`w-1 rounded-full ${tc.dot} absolute left-0 top-2 bottom-2`} />

                                                        {/* Time badge */}
                                                        <div className={`shrink-0 px-2.5 py-1 rounded-lg text-[12px] font-bold tabular-nums ${tc.bg} ${tc.text} ml-2`}>
                                                            {s.time} – {s.endTime}
                                                        </div>

                                                        {/* Client + type */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-[15px] font-bold text-foreground truncate">{cn}</div>
                                                            <div className="text-[12px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                                                <span className="flex items-center gap-1">{s.type === 'individual' ? '👤' : s.type === 'couple' ? '👥' : '👪'} {typeLabel}</span>
                                                            </div>
                                                        </div>

                                                        {/* Format + status */}
                                                        <div className="flex items-center gap-3 shrink-0">
                                                            <span className="text-[12px] text-muted-foreground flex items-center gap-1">
                                                                {s.format === 'online' ? <Video className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                                                                {s.format === 'online' ? 'Онлайн' : 'Офлайн'}
                                                            </span>
                                                            <span className={`text-[11px] px-2 py-0.5 rounded-md font-bold ${statusBadge[s.status]}`}>
                                                                {statusLabels[s.status]}
                                                            </span>
                                                        </div>
                                                    </button>
                                                );
                                            })}

                                            {/* Current time marker */}
                                            {isToday && (() => {
                                                const ch = now.getHours(), cm = now.getMinutes();
                                                if (ch >= hourStart && ch < hourEnd) {
                                                    const markerTop = ((ch - hourStart) * 60 + cm) / 60 * rowH;
                                                    return (
                                                        <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${markerTop}px` }}>
                                                            <div className="flex items-center">
                                                                <div className="px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded tabular-nums -ml-1">
                                                                    {String(ch).padStart(2, '0')}:{String(cm).padStart(2, '0')}
                                                                </div>
                                                                <div className="h-[2px] flex-1 bg-primary/30" />
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

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
                                                    <button key={s.id} onClick={() => setSelectedSession(s)}
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
                    {/* Legend */}
                    <div className="flex items-center gap-5 flex-wrap mt-3 px-1">
                        {([
                            ['individual', 'Индивидуальная'],
                            ['couple', 'Парная'],
                            ['family', 'Семейная'],
                            ['group', 'Групповая'],
                        ] as [string, string][]).map(([type, label]) => {
                            const tc = typeColors[type] || defaultTypeColor;
                            return (
                                <div key={type} className="flex items-center gap-1.5 text-[12px] text-muted-foreground font-medium">
                                    <div className={`w-2.5 h-2.5 rounded-full ${tc.dot}`} />
                                    {label}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Right Rail: Session Detail / Day List ── */}
                <div className="space-y-4">
                    {selectedSession ? (
                        /* Session Detail Panel — matches mockup */
                        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                                <h3 className="font-bold text-foreground text-[17px] tracking-tight truncate">{selectedSession.client.name}</h3>
                                <button onClick={() => setSelectedSession(null)} className="p-1.5 hover:bg-sage-100 rounded-lg transition-colors">
                                    <X className="w-4 h-4 text-muted-foreground" />
                                </button>
                            </div>
                            <div className="px-5 py-4 space-y-3.5">
                                <div className="flex items-center gap-2 text-[13px]">
                                    <div className={`w-2.5 h-2.5 rounded-full ${statusDotColor[selectedSession.status]}`} />
                                    <span className="font-semibold text-foreground">
                                        {selectedSession.type === 'individual' ? 'Индивидуальная сессия' : selectedSession.type === 'couple' ? 'Парная сессия' : 'Семейная сессия'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                                    <CalendarIcon className="w-3.5 h-3.5" />
                                    <span className="font-medium">{new Date(selectedSession.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'short' })}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span className="font-medium tabular-nums">{selectedSession.time} – {selectedSession.endTime} ({selectedSession.duration} мин)</span>
                                </div>
                                <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                                    {selectedSession.format === 'online' ? <Video className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                                    <span className="font-medium">{selectedSession.format === 'online' ? 'Онлайн' : 'Офлайн'}</span>
                                </div>
                            </div>
                            <div className="px-5 pb-5 space-y-2.5">
                                {selectedSession.status !== 'completed' && selectedSession.status !== 'cancelled' && (
                                    <button
                                        onClick={() => setRescheduleTarget(selectedSession)}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-[13px] font-semibold text-foreground hover:bg-sage-50 transition-colors"
                                    >
                                        <ArrowRightLeft className="w-3.5 h-3.5" /> Перенести
                                    </button>
                                )}
                                <button
                                    onClick={() => window.location.href = `/diary/clients?clientId=${selectedSession.client.id}`}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-[13px] font-semibold text-foreground hover:bg-sage-50 transition-colors"
                                >
                                    <User className="w-3.5 h-3.5" /> Открыть карточку
                                </button>
                                {selectedSession.format === 'online' && settings?.onlineSessionLink && (
                                    <a
                                        href={settings.onlineSessionLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-[13px] font-semibold text-foreground hover:bg-sage-50 transition-colors"
                                    >
                                        <LinkIcon className="w-3.5 h-3.5" /> Ссылка на встречу
                                    </a>
                                )}
                                {selectedSession.status !== 'completed' && selectedSession.status !== 'cancelled' && (
                                    <button
                                        onClick={() => handleStatusChange(selectedSession.id, 'completed')}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-forest-700 transition-all"
                                    >
                                        Проведена ✓
                                    </button>
                                )}
                                {selectedSession.status !== 'cancelled' && (
                                    confirmCancelId === selectedSession.id ? (
                                        <div className="flex gap-2">
                                            <button onClick={() => setConfirmCancelId(null)} className="flex-1 py-2.5 rounded-xl border border-border text-[13px] font-semibold">Нет</button>
                                            <button onClick={() => { handleStatusChange(selectedSession.id, 'cancelled'); setConfirmCancelId(null); setSelectedSession(null); }} className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-[13px] font-semibold">Да, отменить</button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setConfirmCancelId(selectedSession.id)}
                                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 text-red-500 text-[13px] font-semibold hover:bg-red-50 transition-colors"
                                        >
                                            Отменить запись
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Day List Panel (no session selected) */
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
                                <div className="space-y-2">
                                    {selectedSessions.map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => setSelectedSession(s)}
                                            className="w-full p-3.5 bg-sage-50 rounded-xl border border-border/40 hover:border-border text-left transition-all flex items-center gap-3"
                                        >
                                            <div className={`w-1 h-10 rounded-full shrink-0 ${statusDotColor[s.status]}`} />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-[14px] text-foreground truncate">{s.client.name}</div>
                                                <div className="text-[12px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                                    <span className="tabular-nums">{s.time} – {s.endTime}</span>
                                                    <span>·</span>
                                                    {s.format === 'online' ? <Video className="w-3 h-3 inline" /> : <MapPin className="w-3 h-3 inline" />}
                                                    <span>{s.format === 'online' ? 'Онлайн' : 'Офлайн'}</span>
                                                </div>
                                            </div>
                                            <span className={`text-[11px] px-2 py-0.5 rounded-md font-bold ${statusBadge[s.status]}`}>
                                                {statusLabels[s.status]}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
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
