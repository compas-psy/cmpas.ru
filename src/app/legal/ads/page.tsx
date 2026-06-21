import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Marketing messages consent — Compas',
    description: 'Consent page for Compas service messages.',
};

export default function AdsLegalPage() {
    return (
        <main className="min-h-screen bg-white">
            <div className="container mx-auto px-4 py-16 max-w-3xl">
                <Link href="/" className="text-primary hover:underline text-sm mb-8 inline-block">← На главную</Link>
                <h1 className="text-3xl font-bold text-primary mb-2">Согласие на получение сообщений</h1>
                <p className="text-sm text-muted-foreground mb-8">Версия: 2026-06-21</p>
                <div className="prose prose-sm max-w-none text-foreground/90 space-y-6">
                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">1. Добровольность</h2>
                        <p>Пользователь даёт это согласие отдельно. Отказ не ограничивает доступ к основным функциям сервиса.</p>
                    </section>
                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">2. Каналы связи</h2>
                        <p>Сообщения могут направляться по указанным пользователем каналам связи, включая email, push-уведомления и подключённые мессенджеры.</p>
                    </section>
                    <section>
                        <h2 className="text-xl font-semibold text-primary mt-8 mb-3">3. Отзыв</h2>
                        <p>Пользователь может отключить согласие в профиле сервиса или через обращение в поддержку.</p>
                    </section>
                </div>
            </div>
        </main>
    );
}
