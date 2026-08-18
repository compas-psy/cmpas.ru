'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { format, isToday, isTomorrow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Video, MapPin, X, Calendar as CalendarIcon, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { CancelSessionDialog } from '@/components/psidairy/CancelSessionDialog';

function ClientCalendar() {
    const [clientContext, setClientContext] = useState<{ id: string, name: string, isTelegram: boolean } | null>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [sessionToCancel, setSessionToCancel] = useState<any>(null);
    const [selectedSession, setSelectedSession] = useState<any>(null);
    const [consentRevokedAt, setConsentRevokedAt] = useState<string | null>(null);
    const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
    const [revoking, setRevoking] = useState(false);

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
            const params = new URLSearchParams(
                clientContext.isTelegram
                    ? { telegramChatId: clientContext.id }
                    : { clientId: clientContext.id }
            );
            const response = await fetch(`/api/user/diary/bot/client/sessions?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch sessions');
            const data = await response.json();
            const list = Array.isArray(data) ? data : [];
            setSessions(list);
            setConsentRevokedAt(list[0]?.clientConsentRevokedAt ?? null);
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

    // Working revoke button (legal/CLIENT_CONSENT_BASIS.md §3, CJM_booking_v2.md §7
    // point 4). Every session in the list belongs to the same (clientId,
    // psychologistId) pair — /api/user/diary/bot/client/sessions resolves a
    // single clientId per page load — so the first row carries what's needed.
    const handleRevokeConsent = async () => {
        const first = sessions[0];
        if (!first) return;
        setRevoking(true);
        try {
            const res = await fetch('/api/user/diary/bot/client/consent-revoke', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: first.clientId,
                    psychologistId: first.psychologistId,
                    clientToken: first.clientToken,
                }),
            });
            if (!res.ok) throw new Error('Failed to revoke consent');
            setConsentRevokedAt(new Date().toISOString());
            setShowRevokeConfirm(false);
            toast.success('Согласие отозвано. Ваши предстоящие встречи не отменены.');
        } catch (e) {
            toast.error('Не удалось отозвать согласие, попробуйте ещё раз');
        } finally {
            setRevoking(false);
        }
    };

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

            {/* Consent management (legal/CLIENT_CONSENT_BASIS.md §3) */}
            {sessions[0] && (
                <div className="px-4 pt-4">
                    {consentRevokedAt ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border border-border/50 rounded-xl px-3.5 py-2.5">
                            <ShieldOff className="w-3.5 h-3.5 flex-shrink-0" />
                            Согласие на обработку данных отозвано {format(new Date(consentRevokedAt), 'd MMMM', { locale: ru })}. Новая запись через эту страницу недоступна, пока согласие не будет дано заново.
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowRevokeConfirm(true)}
                            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                        >
                            Отозвать согласие на обработку данных
                        </button>
                    )}
                </div>
            )}

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

                        {selectedSession.format === 'online' && selectedSession.onlineSessionLink && (
                            <div className="px-6 pb-4">
                                <a 
                                    href={selectedSession.onlineSessionLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex w-full items-center justify-center py-3.5 rounded-xl border-2 font-bold transition-colors text-sm bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:border-primary/90 haptic-light"
                                >
                                    Присоединиться к встрече
                                </a>
                            </div>
                        )}

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
                    clientId={sessionToCancel.clientId}
                    clientToken={sessionToCancel.clientToken}
                />
            )}

            {showRevokeConfirm && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
                    <div className="bg-card rounded-t-3xl sm:rounded-3xl w-full max-w-md border border-border shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
                        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-border/50">
                            <h3 className="text-lg font-bold text-foreground">Отозвать согласие?</h3>
                            <button onClick={() => setShowRevokeConfirm(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                        </div>
                        <div className="px-6 py-5 text-sm text-foreground/90 leading-relaxed space-y-2">
                            <p>Специалист будет уведомлён. Ваши уже запланированные встречи не отменяются — сервисные напоминания о них продолжат приходить.</p>
                            <p className="text-muted-foreground">Записаться снова через эту страницу можно будет только после того, как вы дадите согласие заново.</p>
                        </div>
                        <div className="px-6 pb-6 grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setShowRevokeConfirm(false)}
                                className="py-3 rounded-xl border-2 font-bold transition-colors text-sm hover:bg-muted haptic-light border-border text-foreground bg-transparent"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleRevokeConsent}
                                disabled={revoking}
                                className="py-3 rounded-xl border-2 font-bold transition-colors text-sm border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10 haptic-light disabled:opacity-50"
                            >
                                {revoking ? 'Отзываем...' : 'Отозвать'}
                            </button>
                        </div>
                    </div>
                </div>
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
