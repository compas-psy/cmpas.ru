'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { format, isToday, isTomorrow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Video, MapPin, X, Calendar as CalendarIcon } from 'lucide-react';
import { CancelSessionDialog } from '@/components/psidairy/CancelSessionDialog';
import { resolveClientLinkParam } from '@/app/bot/actions';

type Tab = 'upcoming' | 'past';

function groupByDate(list: any[]) {
    return list.reduce((acc, curr) => {
        const dateStr = format(new Date(curr.date), 'yyyy-MM-dd');
        if (!acc[dateStr]) acc[dateStr] = [];
        acc[dateStr].push(curr);
        return acc;
    }, {} as Record<string, any[]>);
}

function ClientCalendar() {
    const searchParams = useSearchParams();
    const [clientContext, setClientContext] = useState<{ id: string, name: string, isTelegram: boolean } | null>(null);
    const [contextLoading, setContextLoading] = useState(true);
    const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
    const [pastSessions, setPastSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [tab, setTab] = useState<Tab>('upcoming');
    const [sessionToCancel, setSessionToCancel] = useState<any>(null);
    const [selectedSession, setSelectedSession] = useState<any>(null);

    // Три источника контекста клиента, в порядке приоритета:
    // 1) Telegram mini-app (window.Telegram.WebApp) — самый богатый контекст;
    // 2) подписанный токен `?c=` (личная ссылка — Max, любой другой браузер);
    // 3) localStorage на этом же устройстве (было записано раньше в этом же браузере).
    // Раньше localStorage тоже проверялся только ВНУТРИ `if (twa)`, то есть
    // вне Telegram WebApp ни токен, ни localStorage не читались вовсе —
    // отсюда тупиковое сообщение (или бесконечный спиннер) при открытии из Max.
    useEffect(() => {
        let cancelled = false;

        async function resolveContext() {
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
                    if (!cancelled) {
                        setClientContext({
                            id: String(twa.initDataUnsafe.user.id),
                            name: twa.initDataUnsafe.user.first_name || 'Клиент',
                            isTelegram: true
                        });
                    }
                    return;
                }
            }

            const token = searchParams.get('c');
            if (token) {
                try {
                    const resolved = await resolveClientLinkParam(token);
                    if (resolved?.clientId) {
                        if (!cancelled) {
                            setClientContext({ id: resolved.clientId, name: 'Мои записи', isTelegram: false });
                        }
                        return;
                    }
                } catch (e) {
                    console.error('Failed to resolve client link token', e);
                }
            }

            const savedClientId = localStorage.getItem('compas_clientId');
            if (savedClientId) {
                if (!cancelled) {
                    setClientContext({ id: savedClientId, name: 'Мои записи', isTelegram: false });
                }
                return;
            }
        }

        resolveContext().finally(() => {
            if (!cancelled) setContextLoading(false);
        });

        return () => { cancelled = true; };
    }, [searchParams]);

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
            setUpcomingSessions(Array.isArray(data?.upcoming) ? data.upcoming : []);
            setPastSessions(Array.isArray(data?.past) ? data.past : []);
        } catch (e) {
            console.error('Failed to fetch sessions', e);
        } finally {
            setLoading(false);
        }
    }, [clientContext]);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    const activeSessions = tab === 'upcoming' ? upcomingSessions : pastSessions;
    const groupedSessions = groupByDate(activeSessions);
    const sortedDates = Object.keys(groupedSessions).sort((a, b) => tab === 'upcoming' ? a.localeCompare(b) : b.localeCompare(a));

    const getDateLabel = (dateStr: string) => {
        const date = new Date(dateStr);
        if (isToday(date)) return 'Сегодня';
        if (isTomorrow(date)) return 'Завтра';
        return format(date, 'd MMMM, EEEE', { locale: ru });
    };

    if (contextLoading || (loading && !upcomingSessions.length && !pastSessions.length && clientContext)) {
        return (
            <div className="practice-booking-theme flex items-center justify-center min-h-screen p-4 bg-[var(--booking-paper)]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--booking-accent)]"></div>
            </div>
        );
    }

    if (!clientContext) {
        return (
            <div className="practice-booking-theme flex flex-col items-center justify-center min-h-screen p-4 bg-[var(--booking-paper)]">
                <p className="text-[var(--booking-muted)] text-center">Пожалуйста, откройте приложение через бота или перейдите по персональной ссылке от психолога.</p>
            </div>
        );
    }

    return (
        <div className="practice-booking-theme min-h-screen bg-[var(--booking-paper)] text-[var(--booking-ink)] pb-20">
            {/* Header */}
            <div className="bg-[var(--booking-card)] px-4 py-5 shadow-sm sticky top-0 z-20 border-b border-[var(--booking-line)]">
                <h1 className="text-xl font-semibold text-[var(--booking-accent)] mb-1">Мои записи</h1>
                <p className="text-[var(--booking-muted)] text-xs">
                    {clientContext.isTelegram ? `${clientContext.name}, здесь отображается ваше расписание. ` : 'Здесь отображается расписание всех ваших сессий. '}
                    <span className="font-semibold text-[var(--booking-ink)]">Нажмите на карточку сессии</span>, чтобы отменить или перенести её.
                </p>

                {/* Tabs: Предстоящие / Прошедшие */}
                <div className="flex gap-1 mt-4 p-1 rounded-xl" style={{ background: 'var(--booking-accent-soft)' }}>
                    <button
                        onClick={() => setTab('upcoming')}
                        aria-selected={tab === 'upcoming'}
                        className="flex-1 py-2 rounded-lg text-sm font-semibold transition-colors"
                        style={tab === 'upcoming'
                            ? { background: 'var(--booking-card)', color: 'var(--booking-accent)' }
                            : { color: 'var(--booking-muted)' }}
                    >
                        Предстоящие
                    </button>
                    <button
                        onClick={() => setTab('past')}
                        aria-selected={tab === 'past'}
                        className="flex-1 py-2 rounded-lg text-sm font-semibold transition-colors"
                        style={tab === 'past'
                            ? { background: 'var(--booking-card)', color: 'var(--booking-accent)' }
                            : { color: 'var(--booking-muted)' }}
                    >
                        Прошедшие
                    </button>
                </div>
            </div>

            <div className="px-4 pt-6 space-y-6">
                {sortedDates.map(dateStr => (
                    <div key={dateStr} className="space-y-3">
                        <h2 className="text-sm font-semibold text-[var(--booking-muted)] uppercase tracking-wider pl-1">
                            {getDateLabel(dateStr)}
                        </h2>
                        <div className="space-y-2">
                            {groupedSessions[dateStr].map((session: any) => (
                                <button
                                    key={session.id}
                                    onClick={() => setSelectedSession(session)}
                                    className="w-full text-left bg-[var(--booking-card)] rounded-[var(--booking-radius-card)] p-4 border border-[var(--booking-line)] flex gap-4 transition-all hover:border-[var(--booking-accent)] haptic-light relative overflow-hidden"
                                >
                                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[var(--booking-accent)]/25"></div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-lg font-semibold text-[var(--booking-ink)]">
                                                {session.time} {session.endTime && <span className="text-sm text-[var(--booking-muted)] font-medium">- {session.endTime}</span>}
                                            </span>
                                            <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--booking-paper)] text-[var(--booking-muted)] border border-[var(--booking-line)]">
                                                {session.format === 'offline' ? (
                                                    <><MapPin className="w-3.5 h-3.5" /> Очно</>
                                                ) : (
                                                    <><Video className="w-3.5 h-3.5" /> Онлайн</>
                                                )}
                                            </span>
                                        </div>
                                        <div className="text-sm text-[var(--booking-ink)]/80 font-medium">
                                            Психолог: {session.psychologistName}
                                        </div>
                                        {session.address && session.format === 'offline' && (
                                            <div className="text-xs text-[var(--booking-muted)] mt-1.5 line-clamp-1">
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

            {activeSessions.length === 0 && !loading && (
                <div className="text-center py-16 px-6">
                    <div className="text-4xl mb-4 flex justify-center">
                        <div className="w-16 h-16 rounded-full bg-[var(--booking-accent-soft)] flex items-center justify-center">
                            <CalendarIcon className="w-8 h-8 text-[var(--booking-accent)]" />
                        </div>
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--booking-ink)] mb-2">
                        {tab === 'upcoming' ? 'Нет предстоящих сессий' : 'Нет прошедших встреч'}
                    </h3>
                    <p className="text-sm text-[var(--booking-muted)] mb-8">
                        {tab === 'upcoming' ? 'У вас пока нет запланированных встреч.' : 'Здесь появятся встречи после того, как они состоятся.'}
                    </p>
                    {tab === 'upcoming' && (
                        <button
                            onClick={() => {
                                // @ts-ignore
                                window.Telegram?.WebApp?.close();
                            }}
                            className="w-full max-w-xs mx-auto py-3.5 rounded-[var(--booking-radius-card)] border-2 font-semibold text-base transition-all haptic-light border-[var(--booking-accent)] text-white bg-[var(--booking-accent)] hover:opacity-90 active:scale-[0.98]"
                        >
                            Вернуться в бот
                        </button>
                    )}
                </div>
            )}

            {/* Session Detail Modal */}
            {selectedSession && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200 backdrop-blur-sm">
                    <div className="bg-[var(--booking-card)] rounded-t-3xl sm:rounded-[var(--booking-radius-card)] w-full max-w-md border border-[var(--booking-line)] shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
                        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-[var(--booking-line)]">
                            <h3 className="text-lg font-semibold text-[var(--booking-ink)]">Детали записи</h3>
                            <button onClick={() => setSelectedSession(null)} className="p-1.5 rounded-lg hover:bg-[var(--booking-accent-soft)] transition-colors">
                                <X className="w-5 h-5 text-[var(--booking-muted)]" />
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-5">
                            <div>
                                <p className="text-xs font-semibold text-[var(--booking-muted)] uppercase tracking-widest mb-1">Дата и время</p>
                                <p className="font-semibold text-[var(--booking-ink)] text-lg">
                                    {format(new Date(selectedSession.date), 'd MMMM yyyy', { locale: ru })}, {selectedSession.time} {selectedSession.endTime && `- ${selectedSession.endTime}`}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-[var(--booking-muted)] uppercase tracking-widest mb-1">Специалист</p>
                                <p className="font-semibold text-[var(--booking-ink)] text-base">{selectedSession.psychologistName}</p>
                            </div>
                            <div className="flex flex-col gap-2 p-4 bg-[var(--booking-paper)] rounded-[var(--booking-radius-card)] border border-[var(--booking-line)]">
                                <div className="flex items-center gap-2">
                                    {selectedSession.format === 'offline' ? (
                                        <><MapPin className="w-4 h-4 text-[var(--booking-accent)]" /> <span className="text-sm font-semibold text-[var(--booking-ink)]">Очная встреча</span></>
                                    ) : (
                                        <><Video className="w-4 h-4 text-[var(--booking-accent)]" /> <span className="text-sm font-semibold text-[var(--booking-ink)]">Онлайн-консультация</span></>
                                    )}
                                </div>
                                {selectedSession.format === 'offline' && selectedSession.address && (
                                    <div className="text-sm text-[var(--booking-ink)] mt-1 ml-6">
                                        <p className="font-semibold">{selectedSession.address.name}</p>
                                        <p className="text-[var(--booking-muted)] mt-0.5 leading-snug">{selectedSession.address.fullAddress}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {tab === 'upcoming' && selectedSession.format === 'online' && selectedSession.onlineSessionLink && (
                            <div className="px-6 pb-4">
                                <a
                                    href={selectedSession.onlineSessionLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex w-full items-center justify-center py-3.5 rounded-[var(--booking-radius-card)] border-2 font-semibold transition-colors text-sm bg-[var(--booking-accent)] text-white border-[var(--booking-accent)] hover:opacity-90 haptic-light"
                                >
                                    Присоединиться к встрече
                                </a>
                            </div>
                        )}

                        {tab === 'upcoming' ? (
                            <div className="px-6 pb-6 grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => {
                                        setSelectedSession(null);
                                        window.location.href = `/bot/book/${selectedSession.psychologistId}`;
                                    }}
                                    className="py-3 rounded-[var(--booking-radius-card)] border font-semibold transition-colors text-sm hover:border-[var(--booking-accent)] hover:text-[var(--booking-accent)] haptic-light border-[var(--booking-line)] text-[var(--booking-ink)] bg-[var(--booking-card)]"
                                >
                                    Перенести
                                </button>
                                <button
                                    onClick={() => {
                                        setSessionToCancel(selectedSession);
                                        setSelectedSession(null);
                                    }}
                                    className="py-3 rounded-[var(--booking-radius-card)] border font-semibold transition-colors text-sm border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10 haptic-light"
                                >
                                    Отменить
                                </button>
                            </div>
                        ) : (
                            <div className="px-6 pb-6">
                                <button
                                    onClick={() => {
                                        setSelectedSession(null);
                                        window.location.href = `/bot/book/${selectedSession.psychologistId}`;
                                    }}
                                    className="w-full py-3 rounded-[var(--booking-radius-card)] border font-semibold transition-colors text-sm haptic-light text-white"
                                    style={{ borderColor: 'var(--booking-accent)', background: 'var(--booking-accent)' }}
                                >
                                    Записаться снова
                                </button>
                            </div>
                        )}
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

            {/* Instruction Footer */}
            {!loading && (
                <div className="px-6 py-8 text-center mt-6">
                    <p className="text-sm text-[var(--booking-muted)] leading-relaxed font-medium">
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
