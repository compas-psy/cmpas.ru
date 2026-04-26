'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Calendar as CalendarIcon, Plus, User, Video, MapPin,
    AlertTriangle, FileText, Sparkles, CheckCircle2,
    ChevronRight, Coffee, Users, TrendingUp, LayoutList,
    Filter, MoreVertical, X, BookOpen, Shield, Clock
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
    client: { id: string; name: string; questionnaire?: { data: any } | null; consentDate?: string | null };
};

type Client = {
    id: string;
    name: string;
    consentDate?: string | null;
    questionnaire?: { data: any } | null;
};

type ActivityEvent = {
    clientId: string;
    clientName: string;
    type: 'homework_done' | 'session_confirmed' | 'consent_given';
    description: string;
    at: string;
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
    const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
    const [userName, setUserName] = useState('');
    const [scheduleFilter, setScheduleFilter] = useState<'all' | 'confirmed' | 'completed' | 'pending'>('all');
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [activity, setActivity] = useState<ActivityEvent[]>([]);
    const [prevWeek, setPrevWeek] = useState({ sessions: 0, clients: 0 });
    const filterRef = useRef<HTMLDivElement>(null);

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
            setClients(data.map(c => ({
                id: c.id,
                name: c.name,
                consentDate: (c as any).consentDate ?? null,
            })));
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
            .then(d => {
                if (d?.user?.name) {
                    // Russian name format: "LastName FirstName" — take last token as first name
                    const parts = d.user.name.trim().split(/\s+/);
                    setUserName(parts.length > 1 ? parts[parts.length - 1] : parts[0]);
                }
            })
            .catch(() => { });

        // Load activity feed and prev week stats
        import('./actions/sessions').then(({ getClientActivity, getPreviousWeekStats }) => {
            getClientActivity().then(setActivity).catch(() => {});
            getPreviousWeekStats().then(setPrevWeek).catch(() => {});
        });
    }, []);

    useEffect(() => { fetchSessions(); }, [fetchSessions]);
    useEffect(() => { fetchClients(); }, [fetchClients]);
    useEffect(() => { fetchSettings(); }, [fetchSettings]);

    // Close filter dropdown on outside click
    useEffect(() => {
        if (!showFilterMenu) return;
        const handler = (e: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
                setShowFilterMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showFilterMenu]);


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
    const now = useMemo(() => new Date(), [sessions.length]); // recalculate on session data changes
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
        const toLocalStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const todayStr = toLocalStr(now);
        return sessions
            .filter(s => s.status !== 'cancelled' && s.status !== 'completed' && toLocalStr(new Date(s.date)) > todayStr)
            .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0] || null;
    }, [todaySessions, currentTimeStr, sessions, now]);

    const completedToday = todaySessions.filter(s => s.status === 'completed').length;
    const totalToday = todaySessions.length;

    const pendingSessions = sessions.filter(s => s.status === 'pending');
    const missingSessions = sessions.filter(s => {
        if (s.status !== 'completed') return false;
        const d = new Date(s.date); if (d > now) return false;
        return Math.floor((now.getTime() - d.getTime()) / 86400000) <= 14 && !s.notes && !s.structuredNotes;
    });
    const noConsentClients = clients.filter(c => !c.consentDate).slice(0, 5);
    const attentionCount = pendingSessions.length + missingSessions.length + noConsentClients.length;

    const weekSessions = sessions.filter(s => {
        const d = new Date(s.date);
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - (now.getDay() + 6) % 7);
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return d >= startOfWeek && d <= endOfWeek && s.status !== 'cancelled';
    });

    // Week strip data: per-day session counts
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (now.getDay() + 6) % 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const dayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const count = sessions.filter(s => {
            const sd = new Date(s.date);
            const sdStr = `${sd.getFullYear()}-${String(sd.getMonth()+1).padStart(2,'0')}-${String(sd.getDate()).padStart(2,'0')}`;
            return sdStr === dayStr && s.status !== 'cancelled';
        }).length;
        return { date: d, dayStr, count, isToday: isSameDay(d, now) };
    });

    const weekUniqueClients = new Set(weekSessions.map(s => s.clientId)).size;
    const weekWorkingDays = weekDays.filter(d => d.count > 0).length || 1;
    const avgPerDay = weekSessions.length / Math.max(weekWorkingDays, 1);
    const workloadPercent = Math.round(Math.min((avgPerDay / 6) * 100, 100));

    // Delta vs previous week
    const sessionsDelta = prevWeek.sessions > 0
        ? Math.round(((weekSessions.length - prevWeek.sessions) / prevWeek.sessions) * 100) : null;
    const clientsDelta = prevWeek.clients > 0
        ? Math.round(((weekUniqueClients - prevWeek.clients) / prevWeek.clients) * 100) : null;

    // Sparkline: session counts per day for SVG
    const sparkCounts = weekDays.map(d => d.count);
    const sparkMax = Math.max(...sparkCounts, 1);

    // Filtered today sessions
    const filteredTodaySessions = useMemo(() =>
        scheduleFilter === 'all' ? todaySessions : todaySessions.filter(s => s.status === scheduleFilter),
        [todaySessions, scheduleFilter]
    );

    const getMinutesUntil = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return (h * 60 + m) - (now.getHours() * 60 + now.getMinutes());
    };

    const formatMinutes = (mins: number) => {
        if (mins <= 0) return 'сейчас';
        if (mins < 60) return `${mins} мин`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (m === 0) return `${h} ч`;
        return `${h} ч ${m} мин`;
    };

    const timeAgo = (iso: string) => {
        const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
        if (diff < 1) return 'только что';
        if (diff < 60) return `${diff} мин назад`;
        const h = Math.floor(diff / 60);
        if (h < 24) return `${h} ч назад`;
        return `${Math.floor(h/24)} дн назад`;
    };

    const activityIcon = (type: ActivityEvent['type']) => {
        if (type === 'homework_done') return <CheckCircle2 className="w-4 h-4 text-green-600" />;
        if (type === 'consent_given') return <Shield className="w-4 h-4 text-blue-600" />;
        return <BookOpen className="w-4 h-4 text-forest-600" />;
    };


    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <>
        <div className="space-y-6 pb-12 w-full min-w-0">
            {/* Welcome strip for new psychologists */}
            <WelcomeStrip />


            {/* ── HEADER with WEEK STRIP ── */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 min-w-0">
                <div className="min-w-0">
                    <h1 className="text-[26px] md:text-[36px] font-bold tracking-tight text-foreground leading-[1.1]">
                        {getGreeting()}{userName ? `, ${userName}` : ''} 👋
                    </h1>
                    <p className="text-muted-foreground text-[13px] mt-0.5 font-medium capitalize">
                        {now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>

                {/* Week strip */}
                <div className="flex items-stretch bg-card rounded-2xl border border-border shadow-card overflow-hidden shrink-0">
                    <div className="grid grid-cols-7">
                        {weekDays.map((wd, i) => (
                            <div key={i} className={`flex flex-col items-center py-2.5 px-3 sm:px-4 ${wd.isToday ? 'bg-primary rounded-2xl -m-px z-10 shadow-sm' : ''}`}>
                                <span className={`text-[10px] font-semibold uppercase leading-tight ${wd.isToday ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                    {wd.date.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '')}
                                </span>
                                <span className={`text-[15px] font-bold leading-tight mt-0.5 ${wd.isToday ? 'text-primary-foreground' : 'text-foreground'}`}>
                                    {wd.date.getDate()}
                                </span>
                                {wd.count > 0 && (
                                    <span className={`w-1.5 h-1.5 rounded-full mt-1 ${wd.isToday ? 'bg-primary-foreground/60' : 'bg-forest-500'}`} />
                                )}
                            </div>
                        ))}
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
                        const isNow = isTodaySession && mu <= 0 && mu > -60;
                        const close = isTodaySession && mu <= 30 && mu > 0;
                        const FormatInfo = formatLabels[nextSession.format] || formatLabels.online;
                        const FormatIcon = FormatInfo.icon;
                        const clientSessionCount = sessions.filter(s => s.clientId === nextSession.clientId && s.status !== 'cancelled').length;
                        const typeLabel = nextSession.type === 'individual' ? 'Индивидуальная' : nextSession.type === 'couple' ? 'Парная консультация' : nextSession.type === 'family' ? 'Семейная' : nextSession.type;
                        const sessionDateStr = isTodaySession
                            ? (isNow ? 'Сейчас' : mu > 0 ? `через ${formatMinutes(mu)}` : 'Идёт')
                            : new Date(nextSession.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + ', ' + nextSession.time;
                        const requestText = nextSession.client?.questionnaire?.data && (nextSession.client.questionnaire.data as any).request;
                        
                        // Find last session with the same client that has any notes (before next session date)
                        const nextSessionDate = new Date(nextSession.date).toISOString();
                        const lastCompletedSession = sessions
                            .filter(s => s.clientId === nextSession.clientId && s.id !== nextSession.id && s.date < nextSessionDate && (s.structuredNotes || s.notes || s.clientSummary || s.privateNotes))
                            .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))[0];
                        
                        // Build summary from structured notes blocks
                        const buildSummaryFromBlocks = (session: typeof lastCompletedSession) => {
                            if (!session) return null;
                            
                            // Priority 1: clientSummary (manually written by psychologist for client)
                            if (session.clientSummary) return { type: 'text' as const, text: session.clientSummary };
                            
                            // Priority 2: structured notes blocks
                            const blocks = session.structuredNotes?.blocks as { definitionId: string; values: Record<string, string> }[] | undefined;
                            if (blocks && blocks.length > 0) {
                                const parts: { emoji: string; label: string; text: string }[] = [];
                                const blockMap: Record<string, { emoji: string; label: string; keys: string[] }> = {
                                    dynamics: { emoji: '📈', label: 'Динамика', keys: ['changes', 'improved'] },
                                    observation: { emoji: '👁', label: 'Наблюдение', keys: ['emotional_state', 'patterns'] },
                                    intervention: { emoji: '🛠', label: 'Интервенция', keys: ['technique', 'reaction'] },
                                    homework: { emoji: '📝', label: 'ДЗ', keys: ['task'] },
                                    next_step: { emoji: '➡️', label: 'План', keys: ['focus'] },
                                    request: { emoji: '🎯', label: 'Запрос', keys: ['formulation'] },
                                };
                                for (const block of blocks) {
                                    const cfg = blockMap[block.definitionId];
                                    if (!cfg) continue;
                                    const texts = cfg.keys.map(k => block.values[k]?.trim()).filter(Boolean);
                                    if (texts.length > 0) {
                                        parts.push({ emoji: cfg.emoji, label: cfg.label, text: texts.join('. ') });
                                    }
                                }
                                if (parts.length > 0) return { type: 'structured' as const, parts };
                            }
                            
                            // Priority 3: plain text notes
                            if (session.notes) return { type: 'text' as const, text: session.notes };
                            
                            // Priority 4: private notes (psychologist's internal notes)
                            if (session.privateNotes) {
                                const pn = session.privateNotes;
                                if (typeof pn === 'string') return { type: 'text' as const, text: pn };
                                if (typeof pn === 'object' && pn.text) return { type: 'text' as const, text: pn.text };
                            }
                            
                            return null;
                        };
                        
                        const lastSummaryData = buildSummaryFromBlocks(lastCompletedSession);

                        return (
                            <div className={`bg-card rounded-2xl border overflow-hidden shadow-card transition-all ${close || isNow ? 'border-primary/40 ring-1 ring-primary/10' : 'border-border'}`}>
                                <div className="px-5 pt-4 flex items-center justify-between">
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-forest-600">Следующая сессия</span>
                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold tabular-nums ${isNow ? 'bg-green-100 text-green-700' : close ? 'bg-primary/10 text-forest-700 border border-primary/20' : 'bg-sage-100 text-muted-foreground'}`}>
                                        {(isTodaySession && mu > 0) && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />}
                                        {sessionDateStr}
                                    </div>
                                </div>

                                <div className="p-5 pt-3">
                                    <div className="flex items-start gap-4">
                                        <div className="w-14 h-14 rounded-full bg-sage-100 flex items-center justify-center text-forest-700 font-bold text-lg shrink-0 uppercase border-2 border-sage-200">
                                            {cn.slice(0, 2)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-[20px] font-bold text-foreground truncate">{cn}</h3>
                                            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground font-semibold mt-0.5 mb-1">
                                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                                {clientSessionCount} {clientSessionCount === 1 ? 'сессия' : clientSessionCount < 5 ? 'сессии' : 'сессий'}
                                            </div>
                                            {requestText && (
                                                <p className="text-[12px] text-muted-foreground mb-1.5 line-clamp-1">
                                                    Запрос: {requestText}
                                                </p>
                                            )}
                                            <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                                                <User className="w-3 h-3" /> {typeLabel}
                                            </span>
                                        </div>
                                        <div className="shrink-0 text-right hidden sm:flex flex-col items-end">
                                            <div className="text-[20px] font-bold text-foreground tabular-nums">{nextSession.time} – {nextSession.endTime || ''}</div>
                                            <div className="flex items-center gap-1 text-[12px] text-muted-foreground mt-1">
                                                <FormatIcon className="w-3.5 h-3.5" /> {FormatInfo.label}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Summary of last session */}
                                    {lastSummaryData && (
                                        <div className="mt-3 p-3 bg-sage-50 rounded-xl border border-sage-200">
                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-forest-600 mb-1.5 uppercase tracking-wide">
                                                <Sparkles className="w-3 h-3" /> Кратко о прошлом сеансе
                                            </div>
                                            {lastSummaryData.type === 'structured' ? (
                                                <div className="space-y-1">
                                                    {lastSummaryData.parts.slice(0, 4).map((part, i) => (
                                                        <div key={i} className="flex items-start gap-1.5">
                                                            <span className="text-[11px] shrink-0">{part.emoji}</span>
                                                            <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-1">
                                                                <span className="font-semibold text-foreground/70">{part.label}:</span>{' '}{part.text}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-[12px] text-muted-foreground line-clamp-3 leading-relaxed">{lastSummaryData.text}</p>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 mt-4">
                                        <button
                                            onClick={() => window.location.href = `/diary/clients?clientId=${nextSession.clientId}`}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-[13px] font-bold hover:bg-forest-700 transition-all active:scale-[0.97]"
                                        >
                                            <FileText className="w-4 h-4" /> Подготовиться
                                        </button>
                                        {nextSession.format === 'online' && (settings?.onlineSessionLink) && (
                                            <a
                                                href={settings.onlineSessionLink}
                                                target="_blank" rel="noreferrer"
                                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-card border border-border text-foreground rounded-xl text-[13px] font-bold hover:bg-sage-50 transition-all active:scale-[0.97]"
                                            >
                                                <Video className="w-4 h-4" /> Открыть Zoom
                                            </a>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => window.location.href = `/diary/clients?clientId=${nextSession.clientId}`}
                                        className="w-full flex items-center justify-between mt-3 pt-3 border-t border-border/50 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        Открыть карточку <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })()}

                    {/* РАСПИСАНИЕ НА СЕГОДНЯ */}
                    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-card">
                        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <CalendarIcon className="w-4 h-4 text-forest-600" />
                                <span className="text-[14px] font-bold text-foreground">Расписание на сегодня</span>
                            </div>
                            <div className="flex items-center gap-1" ref={filterRef}>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowFilterMenu(v => !v)}
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${showFilterMenu || scheduleFilter !== 'all' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-sage-50'}`}
                                    >
                                        <Filter className="w-3.5 h-3.5" />
                                        {scheduleFilter === 'all' ? 'Фильтры' : scheduleFilter === 'confirmed' ? 'Подтверждено' : scheduleFilter === 'completed' ? 'Завершено' : 'Ожидает'}
                                        {scheduleFilter !== 'all' && <X className="w-3 h-3" onClick={e => { e.stopPropagation(); setScheduleFilter('all'); }} />}
                                    </button>
                                    {showFilterMenu && (
                                        <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg z-50 min-w-[160px] overflow-hidden">
                                            {(['all', 'confirmed', 'completed', 'pending'] as const).map(f => (
                                                <button key={f} onClick={() => { setScheduleFilter(f); setShowFilterMenu(false); }}
                                                    className={`w-full text-left px-3 py-2 text-[13px] font-medium hover:bg-sage-50 transition-colors ${scheduleFilter === f ? 'text-primary font-bold' : 'text-foreground'}`}>
                                                    {f === 'all' ? 'Все сессии' : f === 'confirmed' ? 'Подтверждённые' : f === 'completed' ? 'Завершённые' : 'Ожидают оплаты'}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-sage-50 transition-colors">
                                    <LayoutList className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {totalToday === 0 ? (
                            <div className="flex flex-col items-center justify-center py-14 px-4">
                                <div className="w-14 h-14 bg-sage-100 rounded-2xl flex items-center justify-center mb-3">
                                    <Coffee className="w-7 h-7 text-forest-600" />
                                </div>
                                <div className="text-[16px] font-bold text-foreground mb-1">Свободный день</div>
                                <div className="text-[13px] text-muted-foreground text-center max-w-xs">Нет запланированных сессий на сегодня</div>
                                <button onClick={() => { setShowNewSession(true); setNewSessionDefaults({ date: selectedDate }); }}
                                    className="mt-5 flex items-center gap-2 px-4 py-2 bg-sage-100 text-forest-700 rounded-xl text-[13px] font-bold hover:bg-sage-150 transition-all">
                                    <Plus className="w-4 h-4" /> Добавить запись
                                </button>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/50">
                                {filteredTodaySessions.map((s, idx) => {
                                    const cn = s.client?.name || clients.find(c => c.id === s.clientId)?.name || 'Клиент';
                                    const done = s.status === 'completed';
                                    const isN = nextSession?.id === s.id;
                                    const mu = isN ? getMinutesUntil(s.time) : 0;
                                    const FormatInfo = formatLabels[s.format] || formatLabels.online;
                                    const FormatIcon = FormatInfo.icon;
                                    const noConsent = !s.client?.consentDate;
                                    const isLast = idx === filteredTodaySessions.length - 1;

                                    return (
                                        <div key={s.id} onClick={() => setEditingSession(s)}
                                            className={`flex gap-3 px-5 py-3 hover:bg-sage-50/50 transition-colors cursor-pointer ${isN ? 'bg-sage-50/80' : ''} ${done ? 'opacity-50' : ''}`}>
                                            {/* Time column */}
                                            <div className="shrink-0 w-[44px] pt-0.5 text-right">
                                                <div className={`text-[13px] font-bold tabular-nums leading-tight ${isN ? 'text-primary' : 'text-foreground'}`}>{s.time}</div>
                                                <div className="text-[10px] text-muted-foreground/60 tabular-nums leading-tight">{s.endTime || ''}</div>
                                            </div>
                                            {/* Timeline */}
                                            <div className="flex flex-col items-center shrink-0">
                                                <div className={`w-2.5 h-2.5 rounded-full shrink-0 border-2 ${isN ? 'bg-primary border-primary/30' : done ? 'bg-sage-300 border-sage-200' : s.status === 'pending' ? 'bg-orange-400 border-orange-200' : 'bg-forest-500 border-forest-200'}`} />
                                                {!isLast && <div className="w-0.5 flex-1 bg-border/60 mt-0.5" />}
                                            </div>
                                            {/* Avatar */}
                                            <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center text-forest-700 font-bold text-[11px] shrink-0 uppercase border border-sage-200">
                                                {cn.slice(0, 2)}
                                            </div>
                                            {/* Content */}
                                            <div className="flex-1 min-w-0 pb-2">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`text-[13px] font-bold truncate ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{cn}</span>
                                                    {isN && mu > 0 && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-primary/10 text-primary shrink-0">Через {formatMinutes(mu)}</span>}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 flex-wrap">
                                                    <FormatIcon className="w-3 h-3 shrink-0" />
                                                    <span>{FormatInfo.label}</span>
                                                    <span>•</span>
                                                    <span>{s.duration} мин</span>
                                                    {noConsent && <span className="px-1 py-0.5 rounded text-[9px] font-bold text-red-600 bg-red-50 ml-1">Нет согласия</span>}
                                                </div>
                                            </div>
                                            {/* Status badge */}
                                            <div className="shrink-0 flex flex-col items-end gap-1 pt-0.5">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusColors[s.status] || 'text-muted-foreground bg-muted border-border'}`}>
                                                    {statusLabels[s.status] || s.status}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredTodaySessions.length === 0 && scheduleFilter !== 'all' && (
                                    <div className="py-8 text-center text-[13px] text-muted-foreground">Нет сессий по фильтру</div>
                                )}
                                <button onClick={() => { setShowNewSession(true); setNewSessionDefaults({ date: selectedDate }); }}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 text-[13px] font-semibold text-forest-600 hover:bg-sage-50 transition-colors">
                                    <Plus className="w-4 h-4" /> Добавить запись
                                </button>
                            </div>
                        )}
                    </div>

                </div>

                {/* ── RIGHT RAIL ── */}
                <div className="space-y-5">

                    {/* Requires Attention */}
                    {/* Требует внимания */}
                    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-card">
                        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className={`w-4 h-4 ${attentionCount > 0 ? 'text-orange-500' : 'text-muted-foreground/30'}`} />
                                <span className="text-[14px] font-bold text-foreground">Требует внимания</span>
                            </div>
                            <button className="p-1 rounded-lg hover:bg-sage-50 transition-colors text-muted-foreground/40"><MoreVertical className="w-4 h-4" /></button>
                        </div>
                        <div className="p-3 space-y-1.5">
                            {attentionCount === 0 ? (
                                <div className="text-center py-6 text-[13px] text-muted-foreground/50 font-medium">Всё в порядке ✓</div>
                            ) : (<>
                                {noConsentClients.length > 0 && (
                                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-red-50 hover:bg-red-100/50 transition-colors">
                                        <div className="w-7 h-7 rounded-lg bg-red-100 text-red-500 flex items-center justify-center shrink-0"><AlertTriangle className="w-3.5 h-3.5" /></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[12px] font-bold text-foreground">Нет согласия на обработку данных</div>
                                            <div className="text-[11px] text-muted-foreground">{noConsentClients.length} клиентов</div>
                                        </div>
                                        <button onClick={() => window.location.href = '/diary/clients'} className="text-[11px] font-bold text-primary flex items-center gap-0.5 shrink-0">Открыть <ChevronRight className="w-3 h-3" /></button>
                                    </div>
                                )}
                                {missingSessions.length > 0 && (
                                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100/50 transition-colors">
                                        <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0"><FileText className="w-3.5 h-3.5" /></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[12px] font-bold text-foreground">Домашние задания не заполнены</div>
                                            <div className="text-[11px] text-muted-foreground">{missingSessions.length} записи</div>
                                        </div>
                                        <button onClick={() => missingSessions[0] && setEditingSession(missingSessions[0])} className="text-[11px] font-bold text-primary flex items-center gap-0.5 shrink-0">Проверить <ChevronRight className="w-3 h-3" /></button>
                                    </div>
                                )}
                                {pendingSessions.length > 0 && (
                                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-orange-50 hover:bg-orange-100/50 transition-colors">
                                        <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-500 flex items-center justify-center shrink-0"><AlertTriangle className="w-3.5 h-3.5" /></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[12px] font-bold text-foreground">Оплата сессий не отмечена</div>
                                            <div className="text-[11px] text-muted-foreground">{pendingSessions.length} сессий</div>
                                        </div>
                                        <button onClick={() => pendingSessions[0] && setEditingSession(pendingSessions[0])} className="text-[11px] font-bold text-primary flex items-center gap-0.5 shrink-0">Проверить <ChevronRight className="w-3 h-3" /></button>
                                    </div>
                                )}
                            </>)}
                        </div>
                    </div>

                    {/* Активность клиентов */}
                    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-card">
                        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-forest-600" /><span className="text-[14px] font-bold text-foreground">Активность клиентов</span></div>
                            <span className="text-[11px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">+ Сейчас</span>
                        </div>
                        <div className="divide-y divide-border/30">
                            {activity.length === 0 ? (
                                <div className="py-6 text-center text-[13px] text-muted-foreground/50">Нет активности за 7 дней</div>
                            ) : activity.map((ev, i) => (
                                <div key={i} className="flex items-center gap-2.5 px-4 py-3 hover:bg-sage-50/50 transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center text-forest-700 font-bold text-[11px] shrink-0 uppercase border border-sage-200">
                                        {ev.clientName.slice(0, 2)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[12px] font-bold text-foreground truncate">{ev.clientName}</div>
                                        <div className="text-[11px] text-muted-foreground truncate">{ev.description}</div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(ev.at)}</span>
                                        {activityIcon(ev.type)}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => window.location.href = '/diary/clients'}
                            className="w-full flex items-center justify-between px-5 py-3 border-t border-border hover:bg-sage-50 transition-colors text-[12px] font-semibold text-forest-600">
                            Все события <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Статистика недели */}
                    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-card">
                        <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-forest-600" />
                            <span className="text-[14px] font-bold text-foreground">Статистика недели</span>
                        </div>
                        <div className="grid grid-cols-2 gap-px bg-border/40">
                            {[
                                { value: weekSessions.length, label: 'Сессий', delta: sessionsDelta },
                                { value: weekUniqueClients, label: 'Клиентов', delta: clientsDelta },
                                { value: `${workloadPercent}%`, label: 'Загрузка', delta: null },
                                { value: '—', label: 'Оценка', delta: null },
                            ].map(({ value, label, delta }) => (
                                <div key={label} className="bg-card p-4 text-center">
                                    <div className="text-[24px] font-bold text-foreground tabular-nums">{value}</div>
                                    <div className="text-[11px] text-muted-foreground font-medium mt-0.5">{label}</div>
                                    {delta !== null && (
                                        <div className={`text-[10px] font-bold mt-0.5 ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {delta >= 0 ? '+' : ''}{delta}%
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button onClick={() => window.location.href = '/diary/analytics'}
                            className="w-full flex items-center justify-between px-5 py-3 border-t border-border hover:bg-sage-50 transition-colors text-[12px] font-semibold text-forest-600">
                            Перейти к аналитике <ChevronRight className="w-3.5 h-3.5" />
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

            {/* Mobile FAB */}
            <button
                onClick={() => { setShowNewSession(true); setNewSessionDefaults({ date: selectedDate }); }}
                className="md:hidden fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-90 transition-transform hover:bg-forest-700"
                aria-label="Добавить запись"
            >
                <Plus className="w-6 h-6" />
            </button>
        </>
    );
}
