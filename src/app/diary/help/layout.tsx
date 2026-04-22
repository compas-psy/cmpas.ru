'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Sparkles,
    Users,
    Clock,
    NotebookPen,
    CalendarClock,
    Bot,
    CreditCard,
    HelpCircle,
    type LucideIcon,
} from 'lucide-react';
import { HELP_TOPICS } from './content';

const ICONS: Record<string, LucideIcon> = {
    Sparkles,
    Users,
    Clock,
    NotebookPen,
    CalendarClock,
    Bot,
    CreditCard,
    HelpCircle,
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-6">
                <h1 className="text-[32px] md:text-[40px] font-bold tracking-tight text-foreground leading-[1.1] flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sage-100 text-forest-700 flex items-center justify-center">
                        <HelpCircle className="w-5 h-5" strokeWidth={1.5} />
                    </div>
                    Помощь
                </h1>
                <p className="text-muted-foreground text-[15px] mt-2 font-medium">
                    Краткая инструкция по работе с КОМПАС. Выберите тему слева.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
                {/* Topic list */}
                <aside className="lg:sticky lg:top-4 lg:self-start">
                    <nav className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
                        <ul className="divide-y divide-border">
                            {HELP_TOPICS.map(topic => {
                                const Icon = ICONS[topic.icon] || HelpCircle;
                                const href = `/diary/help/${topic.slug}`;
                                const isActive = pathname === href || (pathname === '/diary/help' && topic.slug === 'start');
                                return (
                                    <li key={topic.slug}>
                                        <Link
                                            href={href}
                                            className={`flex items-start gap-3 px-4 py-3.5 transition-colors ${
                                                isActive
                                                    ? 'bg-primary/5 border-l-4 border-primary'
                                                    : 'border-l-4 border-transparent hover:bg-muted/40'
                                            }`}
                                        >
                                            <Icon
                                                className={`w-5 h-5 shrink-0 mt-0.5 ${
                                                    isActive ? 'text-primary' : 'text-muted-foreground'
                                                }`}
                                                strokeWidth={1.5}
                                            />
                                            <div className="min-w-0">
                                                <div
                                                    className={`text-sm font-semibold truncate ${
                                                        isActive ? 'text-primary' : 'text-foreground'
                                                    }`}
                                                >
                                                    {topic.title}
                                                </div>
                                                <div className="text-xs text-muted-foreground truncate">
                                                    {topic.description}
                                                </div>
                                            </div>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                </aside>

                {/* Content */}
                <div className="min-w-0">{children}</div>
            </div>
        </div>
    );
}
