'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { PRACTICE_PRICE_LABEL } from '@/lib/billing/pricing';

const FEATURES = [
    'Неограниченные клиенты и сессии',
    'Заметки по сессиям (8 блоков)',
    // Мессенджеры названы обобщённо намеренно: перечисление превращает
    // витрину в список чужих брендов и стареет от каждого нового канала.
    'Боты в популярных мессенджерах для самозаписи',
    'Синхронизация с Яндекс и другими календарями',
    'Уведомления клиентам и психологу',
    'История сессий и таймлайн клиента',
];

type BillingState = {
    daysLeft: number | null;
    isExpired: boolean;
    isForever: boolean;
    /** Подписка оплачена И ЕЩЁ НЕ КОНЧИЛАСЬ. Считает сервер, а не экран. */
    subscriptionActive: boolean;
    subscriptionEndsAt: string | null;
    subscriptionPlan: string | null;
};

const EMPTY: BillingState = {
    daysLeft: null, isExpired: false, isForever: false,
    subscriptionActive: false, subscriptionEndsAt: null, subscriptionPlan: null,
};

async function getBillingState(): Promise<BillingState> {
    const res = await fetch('/api/billing/status');
    if (!res.ok) return EMPTY;
    return res.json();
}

export default function BillingPage() {
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

    // Разбираем EMPTY, а не пустой объект: иначе у каждого поля тип
    // «или undefined», и экран приходится обвешивать проверками на то,
    // чего в ответе сервера не бывает.
    const { daysLeft, isExpired, isForever, subscriptionActive, subscriptionEndsAt, subscriptionPlan } = state ?? EMPTY;

    // ПОДПИСКА «АКТИВНА» — ЭТО ПРО СРОК, А НЕ ПРО ФАКТ ОПЛАТЫ КОГДА-ТО.
    //
    // Раньше экран ветвился по самому наличию даты окончания: заплатил в
    // мае — в сентябре всё ещё «Подписка активна», и рядом дата из прошлого.
    // Человек читает крупную зелёную строку, а не сверяет число с календарём,
    // и уходит уверенным, что всё оплачено. Сервер считал это правильно
    // (hasActiveSub), но наружу отдавал только дату — то есть знал, но не
    // говорил.
    const endsAtLabel = subscriptionEndsAt
        ? new Date(subscriptionEndsAt).toLocaleDateString('ru-RU')
        : null;
    const planLabel = subscriptionPlan === 'practice_plus' ? 'Практика+' : 'Практика';

    const heading = isForever ? 'Бесплатный доступ'
        : subscriptionActive ? 'Подписка активна'
            : isExpired ? 'Подписка закончилась'
                : 'Подписка ПРАКТИКА';

    const subheading = loading ? '...'
        : isForever ? 'У вас бессрочный бесплатный доступ'
            : subscriptionActive ? `Подписка «${planLabel}» действует до ${endsAtLabel}`
                // Дата в прошлом называется вслух: без неё «закончилась» звучит
                // как упрёк без объяснения, а с ней человек сразу понимает,
                // с какого дня он не платит.
                : isExpired && endsAtLabel ? `Подписка «${planLabel}» закончилась ${endsAtLabel}`
                    : isExpired ? 'Оформите подписку, чтобы продолжить работу'
                        : daysLeft !== null
                            ? `Пробный период: осталось ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}`
                            : 'Продолжайте спокойно вести практику';

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 lg:p-8">
            <div className="w-full max-w-[420px] flex flex-col items-center">

                {/* Шапка, заголовок и карточка повторяют экран входа кегль в
                    кегль: логотип 22, заголовок 28/32, подпись 15, карточка
                    max-w-[420px] со скруглением rounded-3xl. Две витрины
                    одного продукта, набранные разными кеглями, читаются как
                    два разных продукта. Цвета взяты токенами, а не хексами:
                    сырые #1a4d3a мимо темы — это третий оттенок зелёного,
                    ради изгнания которых и заводились переменные. */}
                {/* СЛОВО ЦЕНТРИРУЕТСЯ, А НЕ БЛОК СО ЗНАКОМ.
                    Раньше по центру стояла пара «знак + слово», и само
                    слово из-за этого сидело на 24 px правее центра
                    карточки — глаз это ловит, хотя вёрстка формально
                    «по центру». Знак вынесен из потока и висит слева от
                    слова: центр слова совпадает с центром карточки. */}
                <Link href="/diary" className="relative flex items-center justify-center mb-10 hover:opacity-90 transition-opacity">
                    <Image src="/logo-tree.png" alt="" width={36} height={36} className="object-contain absolute right-full mr-3" />
                    <span className="text-[22px] font-bold text-forest-800 tracking-wide uppercase">ПРАКТИКА</span>
                </Link>

                <div className="text-center mb-8">
                    <h1 className="text-[28px] md:text-[32px] font-bold text-foreground leading-[1.15] mb-2.5">
                        {heading}
                    </h1>
                    <p className="text-[15px] text-muted-foreground font-medium">
                        {subheading}
                    </p>
                </div>

                {error && (
                    <div className="w-full bg-red-50 border border-red-200 text-red-700 text-[14px] rounded-2xl px-4 py-3 mb-4">
                        {error}
                    </div>
                )}

                <div className="w-full bg-forest-800 rounded-3xl shadow-floating p-8 lg:p-10 mb-6">
                    <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-5">Входит в подписку</p>
                    <ul className="space-y-3 mb-8">
                        {FEATURES.map(f => (
                            <li key={f} className="flex items-start gap-3">
                                <svg className="w-4 h-4 text-accent shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span className="text-[14px] font-medium text-white/90">{f}</span>
                            </li>
                        ))}
                    </ul>

                    {isForever ? (
                        <div className="text-center py-2">
                            <span className="text-accent text-4xl">∞</span>
                            <p className="text-white/70 text-[14px] mt-2">Бесплатный доступ навсегда</p>
                        </div>
                    ) : (
                        /* ТАРИФ ОДИН.
                           «Практика+» стояла здесь с меткой «Скоро» и ценой,
                           то есть занимала половину карточки, ничего не
                           предлагая: нажать нельзя, выбрать нельзя, а решение
                           «сколько это стоит» она усложняла вдвое. Тариф не
                           удалён — он жив в PLANS и вернётся на витрину, когда
                           за ним появится продукт. */
                        <div className="space-y-3">
                            <div className="bg-white/10 rounded-2xl p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="min-w-0">
                                        <p className="text-white font-semibold text-[15px]">Практика</p>
                                        <p className="text-white/60 text-[12px]">Все функции для ведения практики</p>
                                    </div>
                                    {/* Цена не переносится: «/мес», уехавшее на вторую строку,
                                        читается как отдельная строка, а не как часть числа. */}
                                    <p className="text-white font-bold text-[18px] whitespace-nowrap shrink-0 ml-3">
                                        {PRACTICE_PRICE_LABEL}<span className="text-white/50 text-[12px] font-normal">/мес</span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => handlePay('practice', 1)}
                                    disabled={paying !== null}
                                    className="w-full px-4 py-3 bg-accent hover:bg-accent/90 text-forest-800 rounded-xl font-semibold text-[14px] transition-colors disabled:opacity-60"
                                >
                                    {paying === 'practice_1' ? 'Переход к оплате...' : `Оформить за ${PRACTICE_PRICE_LABEL}`}
                                </button>
                            </div>

                            <p className="text-white/40 text-[12px] text-center pt-1">
                                Оплата через T-Bank. Безопасно и быстро.
                            </p>
                        </div>
                    )}
                </div>

                <Link href="/diary" className="text-[14px] text-forest-800/60 hover:text-forest-800 transition-colors">
                    ← Вернуться в приложение
                </Link>
            </div>
        </div>
    );
}
