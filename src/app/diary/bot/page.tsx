'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { linkTelegramAccount } from '../actions/settings';

export default function TelegramBotConnectionPage() {
    const router = useRouter();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

    useEffect(() => {
        // Load Telegram WebApp script dynamic
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-web-app.js';
        script.async = true;

        script.onload = async () => {
            const tg = (window as any).Telegram?.WebApp;

            if (tg) {
                tg.ready();
                tg.expand();

                const user = tg.initDataUnsafe?.user;

                if (user?.id) {
                    try {
                        await linkTelegramAccount(user.id.toString(), user.username);
                        setStatus('success');

                        // Briefly show success, then redirect to diary
                        setTimeout(() => {
                            router.push('/diary');
                        }, 2000);

                    } catch (error) {
                        console.error('Failed to link Telegram', error);
                        // If auth failed, they need to log in first
                        toast.error('Ошибка. Вы авторизованы в Compas?');
                        router.push('/auth?callbackUrl=/diary/bot');
                    }
                } else {
                    setStatus('error');
                }
            } else {
                setStatus('error');
            }
        };

        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, [router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
            {status === 'loading' && (
                <>
                    <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                    <h2 className="text-xl font-semibold">Привязка аккаунта Telegram...</h2>
                    <p className="text-muted-foreground mt-2 text-sm">Пожалуйста, подождите.</p>
                </>
            )}

            {status === 'success' && (
                <>
                    <div className="w-16 h-16 border-2 border-green-600/30 text-green-600 bg-transparent rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-semibold">Успешно!</h2>
                    <p className="text-muted-foreground mt-2 text-sm">Ваш Telegram привязан к кабинету.</p>
                    <p className="text-muted-foreground mt-1 text-sm">Переадресация...</p>
                </>
            )}

            {status === 'error' && (
                <>
                    <h2 className="text-xl font-semibold text-destructive">Ошибка</h2>
                    <p className="text-muted-foreground mt-2 text-sm">Не удалось получить данные из Telegram.</p>
                    <button
                        onClick={() => router.push('/diary')}
                        className="mt-6 px-4 py-2 bg-primary text-white rounded-lg text-sm"
                    >
                        Вернуться в кабинет
                    </button>
                </>
            )}
        </div>
    );
}
