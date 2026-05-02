'use client';

import { Sparkles, BellRing, Calendar, Share2, Smartphone, Bug } from 'lucide-react';

type ChangelogEntry = {
    date: string;
    version: string;
    title: string;
    icon: typeof Sparkles;
    color: string;
    items: string[];
};

const changelog: ChangelogEntry[] = [
    {
        date: '3 мая 2026',
        version: '2.5',
        title: 'Бот-ассистент',
        icon: Sparkles,
        color: 'bg-purple-100 text-purple-600',
        items: [
            '☀️ Утренний дайджест — бот присылает список сессий на день',
            '📊 Еженедельная сводка по понедельникам',
            '💬 Оценка самочувствия клиента после сессии (если включено)',
            '✅ Исправлены кнопки «Подтвердить» и «Перенести» в напоминаниях',
            '📱 MAX получает inline-кнопки в напоминаниях',
            '🔗 Кнопка «Отправить ссылку клиенту» на Dashboard',
            '📅 Календарь в нижнем меню на мобильном',
            '📲 КОМПАС теперь можно установить как приложение (PWA)',
        ]
    },
];

export default function ChangelogPage() {
    return (
        <div className="space-y-6 pb-12 max-w-3xl mx-auto">
            <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Что нового</h1>
                <p className="text-muted-foreground text-sm mt-1">Последние обновления сервиса</p>
            </div>

            <div className="space-y-6">
                {changelog.map((entry, i) => {
                    const Icon = entry.icon;
                    return (
                        <div key={i} className="bg-card rounded-2xl border border-border p-5 md:p-6 shadow-card">
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-10 h-10 rounded-xl ${entry.color} flex items-center justify-center`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-foreground">{entry.title}</h2>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className="font-semibold">v{entry.version}</span>
                                        <span>•</span>
                                        <span>{entry.date}</span>
                                    </div>
                                </div>
                            </div>
                            <ul className="space-y-2.5">
                                {entry.items.map((item, j) => (
                                    <li key={j} className="text-sm text-foreground/90 font-medium leading-relaxed pl-1">
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
