'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ClientBookingPage({ params }: { params: { psychologistId: string } }) {
    const router = useRouter();
    const [tgUser, setTgUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
            tg.ready();
            tg.expand();
            // Set header color to match app theme
            tg.setHeaderColor?.('#ffffff');

            if (tg.initDataUnsafe?.user) {
                setTgUser(tg.initDataUnsafe.user);
            }
        }
        setLoading(false);
    }, []);

    const handleBooking = async (e: React.FormEvent) => {
        e.preventDefault();
        toast.promise(
            new Promise(resolve => setTimeout(resolve, 1000)), // Simulate API call
            {
                loading: 'Оформление записи...',
                success: () => {
                    const tg = (window as any).Telegram?.WebApp;
                    if (tg) {
                        // Close the Mini App automatically on success
                        tg.close();
                    }
                    return 'Успех! Уведомление придет в бота.';
                },
                error: 'Ошибка записи'
            }
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-4 max-w-md mx-auto">
            <h1 className="text-2xl font-bold mb-2">Запись на сессию</h1>
            <p className="text-muted-foreground mb-6 text-sm">
                Привет, {tgUser?.first_name || 'Гость'}! Выберите удобное время.
            </p>

            {/* Placeholder for Schedule UI */}
            <div className="bg-card border rounded-xl p-4 mb-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Свободные слоты (Демо)</p>
                <div className="grid grid-cols-2 gap-2">
                    <button className="py-2 px-4 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors">10:00</button>
                    <button className="py-2 px-4 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors">11:00</button>
                    <button className="py-2 px-4 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors">14:00</button>
                    <button className="py-2 px-4 rounded-lg bg-muted text-muted-foreground opacity-50 cursor-not-allowed">15:00</button>
                </div>
            </div>

            <form onSubmit={handleBooking} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Имя</label>
                    <input
                        type="text"
                        required
                        defaultValue={tgUser?.first_name || ''}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                        placeholder="Ваше имя"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Телефон</label>
                    <input
                        type="tel"
                        required
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                        placeholder="+7 (999) 000-00-00"
                    />
                </div>

                <button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-medium mt-6 shadow-sm active:scale-[0.98] transition-all"
                >
                    Подтвердить запись
                </button>
            </form>
        </div>
    );
}
