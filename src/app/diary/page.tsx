'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Calendar as CalendarIcon, Plus, Clock, User, Video, MapPin,
    Loader2, Link as LinkIcon, AlertTriangle, FileText, Sparkles,
    ChevronRight, ArrowUpRight, Coffee, Users, TrendingUp
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

    const nextSession = useMemo(() =>
        todaySessions.find(s => s.time > currentTimeStr && s.status !== 'completed'),
        [todaySessions, currentTimeStr]
    );

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

            {/* ── HEADER ── */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <h1 className="text-[32px] md:text-[40px] font-bold tracking-tight text-foreground leading-[1.1]">
                        {getGreeting()}{userName ? `, ${userName}` : ''} 👋
                    </h1>
                    <p className="text-muted-foreground text-[15px] mt-2 font-medium capitalize">
                        {now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-2.5 self-start md:self-auto">
                    {settings?.psychologistId && (
                        <button
                            onClick={() => { navigator.clipboard.writeText(`https://cmpas.ru/bot/book/${settings.psychologistId}`); toast.success('Ссылка скопирована'); }}
                            className="p-2.5 bg-card border border-border text-muted-foreground hover:text-foreground hover:border-border/80 rounded-xl transition-all shadow-card"
                            title="Скопировать ссылку на запись"
                        >
                            <LinkIcon className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={() => { setShowNewSession(true); setNewSessionDefaults({ date: selectedDate }); }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl shadow-card hover:bg-forest-700 transition-all font-semibold active:scale-[0.97] text-sm"
                    >
                        <Plus className="w-4 h-4" /> Запись
                    </button>
                </div>
            </div>

            {/* ── MINI STATS ROW ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-card rounded-2xl border border-border p-4 shadow-card flex items-center gap-3.5 hover:shadow-card-hover transition-shadow">
                    <div className="w-11 h-11 rounded-xl bg-sage-100 flex items-center justify-center">
                        <CalendarIcon className="w-5 h-5 text-forest-700" />
                    </div>
                    <div>
                        <div className="text-kpi-number text-foreground">{totalToday}</div>
                        <div className="text-small-meta text-muted-foreground">Сессий сегодня</div>
                    </div>
                </div>
                <div className="bg-card rounded-2xl border border-border p-4 shadow-card flex items-center gap-3.5 hover:shadow-card-hover transition-shadow">
                    <div className="w-11 h-11 rounded-xl bg-success-soft flex items-center justify-center">
                        <Clock className="w-5 h-5 text-success-500" />
                    </div>
                    <div>
                        <div className="text-kpi-number text-foreground">{completedToday}</div>
                        <div className="text-small-meta text-muted-foreground">Проведено</div>
                    </div>
                </div>
                <div className="bg-card rounded-2xl border border-border p-4 shadow-card flex items-center gap-3.5 hover:shadow-card-hover transition-shadow">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${attentionCount > 0 ? 'bg-orange-soft' : 'bg-sage-50'}`}>
                        <AlertTriangle className={`w-5 h-5 ${attentionCount > 0 ? 'text-orange-500' : 'text-muted-foreground/30'}`} />
                    </div>
                    <div>
                        <div className="text-kpi-number text-foreground">{attentionCount}</div>
                        <div className="text-small-meta text-muted-foreground">Внимание</div>
                    </div>
                </div>
                <div className="bg-card rounded-2xl border border-border p-4 shadow-card flex items-center gap-3.5 hover:shadow-card-hover transition-shadow">
                    <div className="w-11 h-11 rounded-xl bg-violet-soft flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-violet-500" />
                    </div>
                    <div>
                        <div className="text-kpi-number text-foreground">{weekSessions.length}</div>
                        <div className="text-small-meta text-muted-foreground">За неделю</div>
                    </div>
                </div>
            </div>

            {/* ── MAIN CONTENT GRID ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* ── LEFT: Next Session + Timeline (2 cols) ── */}
                <div className="lg:col-span-2 space-y-5">

                    {/* NOW / Next Session Card */}
                    {nextSession && (() => {
                        const cn = nextSession.client?.name || clients.find(c => c.id === nextSession.clientId)?.name || 'Клиент';
                        const mu = getMinutesUntil(nextSession.time);
                        const close = mu <= 15;
                        const FormatInfo = formatLabels[nextSession.format] || formatLabels.online;
                        const FormatIcon = FormatInfo.icon;
                        const sessionNum = todaySessions.indexOf(nextSession) + 1;

                        return (
                            <div className={`bg-card rounded-2xl border overflow-hidden shadow-card transition-all ${close ? 'border-primary/40 ring-1 ring-primary/10' : 'border-border'}`}>
                                <div className="p-5 md:p-6">
                                    {/* Header line */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-2.5 h-2.5 rounded-full ${close ? 'bg-primary animate-pulse' : 'bg-sage-200'}`} />
                                            <span className="text-small-meta text-muted-foreground font-bold uppercase tracking-wider">
                                                {close ? 'Скоро начнётся' : 'Следующая сессия'}
                                            </span>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-[13px] font-bold tabular-nums ${close ? 'bg-primary/10 text-primary' : 'bg-sage-100 text-muted-foreground'}`}>
                                            {mu > 0 ? `через ${mu} мин` : 'Сейчас'}
                                        </div>
                                    </div>

                                    {/* Client + session info */}
                                    <div className="flex items-start gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-sage-100 flex items-center justify-center text-forest-700 font-bold text-lg shrink-0 uppercase border border-sage-200">
                                            {cn.slice(0, 2)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-[20px] font-bold text-foreground mb-1 truncate">{cn}</h3>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-secondary text-muted-foreground">
                                                <span className="flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {nextSession.time} – {nextSession.endTime || ''} · {nextSession.duration} мин
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <FormatIcon className="w-3.5 h-3.5" />
                                                    {FormatInfo.label}
                                                </span>
                                                <span className="text-small-meta font-semibold text-forest-600">
                                                    Сессия #{sessionNum}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2.5 mt-5">
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
                                                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-soft text-blue-500 rounded-xl text-[14px] font-bold hover:bg-blue-500/15 transition-all active:scale-[0.97]"
                                            >
                                                <Video className="w-4 h-4" /> Zoom
                                                <ArrowUpRight className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* TIMELINE */}
                    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-card">
                        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <span className="text-[15px] font-bold text-foreground">Таймлайн дня</span>
                                {totalToday > 0 && (
                                    <span className="text-small-meta text-muted-foreground font-semibold bg-sage-100 px-2 py-0.5 rounded-md">
                                        {completedToday}/{totalToday}
                                    </span>
                                )}
                            </div>
                            {totalToday > 0 && (
                                <div className="h-1.5 w-20 md:w-28 bg-sage-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-forest-600 rounded-full transition-all duration-500" style={{ width: `${(completedToday / totalToday) * 100}%` }} />
                                </div>
                            )}
                        </div>

                        {totalToday === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 px-4">
                                <div className="w-16 h-16 bg-sage-100 rounded-3xl flex items-center justify-center mb-4">
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
                            <div className="relative px-4 py-3">
                                {/* Current time indicator */}
                                {(() => {
                                    const ch = now.getHours(), cm = now.getMinutes();
                                    if (ch >= 8 && ch < 23) {
                                        const top = ((ch - 8) * 56) + (cm / 60) * 56;
                                        return (
                                            <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: `${top + 12}px` }}>
                                                <div className="flex items-center">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1 shrink-0 shadow-sm" />
                                                    <div className="h-[1.5px] flex-1 bg-red-500/30" />
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                                {timelineHours.map(hour => {
                                    const hourStr = `${String(hour).padStart(2, '0')}:00`;
                                    const atHour = todaySessions.filter(s => { const [sh] = s.time.split(':').map(Number); return sh === hour; });
                                    return (
                                        <div key={hour} className="flex items-start gap-3 h-14 border-t border-border/30 first:border-t-0">
                                            <span className="text-[11px] font-medium text-muted-foreground/50 w-10 pt-1 shrink-0 text-right tabular-nums">{hourStr}</span>
                                            <div className="flex-1 flex gap-2 pt-1 overflow-hidden">
                                                {atHour.map(s => {
                                                    const cn = s.client?.name || clients.find(c => c.id === s.clientId)?.name || 'Клиент';
                                                    const done = s.status === 'completed';
                                                    const past = s.time < currentTimeStr;
                                                    const isN = nextSession?.id === s.id;

                                                    return (
                                                        <button
                                                            key={s.id}
                                                            onClick={() => setEditingSession(s)}
                                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.97] truncate ${
                                                                isN
                                                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                                                    : done
                                                                        ? 'bg-sage-100 text-muted-foreground line-through opacity-60'
                                                                        : past
                                                                            ? 'bg-sage-50 text-muted-foreground'
                                                                            : 'bg-forest-800/5 text-forest-800 hover:bg-forest-800/10'
                                                            }`}
                                                        >
                                                            {isN && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />}
                                                            <span className="truncate">{s.time} {cn}</span>
                                                            {s.format === 'online' && <Video className="w-3 h-3 shrink-0 opacity-60" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
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
                            {attentionCount > 0 && (
                                <span className="min-w-[24px] h-[24px] flex items-center justify-center rounded-full text-[12px] font-bold bg-orange-soft text-orange-500 px-1.5">
                                    {attentionCount}
                                </span>
                            )}
                        </div>
                        <div className="p-3 space-y-1 max-h-72 overflow-auto telegram-miniapp-scrollbar-hide">
                            {attentionCount === 0 ? (
                                <div className="text-center py-8 text-body-secondary text-muted-foreground/50 font-medium">
                                    Всё в порядке ✓
                                </div>
                            ) : (
                                <>
                                    {pendingSessions.map(s => (
                                        <button key={`p-${s.id}`} onClick={() => setEditingSession(s)}
                                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-sage-50 transition-colors text-left group"
                                        >
                                            <div className="w-8 h-8 rounded-xl bg-orange-soft text-orange-500 flex items-center justify-center shrink-0">
                                                <Clock className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[13px] font-semibold text-foreground truncate">{s.client?.name || 'Клиент'}</div>
                                                <div className="text-small-meta text-muted-foreground">Ожидает подтверждения · {s.time}</div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                                        </button>
                                    ))}
                                    {completedWithoutNotes.map(s => (
                                        <button key={`n-${s.id}`} onClick={() => setEditingSession(s)}
                                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-sage-50 transition-colors text-left group"
                                        >
                                            <div className="w-8 h-8 rounded-xl bg-amber-400/10 text-amber-500 flex items-center justify-center shrink-0">
                                                <FileText className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[13px] font-semibold text-foreground truncate">{s.client?.name || 'Клиент'}</div>
                                                <div className="text-small-meta text-muted-foreground">Нет заметок после сессии</div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Week Stats */}
                    <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
                        <h3 className="text-[15px] font-bold text-foreground mb-4">Статистика недели</h3>
                        <div className="space-y-3.5">
                            <div className="flex items-center justify-between">
                                <span className="text-body-secondary text-muted-foreground">Всего сессий</span>
                                <span className="text-[15px] font-bold text-foreground tabular-nums">{weekSessions.length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-body-secondary text-muted-foreground">Завершено</span>
                                <span className="text-[15px] font-bold text-success-500 tabular-nums">{weekSessions.filter(s => s.status === 'completed').length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-body-secondary text-muted-foreground">Отменено</span>
                                <span className="text-[15px] font-bold text-red-500 tabular-nums">{sessions.filter(s => {
                                    const d = new Date(s.date);
                                    const startOfWeek = new Date(now);
                                    startOfWeek.setDate(now.getDate() - (now.getDay() + 6) % 7);
                                    const endOfWeek = new Date(startOfWeek);
                                    endOfWeek.setDate(startOfWeek.getDate() + 6);
                                    return d >= startOfWeek && d <= endOfWeek && s.status === 'cancelled';
                                }).length}</span>
                            </div>
                            <div className="h-px bg-border" />
                            <div className="flex items-center justify-between">
                                <span className="text-body-secondary text-muted-foreground">Активных клиентов</span>
                                <span className="text-[15px] font-bold text-foreground tabular-nums">{clients.length}</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
                        <button
                            onClick={() => window.location.href = '/diary/calendar'}
                            className="w-full flex items-center gap-3 p-4 hover:bg-sage-50 transition-colors text-left border-b border-border/50"
                        >
                            <CalendarIcon className="w-4.5 h-4.5 text-forest-600" />
                            <span className="text-body-primary text-foreground font-medium flex-1">Календарь</span>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                        </button>
                        <button
                            onClick={() => window.location.href = '/diary/availability'}
                            className="w-full flex items-center gap-3 p-4 hover:bg-sage-50 transition-colors text-left border-b border-border/50"
                        >
                            <Clock className="w-4.5 h-4.5 text-forest-600" />
                            <span className="text-body-primary text-foreground font-medium flex-1">Расписание</span>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                        </button>
                        <button
                            onClick={() => window.location.href = '/diary/clients'}
                            className="w-full flex items-center gap-3 p-4 hover:bg-sage-50 transition-colors text-left"
                        >
                            <User className="w-4.5 h-4.5 text-forest-600" />
                            <span className="text-body-primary text-foreground font-medium flex-1">Клиенты</span>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
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
