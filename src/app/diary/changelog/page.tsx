'use client';

import { Sparkles, MessageCircle, Shield, Bell, Calendar, Share2, Smartphone, Zap, Globe } from 'lucide-react';

type ChangelogEntry = {
    date: string;
    version: string;
    title: string;
    icon: typeof Sparkles;
    color: string;
    items: { emoji: string; text: string; tag?: 'new' | 'fix' | 'improved' }[];
};

const tagStyle = {
    new: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    fix: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    improved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};
const tagLabel = { new: 'Новое', fix: 'Исправлено', improved: 'Улучшено' };

const changelog: ChangelogEntry[] = [
    {
        date: '3 мая 2026',
        version: '2.6',
        title: 'MAX бот — полная функциональность',
        icon: MessageCircle,
        color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
        items: [
            { emoji: '✅', text: 'Подтверждение сессии прямо из MAX (кнопка в напоминании)', tag: 'new' },
            { emoji: '🔄', text: 'Перенос сессии — кнопка открывает страницу записи', tag: 'new' },
            { emoji: '😊', text: 'Оценка самочувствия после сессии сохраняется в карточке', tag: 'new' },
            { emoji: '📋', text: 'Команда /help — контекстная справка для психолога и клиента', tag: 'new' },
            { emoji: '🔗', text: 'Команда /link — получить ссылку для записи клиентов', tag: 'new' },
            { emoji: '🇷🇺', text: 'Русские команды: /сессии, /помощь', tag: 'improved' },
            { emoji: '🤖', text: 'Умный ответ на любой текст — кнопки по роли (психолог/клиент)', tag: 'improved' },
        ],
    },
    {
        date: '2 мая 2026',
        version: '2.5',
        title: 'Стабильность и DNS',
        icon: Shield,
        color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
        items: [
            { emoji: '🛡️', text: 'Booking page больше не зависает при проблемах с Telegram', tag: 'fix' },
            { emoji: '⏱️', text: 'Timeout на все Telegram API вызовы (10 сек)', tag: 'fix' },
            { emoji: '🔍', text: 'Диагностический endpoint — проверка connectivity к TG и MAX', tag: 'new' },
            { emoji: '🌐', text: 'DNS fix: 8.8.8.8 / 1.1.1.1 в Docker', tag: 'fix' },
            { emoji: '📋', text: 'Поддержка TELEGRAM_API_URL для обхода блокировок', tag: 'new' },
        ],
    },
    {
        date: '2 мая 2026',
        version: '2.4',
        title: 'Бот-ассистент',
        icon: Sparkles,
        color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
        items: [
            { emoji: '☀️', text: 'Утренний дайджест — бот присылает список сессий на день', tag: 'new' },
            { emoji: '📊', text: 'Еженедельная сводка по понедельникам', tag: 'new' },
            { emoji: '💬', text: 'Оценка самочувствия клиента после сессии', tag: 'new' },
            { emoji: '🔗', text: 'Кнопка «Отправить ссылку клиенту» на Dashboard', tag: 'new' },
            { emoji: '📅', text: 'Календарь в нижнем меню на мобильном', tag: 'improved' },
            { emoji: '📲', text: 'ПРАКТИКУ можно установить как приложение (PWA)', tag: 'new' },
            { emoji: '🔔', text: 'Настройки: дайджест, сводка, mood-check, напоминания', tag: 'new' },
        ],
    },
];

export default function ChangelogPage() {
    return (
        <div className="space-y-6 pb-12 max-w-3xl mx-auto">
            <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Что нового</h1>
                <p className="text-muted-foreground text-sm mt-1">Последние обновления сервиса</p>
            </div>

            <div className="relative">
                {/* Vertical timeline line */}
                <div className="absolute left-[19px] top-6 bottom-6 w-px bg-border hidden md:block" />

                <div className="space-y-6">
                    {changelog.map((entry, i) => {
                        const Icon = entry.icon;
                        return (
                            <div key={i} className="relative md:pl-14">
                                {/* Timeline dot */}
                                <div className={`hidden md:flex absolute left-0 w-10 h-10 rounded-xl ${entry.color} items-center justify-center z-10`}>
                                    <Icon className="w-5 h-5" />
                                </div>

                                <div className="bg-card rounded-2xl border border-border p-5 md:p-6 shadow-card hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className={`md:hidden w-10 h-10 rounded-xl ${entry.color} flex items-center justify-center`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-foreground">{entry.title}</h2>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span className="font-semibold bg-muted px-2 py-0.5 rounded-md">v{entry.version}</span>
                                                <span>•</span>
                                                <span>{entry.date}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <ul className="space-y-2.5">
                                        {entry.items.map((item, j) => (
                                            <li key={j} className="flex items-start gap-2.5 text-sm text-foreground/90 leading-relaxed">
                                                <span className="text-base mt-0.5 flex-shrink-0">{item.emoji}</span>
                                                <span className="flex-1 font-medium">{item.text}</span>
                                                {item.tag && (
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${tagStyle[item.tag]}`}>
                                                        {tagLabel[item.tag]}
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
