'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { getClientSessions, getClientSessionsById } from '../actions';
import { format, isToday, isTomorrow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Video, MapPin, X, Calendar as CalendarIcon } from 'lucide-react';
import { CancelSessionDialog } from '@/components/psidairy/CancelSessionDialog';

function ClientCalendar() {
    const [clientContext, setClientContext] = useState<{ id: string, name: string, isTelegram: boolean } | null>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [sessionToCancel, setSessionToCancel] = useState<any>(null);
    const [selectedSession, setSelectedSession] = useState<any>(null);

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
                setClientContext({
                    id: String(twa.initDataUnsafe.user.id),
                    name: twa.initDataUnsafe.user.first_name || 'Клиент',
                    isTelegram: true
                });
            } else {
                const savedClientId = localStorage.getItem('compas_clientId');
                if (savedClientId) {
                    setClientContext({ id: savedClientId, name: 'Мои записи', isTelegram: false });
                }
            }
        }
    }, []);

    const fetchSessions = useCallback(async () => {
        if (!clientContext) return;
        setLoading(true);
        try {
            let data = [];
            if (clientContext.isTelegram) {
                data = await getClientSessions(clientContext.id);
            } else {
                data = await getClientSessionsById(clientContext.id);
            }
            setSessions(data);
        } catch (e) {
            console.error('Failed to fetch sessions', e);
        } finally {
            setLoading(false);
        }
    }, [clientContext]);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    // Grouping sessions by date
    const groupedSessions = sessions.reduce((acc, curr) => {
        const dateStr = format(new Date(curr.date), 'yyyy-MM-dd');
        if (!acc[dateStr]) acc[dateStr] = [];
        acc[dateStr].push(curr);
        return acc;
    }, {} as Record<string, any[]>);

    const sortedDates = Object.keys(groupedSessions).sort();

    const getDateLabel = (dateStr: string) => {
        const date = new Date(dateStr);
        if (isToday(date)) return 'Сегодня';
        if (isTomorrow(date)) return 'Завтра';
        return format(date, 'd MMMM, EEEE', { locale: ru });
    };

    if (loading && !sessions.length) {
        return (
            <div className="flex items-center justify-center min-h-screen p-4 bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!clientContext) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
                <p className="text-muted-foreground text-center">Пожалуйста, откройте приложение через бота или перейдите по персональной ссылке от психолога.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground pb-20">
            {/* Header */}
            <div className="bg-card px-4 py-5 shadow-sm sticky top-0 z-20 border-b border-border/50">
                <h1 className="text-xl font-bold text-primary mb-1">Мои записи</h1>
                <p className="text-muted-foreground text-xs">
                    {clientContext.isTelegram ? `${clientContext.name}, здесь отображается ваше расписание. ` : 'Здесь отображается расписание всех ваших сессий. '}
                    <span className="font-bold text-foreground">Нажмите на карточку сессии</span>, чтобы отменить или перенести её.
                </p>
            </div>

            <div className="px-4 pt-6 space-y-6">
                {sortedDates.map(dateStr => (
                    <div key={dateStr} className="space-y-3">
                        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider pl-1">
                            {getDateLabel(dateStr)}
                        </h2>
                        <div className="space-y-2">
                            {groupedSessions[dateStr].map((session: any) => (
                                <button
                                    key={session.id}
                                    onClick={() => setSelectedSession(session)}
                                    className="w-full text-left bg-card rounded-2xl p-4 border border-border flex gap-4 transition-all hover:border-primary/30 haptic-light relative overflow-hidden"
                                >
                                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary/20"></div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-lg font-bold text-foreground">
                                                {session.time} {session.endTime && <span className="text-sm text-muted-foreground font-medium">- {session.endTime}</span>}
                                            </span>
                                            <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-muted/50 text-muted-foreground border border-border/50">
                                                {session.format === 'offline' ? (
                                                    <><MapPin className="w-3.5 h-3.5" /> Очно</>
                                                ) : (
                                                    <><Video className="w-3.5 h-3.5" /> Онлайн</>
                                                )}
                                            </span>
                                        </div>
                                        <div className="text-sm text-foreground/80 font-medium">
                                            Психолог: {session.psychologistName}
                                        </div>
                                        {session.address && session.format === 'offline' && (
                                            <div className="text-xs text-muted-foreground mt-1.5 line-clamp-1">
                                                📍 {session.address.name} — {session.address.fullAddress}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {sessions.length === 0 && !loading && (
                <div className="text-center py-16 px-6">
                    <div className="text-4xl mb-4 opacity-50 flex justify-center">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                            <CalendarIcon className="w-8 h-8 text-muted-foreground" />
                        </div>
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">Нет предстоящих сессий</h3>
                    <p className="text-sm text-muted-foreground mb-8">У вас пока нет запланированных встреч.</p>
                    <button
                        onClick={() => {
                            // @ts-ignore
                            window.Telegram?.WebApp?.close();
                        }}
                        className="w-full max-w-xs mx-auto py-3.5 rounded-xl border-2 font-bold text-base transition-all haptic-light border-[#1e3a2f] text-white dark:border-[#b89a4e] dark:text-gray-900 bg-[#1e3a2f] dark:bg-[#b89a4e] hover:opacity-90 active:scale-[0.98]"
                    >
                        Вернуться в бот
                    </button>
                </div>
            )}

            {/* Session Detail Modal */}
            {selectedSession && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200 backdrop-blur-sm">
                    <div className="bg-card rounded-t-3xl sm:rounded-3xl w-full max-w-md border border-border shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
                        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-border/50">
                            <h3 className="text-lg font-bold text-foreground">Детали записи</h3>
                            <button onClick={() => setSelectedSession(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-5">
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Дата и время</p>
                                <p className="font-bold text-foreground text-lg">
                                    {format(new Date(selectedSession.date), 'd MMMM yyyy', { locale: ru })}, {selectedSession.time} {selectedSession.endTime && `- ${selectedSession.endTime}`}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Специалист</p>
                                <p className="font-semibold text-foreground text-base">{selectedSession.psychologistName}</p>
                            </div>
                            <div className="flex flex-col gap-2 p-4 bg-muted/30 rounded-2xl border border-border/50">
                                <div className="flex items-center gap-2">
                                    {selectedSession.format === 'offline' ? (
                                        <><MapPin className="w-4 h-4 text-primary" /> <span className="text-sm font-bold text-foreground">Очная встреча</span></>
                                    ) : (
                                        <><Video className="w-4 h-4 text-primary" /> <span className="text-sm font-bold text-foreground">Онлайн-консультация</span></>
                                    )}
                                </div>
                                {selectedSession.format === 'offline' && selectedSession.address && (
                                    <div className="text-sm text-foreground mt-1 ml-6">
                                        <p className="font-semibold">{selectedSession.address.name}</p>
                                        <p className="text-muted-foreground mt-0.5 leading-snug">{selectedSession.address.fullAddress}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="px-6 pb-6 grid grid-cols-2 gap-3">
                            <button
                                onClick={() => {
                                    setSelectedSession(null);
                                    window.location.href = `/bot/book/${selectedSession.psychologistId}`;
                                }}
                                className="py-3 rounded-xl border-2 font-bold transition-colors text-sm hover:bg-muted haptic-light border-border text-foreground bg-transparent"
                            >
                                Перенести
                            </button>
                            <button
                                onClick={() => {
                                    setSessionToCancel(selectedSession);
                                    setSelectedSession(null);
                                }}
                                className="py-3 rounded-xl border-2 font-bold transition-colors text-sm border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10 haptic-light"
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
                    clientName={clientContext?.name || ''}
                />
            )}

            {/* Instruction Footer */}
            {!loading && (
                <div className="px-6 py-8 text-center mt-6">
                    <p className="text-sm text-muted-foreground/80 leading-relaxed font-medium">
                        Вы всегда можете вернуться на эту страницу по вашей персональной ссылке или через бота, чтобы управлять своими записями.
                    </p>
                </div>
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
