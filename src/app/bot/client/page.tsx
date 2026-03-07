'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { getClientSessions } from '../actions';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, isToday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Video, MapPin, Clock, X } from 'lucide-react';
import { CancelSessionDialog } from '@/components/psidairy/CancelSessionDialog';

function ClientCalendar() {
    const [initData, setInitData] = useState<any>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [sessionToCancel, setSessionToCancel] = useState<any>(null);
    const [selectedSession, setSelectedSession] = useState<any>(null);

    // Week navigation
    const [currentWeekStart, setCurrentWeekStart] = useState(() =>
        startOfWeek(new Date(), { weekStartsOn: 1 })
    );

    useEffect(() => {
        // @ts-ignore
        const twa = window.Telegram?.WebApp;
        if (twa) {
            twa.ready();
            twa.expand();
            setTheme(twa.colorScheme || 'light');
            if (twa.colorScheme === 'dark') {
                document.documentElement.classList.add('dark');
            }
            if (twa.initDataUnsafe?.user) {
                setInitData(twa.initDataUnsafe.user);
            } else {
                // Mock for testing
                setInitData({ id: process.env.NEXT_PUBLIC_TEST_TG_ID || '182398258', first_name: 'Test Client' });
            }
        }
    }, []);

    const fetchSessions = useCallback(async () => {
        if (!initData?.id) return;
        setLoading(true);
        try {
            const data = await getClientSessions(String(initData.id));
            setSessions(data);
        } catch (e) {
            console.error('Failed to fetch sessions', e);
        } finally {
            setLoading(false);
        }
    }, [initData]);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

    const getSessionsForDay = (day: Date) => {
        return sessions.filter(s => isSameDay(new Date(s.date), day));
    };

    const goToPrevWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
    const goToNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
    const goToCurrentWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

    // Time slots from 8:00 to 21:00
    const timeSlots = Array.from({ length: 14 }, (_, i) => i + 8);

    const getSessionPosition = (session: any) => {
        const [h, m] = session.time.split(':').map(Number);
        const topPercent = ((h - 8) * 60 + m) / (14 * 60) * 100;
        const duration = 50; // default
        const heightPercent = duration / (14 * 60) * 100;
        return { top: `${topPercent}%`, height: `${Math.max(heightPercent, 3.5)}%` };
    };

    if (loading && !sessions.length) {
        return (
            <div className="flex items-center justify-center min-h-screen p-4 bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!initData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
                <p className="text-muted-foreground text-center">Пожалуйста, откройте это приложение через Telegram бота.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground pb-20">
            {/* Header */}
            <div className="bg-card px-4 py-5 shadow-sm sticky top-0 z-20">
                <h1 className="text-xl font-bold text-primary mb-1">Мои записи</h1>
                <p className="text-muted-foreground text-xs">
                    {initData.first_name}, здесь отображается ваше расписание
                </p>
            </div>

            {/* Week Navigation */}
            <div className="bg-card border-b border-border px-4 py-3 sticky top-[76px] z-10">
                <div className="flex items-center justify-between mb-3">
                    <button onClick={goToPrevWeek} className="p-2 rounded-xl hover:bg-muted transition-colors haptic-light">
                        <ChevronLeft className="w-5 h-5 text-foreground" />
                    </button>
                    <button
                        onClick={goToCurrentWeek}
                        className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                    >
                        {format(currentWeekStart, 'd MMM', { locale: ru })} — {format(addDays(currentWeekStart, 6), 'd MMM yyyy', { locale: ru })}
                    </button>
                    <button onClick={goToNextWeek} className="p-2 rounded-xl hover:bg-muted transition-colors haptic-light">
                        <ChevronRight className="w-5 h-5 text-foreground" />
                    </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1">
                    {weekDays.map((day, i) => {
                        const daySessions = getSessionsForDay(day);
                        const today = isToday(day);
                        return (
                            <div key={i} className="text-center">
                                <p className={`text-[10px] font-medium mb-1 ${today ? 'text-primary' : 'text-muted-foreground'}`}>
                                    {format(day, 'EE', { locale: ru })}
                                </p>
                                <div className={`relative w-8 h-8 mx-auto rounded-lg flex items-center justify-center text-xs font-semibold transition-colors ${today
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-foreground'
                                    }`}>
                                    {format(day, 'd')}
                                    {daySessions.length > 0 && (
                                        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Weekly Timeline */}
            <div className="px-2 pt-2">
                <div className="grid grid-cols-[40px_1fr] gap-0">
                    {/* Time labels */}
                    <div className="relative" style={{ height: `${14 * 48}px` }}>
                        {timeSlots.map(hour => (
                            <div
                                key={hour}
                                className="absolute left-0 w-full text-[10px] text-muted-foreground font-medium"
                                style={{ top: `${((hour - 8) / 14) * 100}%` }}
                            >
                                {String(hour).padStart(2, '0')}:00
                            </div>
                        ))}
                    </div>

                    {/* Days grid */}
                    <div className="grid grid-cols-7 gap-px bg-border/30 rounded-xl overflow-hidden">
                        {weekDays.map((day, dayIndex) => {
                            const daySessions = getSessionsForDay(day);
                            const today = isToday(day);
                            return (
                                <div
                                    key={dayIndex}
                                    className={`relative ${today ? 'bg-primary/5' : 'bg-card'}`}
                                    style={{ height: `${14 * 48}px` }}
                                >
                                    {/* Hour grid lines */}
                                    {timeSlots.map(hour => (
                                        <div
                                            key={hour}
                                            className="absolute left-0 right-0 border-t border-border/30"
                                            style={{ top: `${((hour - 8) / 14) * 100}%` }}
                                        />
                                    ))}

                                    {/* Sessions */}
                                    {daySessions.map(session => {
                                        const pos = getSessionPosition(session);
                                        return (
                                            <button
                                                key={session.id}
                                                onClick={() => setSelectedSession(session)}
                                                className="absolute left-0.5 right-0.5 rounded-md px-0.5 py-0.5 text-[9px] font-medium overflow-hidden transition-all hover:opacity-80 haptic-light"
                                                style={{
                                                    ...pos,
                                                    backgroundColor: session.format === 'offline'
                                                        ? 'rgba(30, 58, 47, 0.15)'
                                                        : 'rgba(30, 58, 47, 0.1)',
                                                    borderLeft: session.format === 'offline'
                                                        ? '2px solid #1e3a2f'
                                                        : '2px solid #b89a4e',
                                                }}
                                            >
                                                <span className="block truncate text-foreground/80">
                                                    {session.time}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Session list (compact) below calendar */}
            {sessions.length > 0 && (
                <div className="px-4 pt-6 pb-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-primary" />
                        Предстоящие ({sessions.length})
                    </h3>
                    <div className="space-y-2">
                        {sessions.slice(0, 5).map(session => (
                            <button
                                key={session.id}
                                onClick={() => setSelectedSession(session)}
                                className="w-full text-left bg-card rounded-xl p-3 border border-border shadow-sm hover:border-primary/30 transition-all haptic-light"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm text-foreground">
                                            {format(new Date(session.date), 'd MMM, EEEE', { locale: ru })}
                                        </p>
                                        <p className="text-primary font-medium text-sm">{session.time}</p>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                                        {session.format === 'offline' ? (
                                            <><MapPin className="w-3 h-3" /> Очно</>
                                        ) : (
                                            <><Video className="w-3 h-3" /> Онлайн</>
                                        )}
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {session.psychologistName}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {sessions.length === 0 && !loading && (
                <div className="text-center py-16 px-6">
                    <div className="text-4xl mb-3 opacity-50">🗓</div>
                    <h3 className="text-lg font-medium text-foreground mb-2">Нет предстоящих сессий</h3>
                    <p className="text-sm text-muted-foreground mb-6">Запишитесь на консультацию прямо сейчас</p>
                    <button
                        onClick={() => {
                            // @ts-ignore
                            window.Telegram?.WebApp?.close();
                        }}
                        className="w-full max-w-xs mx-auto py-3.5 rounded-xl border-2 font-bold text-base transition-all haptic-light border-[#1e3a2f] text-white dark:border-[#b89a4e] dark:text-gray-900 bg-[#1e3a2f] dark:bg-[#b89a4e] hover:opacity-90 shadow-sm active:scale-[0.98]"
                    >
                        Вернуться в бот
                    </button>
                </div>
            )}

            {/* Session Detail Modal */}
            {selectedSession && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
                    <div className="bg-card rounded-t-3xl sm:rounded-3xl w-full max-w-md border border-border shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
                        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-border/50">
                            <h3 className="text-lg font-bold text-foreground">Детали записи</h3>
                            <button onClick={() => setSelectedSession(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Дата и время</p>
                                <p className="font-bold text-foreground text-lg">
                                    {format(new Date(selectedSession.date), 'd MMMM yyyy', { locale: ru })}, {selectedSession.time}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Специалист</p>
                                <p className="font-semibold text-foreground">{selectedSession.psychologistName}</p>
                            </div>
                            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl border border-border/50">
                                {selectedSession.format === 'offline' ? (
                                    <><MapPin className="w-4 h-4 text-primary" /> <span className="text-sm font-medium">Очная встреча</span></>
                                ) : (
                                    <><Video className="w-4 h-4 text-primary" /> <span className="text-sm font-medium">Онлайн-консультация</span></>
                                )}
                            </div>
                        </div>

                        <div className="px-6 pb-6 grid grid-cols-2 gap-3">
                            <button
                                onClick={() => {
                                    setSelectedSession(null);
                                    // Navigate to booking for reschedule
                                    window.location.href = `/bot/book/${selectedSession.psychologistId}`;
                                }}
                                className="py-2.5 rounded-xl border-2 font-medium transition-colors text-sm hover:bg-[#1e3a2f]/10 dark:hover:bg-[#b89a4e]/10 haptic-light border-[#1e3a2f] text-[#1e3a2f] dark:border-[#b89a4e] dark:text-[#b89a4e] bg-transparent"
                            >
                                Перенести
                            </button>
                            <button
                                onClick={() => {
                                    setSessionToCancel(selectedSession);
                                    setSelectedSession(null);
                                }}
                                className="py-2.5 rounded-xl border-2 font-medium transition-colors text-sm border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10 haptic-light"
                            >
                                Отменить
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {sessionToCancel && (
                <CancelSessionDialog
                    isOpen={!!sessionToCancel}
                    onClose={() => setSessionToCancel(null)}
                    onConfirm={async () => {
                        await fetchSessions();
                        setSessionToCancel(null);
                    }}
                    sessionId={sessionToCancel.id}
                    sessionDate={format(new Date(sessionToCancel.date), 'dd.MM')}
                    sessionTime={sessionToCancel.time}
                    clientName={initData.first_name}
                />
            )}
        </div>
    );
}

export default function Page() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ClientCalendar />
        </Suspense>
    );
}
