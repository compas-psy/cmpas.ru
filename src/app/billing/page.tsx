import Link from 'next/link';
import Image from 'next/image';
import { auth } from '@/auth';
import { db } from '@/lib/db';

export default async function BillingPage() {
    const session = await auth();
    const dbUser = session?.user?.email
        ? await (db as any).user.findUnique({
              where: { email: session.user.email },
              select: { trialEndsAt: true },
          })
        : null;

    const trialEndsAt: Date | null = dbUser?.trialEndsAt ?? null;
    const now = new Date();
    const isExpired = trialEndsAt ? trialEndsAt < now : false;
    const daysLeft = trialEndsAt
        ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null;
    const isForever = trialEndsAt && trialEndsAt.getFullYear() >= 2099;

    const features = [
        'Неограниченные клиенты и сессии',
        'Умные заметки по сессиям (8 блоков)',
        'Telegram и MAX боты для самозаписи клиентов',
        'Синхронизация с Google и Яндекс Календарями',
        'Уведомления клиентам и психологу',
        'История сессий и таймлайн клиента',
    ];

    return (
        <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4 lg:p-8">
            <div className="w-full max-w-md flex flex-col items-center">

                {/* Logo */}
                <Link href="/diary" className="flex items-center gap-3 mb-8 hover:opacity-90 transition-opacity">
                    <Image src="/logo-tree.png" alt="КОМПАС" width={36} height={36} className="object-contain" />
                    <span className="text-xl font-semibold text-[#1a4d3a] tracking-wide">КОМПАС</span>
                </Link>

                {/* Title */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-[#1a1a1a] mb-1">
                        {isForever ? 'Бесплатный доступ' : isExpired ? 'Пробный период завершён' : 'Подписка КОМПАС'}
                    </h1>
                    <p className="text-sm text-[#1a1a1a]/60">
                        {isForever
                            ? 'У вас бессрочный бесплатный доступ'
                            : isExpired
                                ? 'Оформите подписку, чтобы продолжить работу'
                                : daysLeft !== null
                                    ? `Пробный период: осталось ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}`
                                    : 'Продолжайте спокойно вести практику'}
                    </p>
                </div>

                {/* Main card */}
                <div className="w-full bg-[#1a4d3a] rounded-[32px] shadow-xl p-8 mb-4">

                    {/* Features */}
                    <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-5">Входит в подписку</p>
                    <ul className="space-y-3 mb-8">
                        {features.map(f => (
                            <li key={f} className="flex items-start gap-3">
                                <svg className="w-4 h-4 text-[#c9a961] shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span className="text-sm font-medium text-white/90">{f}</span>
                            </li>
                        ))}
                    </ul>

                    {/* CTA */}
                    {!isForever && (
                        <div className="space-y-3">
                            <p className="text-sm text-white/70 mb-3">
                                Напишите нам — ответим в течение нескольких часов:
                            </p>
                            <a
                                href="https://t.me/cmpas_support"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-3 w-full px-5 py-4 bg-[#c9a961] text-[#1a4d3a] rounded-2xl font-semibold text-sm hover:bg-[#d4b56d] transition-colors active:scale-[0.98]"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.008 9.46c-.146.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.26 14.333l-2.95-.924c-.64-.204-.654-.64.135-.948l11.55-4.454c.534-.194 1.001.13.567.241z"/>
                                </svg>
                                Написать в Telegram
                            </a>
                            <a
                                href="mailto:hello@cmpas.ru"
                                className="flex items-center justify-center gap-3 w-full px-5 py-4 bg-white/10 text-white rounded-2xl font-semibold text-sm hover:bg-white/20 transition-colors active:scale-[0.98]"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                    <polyline points="22,6 12,13 2,6" />
                                </svg>
                                Написать на email
                            </a>
                        </div>
                    )}

                    {isForever && (
                        <div className="text-center py-2">
                            <span className="text-[#c9a961] text-4xl">∞</span>
                            <p className="text-white/70 text-sm mt-2">Бесплатный доступ навсегда</p>
                        </div>
                    )}
                </div>

                {/* Back link */}
                <Link
                    href="/diary"
                    className="text-sm text-[#1a4d3a]/60 hover:text-[#1a4d3a] transition-colors"
                >
                    ← Вернуться в приложение
                </Link>
            </div>
        </div>
    );
}
