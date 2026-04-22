'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Calendar as CalendarIcon, Plus, Clock, User, Video, MapPin,
    Loader2, Link as LinkIcon, AlertTriangle, FileText, Sparkles,
    ChevronRight, ArrowUpRight, Coffee, Users, TrendingUp, LayoutList,
    Filter, MoreVertical, Star
} from 'lucide-react';
import { toast } from 'sonner';
import { SessionModal } from './components/SessionModal';
import { RescheduleModal } from './components/RescheduleModal';
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

function isSameDay(d1: Date, d2: Date) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

const statusColors: Record<string, string> = {
    confirmed: 'bg-success-soft text-success-500 border-success-500/20',
    pending: 'bg-orange-soft text-orange-500 border-orange-500/20',
    completed: 'bg-sage-100 text-muted-foreground border-border',
    cancelled: 'bg-red-soft text-red-500 border-red-500/20',
};

const statusLabels: Record<string, string> = {
    confirmed: 'Подтверждено',
    pending: 'Ожидает',
    completed: 'Завершено',
    cancelled: 'Отменено',
};

const formatLabels: Record<string, { label: string; icon: typeof Video }> = {
    online: { label: 'Онлайн', icon: Video },
    offline: { label: 'В кабинете', icon: MapPin },
    hybrid: { label: 'Гибрид', icon: Users },
};

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 6) return 'Доброй ночи';
    if (hour < 12) return 'Доброе утро';
    if (hour < 18) return 'Добрый день';
    return 'Добрый вечер';
}

export default function DiaryCalendarPage() {
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
    const [userName, setUserName] = useState('');

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

    useEffect(() => {
        fetch('/api/auth/session')
            .then(r => r.json())
            .then(d => { if (d?.user?.name) setUserName(d.user.name.split(' ')[0]); })
            .catch(() => { });
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

    // ── Derived data ──
    const now = useMemo(() => new Date(), []);
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const todaySessions = useMemo(() =>
        sessions.filter(s => {
            const d = new Date(s.date);
            return isSameDay(d, now) && s.status !== 'cancelled';
        }).sort((a, b) => a.time.localeCompare(b.time)),
        [sessions, now]
    );

    const nextSession = useMemo(() => {
        // First: next session today (future time)
        const todayNext = todaySessions.find(s => s.time > currentTimeStr && s.status !== 'completed');
        if (todayNext) return todayNext;
        // Fallback: earliest future session on any upcoming day
        const todayStr = now.toISOString().slice(0, 10);
        return sessions
            .filter(s => s.status !== 'cancelled' && s.status !== 'completed' && new Date(s.date).toISOString().slice(0, 10) > todayStr)
            .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0] || null;
    }, [todaySessions, currentTimeStr, sessions, now]);

    const completedToday = todaySessions.filter(s => s.status === 'completed').length;
    const totalToday = todaySessions.length;

    const pendingSessions = sessions.filter(s => s.status === 'pending');
    const completedWithoutNotes = sessions.filter(s => {
        if (s.status !== 'completed') return false;
        const d = new Date(s.date); if (d > now) return false;
        return Math.floor((now.getTime() - d.getTime()) / 86400000) <= 14 && !s.notes && !s.structuredNotes;
    });
    const attentionCount = pendingSessions.length + completedWithoutNotes.length;

    const weekSessions = sessions.filter(s => {
        const d = new Date(s.date);
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - (now.getDay() + 6) % 7);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return d >= startOfWeek && d <= endOfWeek && s.status !== 'cancelled';
    });

    // Week strip data: per-day session counts
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (now.getDay() + 6) % 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const dayStr = d.toISOString().slice(0, 10);
        const count = sessions.filter(s => {
            const sd = new Date(s.date).toISOString().slice(0, 10);
            return sd === dayStr && s.status !== 'cancelled';
        }).length;
        return { date: d, dayStr, count, isToday: isSameDay(d, now) };
    });

    const weekUniqueClients = new Set(weekSessions.map(s => s.clientId)).size;

    // Workload: average sessions per day this week / target (e.g. 6)
    const weekWorkingDays = weekDays.filter(d => d.count > 0).length || 1;
    const avgPerDay = weekSessions.length / Math.max(weekWorkingDays, 1);
    const workloadPercent = Math.round(Math.min((avgPerDay / 6) * 100, 100));

    const getMinutesUntil = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return (h * 60 + m) - (now.getHours() * 60 + now.getMinutes());
    };

    const timelineHours = Array.from({ length: 15 }, (_, i) => i + 8);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Welcome strip for new psychologists */}
            <WelcomeStrip />

            {/* ── HEADER with WEEK STRIP ── */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                    <h1 className="text-[32px] md:text-[40px] font-bold tracking-tight text-foreground leading-[1.1]">
                        {getGreeting()}{userName ? `, ${userName}` : ''} 👋
                    </h1>
                    <p className="text-muted-foreground text-[15px] mt-2 font-medium capitalize">
                        {now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>

                {/* Week strip */}
                <div className="flex items-stretch gap-0 bg-card rounded-2xl border border-border shadow-card overflow-x-auto telegram-miniapp-scrollbar-hide">
                    {weekDays.map((wd, i) => {
                        const dayName = wd.date.toLocaleDateString('ru-RU', { weekday: 'short' });
                        const dayNum = wd.date.getDate();
                        return (
                            <div
                                key={i}
                                className={`flex flex-col items-center px-3 md:px-4 py-2.5 min-w-[52px] border-r border-border/50 last:border-r-0 ${
                                    wd.isToday ? 'bg-primary text-primary-foreground' : ''
                                }`}
                            >
                                <span className={`text-[11px] font-semibold uppercase ${wd.isToday ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                    {dayName}
                                </span>
                                <span className={`text-[15px] font-bold ${wd.isToday ? '' : 'text-foreground'}`}>
                                    {dayNum}
                                </span>
                                {wd.count > 0 && (
                                    <span className={`text-[11px] font-bold mt-0.5 ${wd.isToday ? 'text-primary-foreground/80' : 'text-forest-600'}`}>
                                        {wd.count}
                                        <span className={`font-medium ml-0.5 ${wd.isToday ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                                            {wd.count === 1 ? 'сессия' : wd.count < 5 ? 'сессии' : 'сессий'}
                                        </span>
                                    </span>
                                )}
                            </div>
                        );
                    })}
                    {/* На неделю summary */}
                    <div className="flex flex-col items-center justify-center px-4 md:px-5 py-2.5 border-l border-border bg-sage-50/50">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase">На неделю</span>
                        <span className="text-[18px] font-bold text-foreground">{weekSessions.length} <span className="text-[12px] font-medium text-muted-foreground">сессий</span></span>
                        <span className="text-[12px] font-medium text-muted-foreground">{weekUniqueClients} клиентов</span>
                    </div>
                </div>
            </div>

            {/* ── MAIN CONTENT GRID ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* ── LEFT: Next Session + Timeline (2 cols) ── */}
                <div className="lg:col-span-2 space-y-5">

                    {nextSession && (() => {
                        const cn = nextSession.client?.name || clients.find(c => c.id === nextSession.clientId)?.name || 'Клиент';
                        const isTodaySession = isSameDay(new Date(nextSession.date), now);
                        const mu = isTodaySession ? getMinutesUntil(nextSession.time) : -1;
                        const close = isTodaySession && mu <= 15;
                        const FormatInfo = formatLabels[nextSession.format] || formatLabels.online;
                        const FormatIcon = FormatInfo.icon;
                        const clientSessionCount = sessions.filter(s => s.clientId === nextSession.clientId && s.status !== 'cancelled').length;
                        const typeLabel = nextSession.type === 'individual' ? 'Индивидуальная' : nextSession.type === 'couple' ? 'Парная' : nextSession.type === 'family' ? 'Семейная' : nextSession.type;
                        const sessionDateStr = isTodaySession
                            ? (mu > 0 ? `через ${mu} мин` : 'Сейчас')
                            : new Date(nextSession.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ', ' + nextSession.time;

                        return (
                            <div className={`bg-card rounded-2xl border overflow-hidden shadow-card transition-all ${close ? 'border-primary/40 ring-1 ring-primary/10' : 'border-border'}`}>
                                {/* Green header label */}
                                <div className="px-6 pt-5 flex items-center justify-between">
                                    <span className="text-[12px] font-bold uppercase tracking-wider text-forest-600">Следующая сессия</span>
                                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold tabular-nums ${close ? 'bg-primary/10 text-forest-700 border border-primary/20' : 'bg-sage-100 text-muted-foreground'}`}>
                                        {isTodaySession && mu > 0 && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                                        {sessionDateStr}
                                    </div>
                                </div>

                                <div className="p-6 pt-4">
                                    {/* Client row: avatar + info + time */}
                                    <div className="flex items-start gap-5">
                                        {/* Large circular avatar */}
                                        <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center text-forest-700 font-bold text-xl shrink-0 uppercase border-2 border-sage-200">
                                            {cn.slice(0, 2)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-[22px] font-bold text-foreground truncate">{cn}</h3>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground font-semibold mb-2">
                                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                                {clientSessionCount} {clientSessionCount === 1 ? 'сессия' : clientSessionCount < 5 ? 'сессии' : 'сессий'}
                                            </div>
                                            {/* Запрос - placeholder since we don't have this data yet */}
                                            {nextSession.client?.questionnaire?.data && (nextSession.client.questionnaire.data as any).request && (
                                                <div className="text-[13px] text-muted-foreground mb-2">
                                                    <span className="font-semibold text-foreground">Запрос:</span> {(nextSession.client.questionnaire.data as any).request}
                                                </div>
                                            )}
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3.5 h-3.5" /> {typeLabel}
                                                </span>
                                            </div>
                                        </div>
                                        {/* Right: Time block */}
                                        <div className="shrink-0 text-right hidden sm:block">
                                            <div className="text-[22px] font-bold text-foreground tabular-nums">{nextSession.time} – {nextSession.endTime || ''}</div>
                                            <div className="text-[13px] text-muted-foreground flex items-center gap-1.5 justify-end mt-1">
                                                <FormatIcon className="w-3.5 h-3.5" />
                                                {FormatInfo.label}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions: 2 buttons + link */}
                                    <div className="flex items-center gap-3 mt-5">
                                        <button
                                            onClick={() => setEditingSession(nextSession)}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-[14px] font-bold hover:bg-forest-700 transition-all active:scale-[0.97]"
                                        >
                                            Подготовиться
                                        </button>
                                        {nextSession.format === 'online' && settings?.onlineSessionLink && (
                                            <a
                                                href={settings.onlineSessionLink}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center justify-center gap-2 px-5 py-3 bg-card border border-border text-foreground rounded-xl text-[14px] font-bold hover:bg-sage-50 transition-all active:scale-[0.97]"
                                            >
                                                <Video className="w-4 h-4" /> Открыть Zoom
                                            </a>
                                        )}
                                    </div>

                                    {/* Open client card link */}
                                    <button
                                        onClick={() => window.location.href = `/diary/clients?clientId=${nextSession.clientId}`}
                                        className="w-full flex items-center justify-between mt-4 pt-4 border-t border-border/50 text-[14px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        Открыть карточку
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })()}

                    {/* TIMELINE — Расписание на сегодня */}
                    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-card">
                        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <CalendarIcon className="w-4 h-4 text-forest-600" />
                                <span className="text-[15px] font-bold text-foreground">Расписание на сегодня</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-muted-foreground hover:bg-sage-50 transition-colors">
                                    <Filter className="w-3.5 h-3.5" /> Фильтры
                                </button>
                                <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-sage-50 transition-colors">
                                    <LayoutList className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {totalToday === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 px-4">
                                <div className="w-16 h-16 bg-sage-100 rounded-2xl flex items-center justify-center mb-4">
                                    <Coffee className="w-8 h-8 text-forest-600" />
                                </div>
                                <div className="text-[18px] font-bold text-foreground mb-1">Свободный день</div>
                                <div className="text-body-secondary text-muted-foreground text-center max-w-xs">Нет запланированных сессий на сегодня</div>
                                <button
                                    onClick={() => { setShowNewSession(true); setNewSessionDefaults({ date: selectedDate }); }}
                                    className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-sage-100 text-forest-700 rounded-xl text-sm font-bold hover:bg-sage-150 transition-all"
                                >
                                    <Plus className="w-4 h-4" /> Добавить запись
                                </button>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/50">
                                {todaySessions.map(s => {
                                    const cn = s.client?.name || clients.find(c => c.id === s.clientId)?.name || 'Клиент';
                                    const done = s.status === 'completed';
                                    const past = s.time < currentTimeStr && !done;
                                    const isN = nextSession?.id === s.id;
                                    const mu = isN ? getMinutesUntil(s.time) : 0;
                                    const FormatInfo = formatLabels[s.format] || formatLabels.online;
                                    const FormatIcon = FormatInfo.icon;
                                    const typeLabel = s.type === 'individual' ? 'Индивидуальная' : s.type === 'couple' ? 'Парная' : s.type === 'family' ? 'Семейная' : s.type;

                                    // Badge logic
                                    const badges: { label: string; color: string }[] = [];
                                    if (s.status === 'pending') badges.push({ label: 'Оплата не отмечена', color: 'bg-orange-soft text-orange-600' });
                                    if (done && !s.notes && !s.structuredNotes) badges.push({ label: 'ДЗ не заполнено', color: 'bg-orange-soft text-orange-600' });

                                    return (
                                        <div
                                            key={s.id}
                                            onClick={() => setEditingSession(s)}
                                            className={`flex items-center gap-4 px-5 py-4 hover:bg-sage-50/50 transition-colors cursor-pointer ${isN ? 'bg-sage-50/80' : ''} ${done ? 'opacity-60' : ''}`}
                                        >
                                            {/* Time column */}
                                            <div className="shrink-0 w-[56px]">
                                                <div className={`text-[15px] font-bold tabular-nums ${isN ? 'text-primary' : 'text-foreground'}`}>{s.time}</div>
                                                <div className="text-[12px] text-muted-foreground tabular-nums">{s.endTime || ''}</div>
                                            </div>

                                            {/* Color bar */}
                                            <div className={`w-1 h-10 rounded-full shrink-0 ${isN ? 'bg-primary' : done ? 'bg-sage-200' : 'bg-forest-600'}`} />

                                            {/* Avatar */}
                                            <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center text-forest-700 font-bold text-[13px] shrink-0 uppercase border border-sage-200">
                                                {cn.slice(0, 2)}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[14px] font-bold truncate ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{cn}</span>
                                                    {isN && (
                                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary shrink-0 tabular-nums">
                                                            Через {mu > 0 ? `${mu} мин` : 'сейчас'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[12px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                                    <span>{typeLabel}</span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1"><FormatIcon className="w-3 h-3" />{FormatInfo.label}</span>
                                                </div>
                                            </div>

                                            {/* Badges */}
                                            <div className="flex items-center gap-2 shrink-0">
                                                {badges.map((b, i) => (
                                                    <span key={i} className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${b.color}`}>{b.label}</span>
                                                ))}
                                                <button
                                                    onClick={e => { e.stopPropagation(); setEditingSession(s); }}
                                                    className="p-1 rounded-lg hover:bg-sage-100 transition-colors text-muted-foreground/40 hover:text-muted-foreground"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Add session button */}
                                <button
                                    onClick={() => { setShowNewSession(true); setNewSessionDefaults({ date: selectedDate }); }}
                                    className="w-full flex items-center justify-center gap-2 py-4 text-[14px] font-semibold text-forest-600 hover:bg-sage-50 transition-colors"
                                >
                                    <Plus className="w-4 h-4" /> Добавить запись
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT RAIL ── */}
                <div className="space-y-5">

                    {/* Requires Attention */}
                    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-card">
                        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <AlertTriangle className={`w-4 h-4 ${attentionCount > 0 ? 'text-orange-500' : 'text-muted-foreground/30'}`} />
                                <span className="text-[15px] font-bold text-foreground">Требует внимания</span>
                            </div>
                            <button className="p-1 rounded-lg hover:bg-sage-50 transition-colors text-muted-foreground/40">
                                <MoreVertical className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-3 space-y-1">
                            {attentionCount === 0 ? (
                                <div className="text-center py-8 text-body-secondary text-muted-foreground/50 font-medium">
                                    Всё в порядке ✓
                                </div>
                            ) : (
                                <>
                                    {/* Consent issues */}
                                    {pendingSessions.length > 0 && (
                                        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 hover:bg-red-100/50 transition-colors">
                                            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-500 flex items-center justify-center shrink-0">
                                                <AlertTriangle className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[13px] font-bold text-foreground">Оплата сессий не отмечена</div>
                                                <div className="text-[11px] text-muted-foreground">{pendingSessions.length} сессий</div>
                                            </div>
                                            <button
                                                onClick={() => pendingSessions[0] && setEditingSession(pendingSessions[0])}
                                                className="text-[12px] font-bold text-primary hover:text-forest-800 transition-colors flex items-center gap-1 shrink-0"
                                            >
                                                Открыть <ChevronRight className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                    {/* Notes missing */}
                                    {completedWithoutNotes.length > 0 && (
                                        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 hover:bg-amber-100/50 transition-colors">
                                            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                                                <FileText className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[13px] font-bold text-foreground">Домашние задания не заполнены</div>
                                                <div className="text-[11px] text-muted-foreground">{completedWithoutNotes.length} записи</div>
                                            </div>
                                            <button
                                                onClick={() => completedWithoutNotes[0] && setEditingSession(completedWithoutNotes[0])}
                                                className="text-[12px] font-bold text-primary hover:text-forest-800 transition-colors flex items-center gap-1 shrink-0"
                                            >
                                                Проверить <ChevronRight className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Статистика недели — 4 KPI grid */}
                    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-card">
                        <div className="px-5 py-4 border-b border-border flex items-center gap-2.5">
                            <TrendingUp className="w-4 h-4 text-forest-600" />
                            <span className="text-[15px] font-bold text-foreground">Статистика недели</span>
                        </div>
                        <div className="grid grid-cols-2 gap-px bg-border/50">
                            <div className="bg-card p-4 text-center">
                                <div className="text-[28px] font-bold text-foreground tabular-nums">{weekSessions.length}</div>
                                <div className="text-[12px] text-muted-foreground font-medium mt-0.5">Сессий</div>
                            </div>
                            <div className="bg-card p-4 text-center">
                                <div className="text-[28px] font-bold text-foreground tabular-nums">{weekUniqueClients}</div>
                                <div className="text-[12px] text-muted-foreground font-medium mt-0.5">Клиентов</div>
                            </div>
                            <div className="bg-card p-4 text-center">
                                <div className="text-[28px] font-bold text-foreground tabular-nums">{workloadPercent}<span className="text-[16px]">%</span></div>
                                <div className="text-[12px] text-muted-foreground font-medium mt-0.5">Загрузка</div>
                            </div>
                            <div className="bg-card p-4 text-center">
                                <div className="text-[28px] font-bold text-foreground tabular-nums flex items-center justify-center gap-1">
                                    —
                                </div>
                                <div className="text-[12px] text-muted-foreground font-medium mt-0.5">Оценка</div>
                            </div>
                        </div>
                        <button
                            onClick={() => window.location.href = '/diary/analytics'}
                            className="w-full flex items-center justify-between px-5 py-3 border-t border-border hover:bg-sage-50 transition-colors text-[13px] font-semibold text-forest-600"
                        >
                            Перейти к аналитике
                            <ChevronRight className="w-4 h-4" />
                        </button>
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
