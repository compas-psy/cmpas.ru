'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { getClientSessions } from '../actions';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { CancelSessionDialog } from '@/components/psidairy/CancelSessionDialog';

function ClientDashboard() {
    const [initData, setInitData] = useState<any>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [sessionToCancel, setSessionToCancel] = useState<any>(null);
    const router = useRouter();

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
                // Mock for testing outside TG
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

    const handleReschedule = (session: any) => {
        // Go to booking page for this psychologist
        router.push(`/bot/book/${session.psychologistId}`);
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
            <div className="bg-card px-4 py-8 shadow-sm">
                <h1 className="text-2xl font-bold text-primary mb-2">Мои сессии</h1>
                <p className="text-muted-foreground text-sm">
                    Здравствуйте, {initData.first_name}! Здесь вы можете управлять своими записями.
                </p>
            </div>

            <div className="p-4 space-y-4 max-w-md mx-auto">
                {sessions.length === 0 ? (
                    <div className="text-center py-12 px-4 border-2 border-dashed border-border rounded-2xl bg-muted/20">
                        <div className="text-4xl mb-3 opacity-50">🗓</div>
                        <h3 className="text-lg font-medium text-foreground mb-2">У вас нет предстоящих сессий</h3>
                        <p className="text-sm text-muted-foreground mb-6">Запишитесь на консультацию прямо сейчас</p>
                        <button
                            onClick={() => {
                                // @ts-ignore
                                window.Telegram?.WebApp?.close();
                            }}
                            className="w-full py-3.5 rounded-xl border-2 font-bold text-base transition-all haptic-light border-[#1e3a2f] text-white dark:border-[#b89a4e] dark:text-gray-900 bg-[#1e3a2f] dark:bg-[#b89a4e] hover:opacity-90 shadow-sm active:scale-[0.98]"
                        >
                            Вернуться в бот
                        </button>
                    </div>
                ) : (
                    sessions.map((session) => (
                        <div key={session.id} className="bg-card rounded-2xl p-4 border border-border shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-semibold text-lg text-foreground">
                                        {format(new Date(session.date), 'd MMMM yyyy', { locale: ru })}
                                    </h3>
                                    <div className="text-primary font-medium text-lg">
                                        {session.time}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-muted-foreground mb-1">Специалист</div>
                                    <div className="font-medium text-sm line-clamp-1 max-w-[120px]">
                                        {session.psychologistName}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground bg-muted/30 p-2.5 rounded-xl border border-border/50">
                                <span className="text-xl">{session.format === 'offline' ? '🏢' : '💻'}</span>
                                {session.format === 'offline' ? 'Очная встреча в кабинете' : 'Онлайн-консультация'}
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border/50">
                                <button
                                    onClick={() => handleReschedule(session)}
                                    className="py-2.5 rounded-xl border-2 font-medium transition-colors text-sm hover:bg-[#1e3a2f]/10 dark:hover:bg-[#b89a4e]/10 haptic-light border-[#1e3a2f] text-[#1e3a2f] dark:border-[#b89a4e] dark:text-[#b89a4e] bg-transparent"
                                >
                                    Перенести
                                </button>
                                <button
                                    onClick={() => setSessionToCancel(session)}
                                    className="py-2.5 rounded-xl border-2 font-medium transition-colors text-sm border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10 haptic-light"
                                >
                                    Отменить
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

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
            <ClientDashboard />
        </Suspense>
    );
}
