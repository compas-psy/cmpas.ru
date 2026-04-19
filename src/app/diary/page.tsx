'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Clock, User, Video, MapPin, ArrowRightLeft, Loader2, Link as LinkIcon, AlertTriangle, FileText, Sparkles } from 'lucide-react';
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
            <WelcomeStrip />

            {/* ── Экран «Сегодня» ── */}
            {(() => {
                const now = new Date();
                const todaySessions = sessions.filter(s => {
                    const d = new Date(s.date);
                    return isSameDay(d, now) && s.status !== 'cancelled';
                }).sort((a, b) => a.time.localeCompare(b.time));
                const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                const nextSession = todaySessions.find(s => s.time > currentTimeStr && s.status !== 'completed');
                const completedToday = todaySessions.filter(s => s.status === 'completed').length;
                const totalToday = todaySessions.length;
                const getMinutesUntil = (t: string) => { const [h, m] = t.split(':').map(Number); return (h * 60 + m) - (now.getHours() * 60 + now.getMinutes()); };
                const pendingSessions = sessions.filter(s => s.status === 'pending');
                const completedWithoutNotes = sessions.filter(s => {
                    if (s.status !== 'completed') return false;
                    const d = new Date(s.date); if (d > now) return false;
                    return Math.floor((now.getTime() - d.getTime()) / 86400000) <= 14 && !s.notes && !s.structuredNotes;
                });
                const attentionCount = pendingSessions.length + completedWithoutNotes.length;
                const timelineHours = Array.from({ length: 15 }, (_, i) => i + 8);
                return (<>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Сегодня</h1>
                            <p className="text-muted-foreground text-sm mt-1 font-medium capitalize">{now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {settings?.psychologistId && (<button onClick={() => { navigator.clipboard.writeText(`https://cmpas.ru/bot/book/${settings.psychologistId}`); toast.success('Ссылка скопирована'); }} className="p-2.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-xl transition-all" title="Скопировать ссылку"><LinkIcon className="w-4 h-4" /></button>)}
                            <button onClick={() => { setShowNewSession(true); setNewSessionDefaults({ date: selectedDate }); }} className="flex items-center gap-2 px-5 py-2.5 bg-accent text-accent-foreground rounded-xl shadow-sm hover:bg-accent/90 transition-all font-semibold active:scale-[0.97] text-sm"><Plus className="w-4 h-4" /> Запись</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><CalendarIcon className="w-5 h-5 text-primary" /></div><div><div className="text-2xl font-bold text-foreground">{totalToday}</div><div className="text-[11px] text-muted-foreground font-medium">Сессий сегодня</div></div></div>
                        <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><Clock className="w-5 h-5 text-emerald-600" /></div><div><div className="text-2xl font-bold text-foreground">{completedToday}</div><div className="text-[11px] text-muted-foreground font-medium">Проведено</div></div></div>
                        <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3"><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${attentionCount > 0 ? 'bg-amber-500/10' : 'bg-muted/50'}`}><AlertTriangle className={`w-5 h-5 ${attentionCount > 0 ? 'text-amber-600' : 'text-muted-foreground/30'}`} /></div><div><div className="text-2xl font-bold text-foreground">{attentionCount}</div><div className="text-[11px] text-muted-foreground font-medium">Внимание</div></div></div>
                        <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center"><User className="w-5 h-5 text-violet-600" /></div><div><div className="text-2xl font-bold text-foreground">{clients.length}</div><div className="text-[11px] text-muted-foreground font-medium">Клиентов</div></div></div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 bg-card rounded-2xl border border-border overflow-hidden">
                            <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
                                <span className="font-bold text-foreground text-sm">Таймлайн дня</span>
                                {totalToday > 0 && (<div className="flex items-center gap-2"><div className="h-1.5 w-24 bg-muted/50 rounded-full overflow-hidden"><div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${(completedToday / totalToday) * 100}%` }} /></div><span className="text-[10px] font-bold text-muted-foreground">{completedToday}/{totalToday}</span></div>)}
                            </div>
                            {totalToday === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 px-4">
                                    <div className="w-16 h-16 bg-accent/10 rounded-3xl flex items-center justify-center mb-4"><Sparkles className="w-8 h-8 text-accent" /></div>
                                    <div className="text-lg font-bold text-foreground mb-1">Свободный день</div>
                                    <div className="text-sm text-muted-foreground text-center max-w-xs">Нет запланированных сессий на сегодня</div>
                                    <button onClick={() => { setShowNewSession(true); setNewSessionDefaults({ date: selectedDate }); }} className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-accent/10 text-accent rounded-xl text-sm font-bold hover:bg-accent/20 transition-all"><Plus className="w-4 h-4" /> Добавить запись</button>
                                </div>
                            ) : (
                                <div className="relative px-4 py-3">
                                    {(() => { const ch = now.getHours(), cm = now.getMinutes(); if (ch >= 8 && ch < 23) { const top = ((ch - 8) * 56) + (cm / 60) * 56; return (<div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: `${top + 12}px` }}><div className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1 shrink-0" /><div className="h-px flex-1 bg-red-500/40" /></div></div>); } return null; })()}
                                    {timelineHours.map(hour => {
                                        const hourStr = `${String(hour).padStart(2, '0')}:00`;
                                        const atHour = todaySessions.filter(s => { const [sh] = s.time.split(':').map(Number); return sh === hour; });
                                        return (<div key={hour} className="flex items-start gap-3 h-14 border-t border-border/30 first:border-t-0">
                                            <span className="text-[10px] font-medium text-muted-foreground/60 w-10 pt-1 shrink-0 text-right">{hourStr}</span>
                                            <div className="flex-1 flex gap-2 pt-1 overflow-hidden">
                                                {atHour.map(s => { const cn = s.client?.name || clients.find(c => c.id === s.clientId)?.name || 'Клиент'; const done = s.status === 'completed'; const past = s.time < currentTimeStr; const isN = nextSession?.id === s.id;
                                                    return (<button key={s.id} onClick={() => setEditingSession(s)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] truncate ${isN ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20' : done ? 'bg-emerald-500/10 text-emerald-700 line-through opacity-60' : past ? 'bg-muted/50 text-muted-foreground' : 'bg-accent/10 text-accent-foreground hover:bg-accent/20'}`}>
                                                        {isN && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />}<span className="truncate">{s.time} {cn}</span>{s.format === 'online' && <Video className="w-3 h-3 shrink-0 opacity-60" />}
                                                    </button>); })}
                                            </div>
                                        </div>);
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="space-y-4">
                            {nextSession && (() => { const cn = nextSession.client?.name || clients.find(c => c.id === nextSession.clientId)?.name || 'Клиент'; const mu = getMinutesUntil(nextSession.time); const close = mu <= 15;
                                return (<div className={`bg-card rounded-2xl border overflow-hidden ${close ? 'border-primary/30 shadow-sm shadow-primary/5' : 'border-border'}`}>
                                    <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between"><span className={`text-[10px] font-bold uppercase tracking-wider ${close ? 'text-primary' : 'text-muted-foreground'}`}>{close ? '● Скоро' : 'Следующая'}</span><span className={`text-lg font-bold ${close ? 'text-primary' : 'text-foreground'}`}>{mu > 0 ? mu : 0} мин</span></div>
                                    <div className="p-4"><div className="font-bold text-foreground text-base mb-1">{cn}</div><div className="flex items-center gap-2 text-xs text-muted-foreground font-medium"><Clock className="w-3.5 h-3.5" /><span>{nextSession.time} – {nextSession.endTime || ''}</span><span>·</span><span>{nextSession.duration} мин</span></div><div className="flex gap-2 mt-3"><button onClick={() => setEditingSession(nextSession)} className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-all active:scale-[0.97]">Открыть</button></div></div>
                                </div>); })()}
                            <div className="bg-card rounded-2xl border border-border overflow-hidden">
                                <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between"><div className="flex items-center gap-2"><AlertTriangle className={`w-4 h-4 ${attentionCount > 0 ? 'text-amber-600' : 'text-muted-foreground/30'}`} /><span className="text-sm font-bold text-foreground">Внимание</span></div>{attentionCount > 0 && (<span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md">{attentionCount}</span>)}</div>
                                <div className="p-3 space-y-1 max-h-64 overflow-auto">
                                    {attentionCount === 0 ? (<div className="text-center py-6 text-sm text-muted-foreground/50 font-medium">Всё в порядке ✓</div>) : (<>{pendingSessions.map(s => (<button key={`p-${s.id}`} onClick={() => setEditingSession(s)} className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-muted/50 transition-colors text-left"><div className="w-6 h-6 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0"><Clock className="w-3 h-3" /></div><div className="flex-1 min-w-0"><div className="text-xs font-semibold text-foreground truncate">{s.client?.name || 'Клиент'}</div><div className="text-[10px] text-muted-foreground">Ожидает · {s.time}</div></div></button>))}{completedWithoutNotes.map(s => (<button key={`n-${s.id}`} onClick={() => setEditingSession(s)} className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-muted/50 transition-colors text-left"><div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0"><FileText className="w-3 h-3" /></div><div className="flex-1 min-w-0"><div className="text-xs font-semibold text-foreground truncate">{s.client?.name || 'Клиент'}</div><div className="text-[10px] text-muted-foreground">Нет заметок</div></div></button>))}</>)}
                                </div>
                            </div>
                            <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
                                <button onClick={() => window.location.href = '/diary/availability'} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors text-left text-sm font-medium text-foreground"><Clock className="w-4 h-4 text-muted-foreground" /> Расписание</button>
                                <button onClick={() => window.location.href = '/diary/clients'} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors text-left text-sm font-medium text-foreground"><User className="w-4 h-4 text-muted-foreground" /> Клиенты</button>
                            </div>
                        </div>
                    </div>
                </>);
            })()}


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
