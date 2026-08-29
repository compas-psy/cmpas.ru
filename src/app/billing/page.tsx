'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

const FEATURES = [
    'Неограниченные клиенты и сессии',
    'Умные заметки по сессиям (8 блоков)',
    'Telegram и MAX боты для самозаписи',
    'Синхронизация с Google и Яндекс Календарями',
    'Уведомления клиентам и психологу',
    'История сессий и таймлайн клиента',
];

type BillingState = {
    daysLeft: number | null;
    isExpired: boolean;
    isForever: boolean;
    subscriptionEndsAt: string | null;
    subscriptionPlan: string | null;
};

async function getBillingState(): Promise<BillingState> {
    const res = await fetch('/api/billing/status');
    if (!res.ok) return { daysLeft: null, isExpired: false, isForever: false, subscriptionEndsAt: null, subscriptionPlan: null };
    return res.json();
}

export default function BillingPage() {
    const router = useRouter();
    const [state, setState] = useState<BillingState | null>(null);
    const [loading, setLoading] = useState(true);
    const [paying, setPaying] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getBillingState().then(s => { setState(s); setLoading(false); });

        const params = new URLSearchParams(window.location.search);
        if (params.get('error') === 'payment_failed') {
            setError('Оплата не прошла. Попробуйте ещё раз или напишите нам.');
        }
    }, []);

    const handlePay = async (plan: 'practice' | 'practice_plus', months = 1) => {
        setPaying(`${plan}_${months}`);
        setError(null);
        try {
            const res = await fetch('/api/payments/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan, months }),
            });
            const data = await res.json();
            if (data.paymentUrl) {
                window.location.href = data.paymentUrl;
            } else {
                setError(data.error || 'Ошибка. Попробуйте позже.');
                setPaying(null);
            }
        } catch {
            setError('Ошибка сети. Попробуйте позже.');
            setPaying(null);
        }
    };

    const { daysLeft, isExpired, isForever, subscriptionEndsAt, subscriptionPlan } = state ?? {};

    return (
        <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4 lg:p-8">
            <div className="w-full max-w-md flex flex-col items-center">

                <Link href="/diary" className="flex items-center gap-3 mb-8 hover:opacity-90 transition-opacity">
                    <Image src="/logo-tree.png" alt="ПРАКТИКА" width={36} height={36} className="object-contain" />
                    <span className="text-xl font-semibold text-[#1a4d3a] tracking-wide">ПРАКТИКА</span>
                </Link>

                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-[#1a1a1a] mb-1">
                        {isForever ? 'Бесплатный доступ' : subscriptionEndsAt ? 'Подписка активна' : isExpired ? 'Пробный период завершён' : 'Подписка ПРАКТИКА'}
                    </h1>
                    <p className="text-sm text-[#1a1a1a]/60">
                        {loading ? '...' : isForever
                            ? 'У вас бессрочный бесплатный доступ'
                            : subscriptionEndsAt
                                ? `Подписка «${subscriptionPlan === 'practice_plus' ? 'Практика+' : 'Практика'}» действует до ${new Date(subscriptionEndsAt).toLocaleDateString('ru-RU')}`
                                : isExpired
                                    ? 'Оформите подписку, чтобы продолжить работу'
                                    : daysLeft !== null
                                        ? `Пробный период: осталось ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}`
                                        : 'Продолжайте спокойно вести практику'}
                    </p>
                </div>

                {error && (
                    <div className="w-full bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl px-4 py-3 mb-4">
                        {error}
                    </div>
                )}

                {/* Main card */}
                <div className="w-full bg-[#1a4d3a] rounded-[32px] shadow-xl p-8 mb-4">
                    <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-5">Входит в подписку</p>
                    <ul className="space-y-3 mb-8">
                        {FEATURES.map(f => (
                            <li key={f} className="flex items-start gap-3">
                                <svg className="w-4 h-4 text-[#c9a961] shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span className="text-sm font-medium text-white/90">{f}</span>
                            </li>
                        ))}
                    </ul>

                    {isForever ? (
                        <div className="text-center py-2">
                            <span className="text-[#c9a961] text-4xl">∞</span>
                            <p className="text-white/70 text-sm mt-2">Бесплатный доступ навсегда</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Practice plan */}
                            <div className="bg-white/10 rounded-2xl p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <div>
                                        <p className="text-white font-semibold">Практика</p>
                                        <p className="text-white/60 text-xs">Все функции для ведения практики</p>
                                    </div>
                                    <p className="text-white font-bold text-lg">990 ₽<span className="text-white/50 text-xs font-normal">/мес</span></p>
                                </div>
                                <button
                                    onClick={() => handlePay('practice', 1)}
                                    disabled={paying !== null}
                                    className="w-full px-4 py-3 bg-[#c9a961] text-[#1a4d3a] rounded-xl font-semibold text-sm hover:bg-[#d4b56d] transition-colors disabled:opacity-60"
                                >
                                    {paying === 'practice_1' ? 'Переход к оплате...' : 'Оформить за 990 ₽'}
                                </button>
                            </div>

                            {/* Practice+ plan */}
                            <div className="bg-[#c9a961]/20 border border-[#c9a961]/40 rounded-2xl p-4">
                                <div className="flex justify-between items-center mb-1">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-white font-semibold">Практика+</p>
                                            <span className="text-xs bg-[#c9a961] text-[#1a4d3a] font-semibold px-2 py-0.5 rounded-full">Скоро</span>
                                        </div>
                                        <p className="text-white/60 text-xs">Таймлайн, документы, оплата через ПРАКТИКУ</p>
                                    </div>
                                    <p className="text-white font-bold text-lg">1990 ₽<span className="text-white/50 text-xs font-normal">/мес</span></p>
                                </div>
                                <p className="text-white/40 text-xs mt-2">Станет доступно в следующем обновлении</p>
                            </div>

                            <p className="text-white/40 text-xs text-center pt-1">
                                Оплата через T-Bank. Безопасно и быстро.
                            </p>
                        </div>
                    )}
                </div>

                <Link href="/diary" className="text-sm text-[#1a4d3a]/60 hover:text-[#1a4d3a] transition-colors">
                    ← Вернуться в приложение
                </Link>
            </div>
        </div>
    );
}
