import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { CheckCircle, Mail, MessageCircle, ArrowLeft } from 'lucide-react';

export default async function BillingPage() {
    const session = await auth();
    const dbUser = session?.user?.email
        ? await db.user.findUnique({
              where: { email: session.user.email },
              select: { trialEndsAt: true },
          })
        : null;

    const trialEndsAt = dbUser?.trialEndsAt;
    const isExpired = trialEndsAt ? trialEndsAt < new Date() : false;

    const features = [
        'Неограниченные клиенты и сессии',
        'Умные заметки по сессиям (8 блоков)',
        'Telegram и MAX боты для самозаписи клиентов',
        'Синхронизация с Google и Яндекс Календарями',
        'Уведомления клиентам и психологу',
        'История сессий и таймлайн клиента',
    ];

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-lg">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <img src="/icon.png" alt="КОМПАС" className="w-10 h-10 object-contain" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
                        {isExpired ? 'Пробный период завершён' : 'Оформить подписку КОМПАС'}
                    </h1>
                    <p className="text-muted-foreground text-base">
                        {isExpired
                            ? 'Чтобы продолжить работу, оформите подписку'
                            : 'Продолжайте спокойно вести практику'}
                    </p>
                </div>

                {/* Features card */}
                <div className="bg-card border border-border rounded-3xl p-6 shadow-sm mb-6">
                    <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Входит в подписку</div>
                    <ul className="space-y-3">
                        {features.map(f => (
                            <li key={f} className="flex items-start gap-3">
                                <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <span className="text-sm font-medium text-foreground">{f}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* CTA */}
                <div className="bg-card border border-border rounded-3xl p-6 shadow-sm mb-4 space-y-3">
                    <p className="text-sm font-semibold text-foreground mb-4">
                        Напишите нам — ответим в течение нескольких часов и всё оформим:
                    </p>
                    <a
                        href="https://t.me/cmpas_support"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 w-full px-4 py-3 bg-primary text-primary-foreground rounded-2xl font-semibold text-sm hover:bg-primary/90 transition-all active:scale-[0.98]"
                    >
                        <MessageCircle className="w-5 h-5" />
                        Написать в Telegram
                    </a>
                    <a
                        href="mailto:hello@cmpas.ru"
                        className="flex items-center gap-3 w-full px-4 py-3 bg-secondary text-secondary-foreground rounded-2xl font-semibold text-sm hover:bg-secondary/80 transition-all active:scale-[0.98]"
                    >
                        <Mail className="w-5 h-5" />
                        Написать на email
                    </a>
                </div>

                {!isExpired && (
                    <div className="text-center">
                        <Link
                            href="/diary"
                            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Вернуться в приложение
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
