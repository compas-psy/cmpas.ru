'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers, Users, Clock, Settings } from 'lucide-react';

const tabs = [
    { href: '/diary', label: 'Сегодня', icon: Layers, exact: true },
    { href: '/diary/clients', label: 'Клиенты', icon: Users },
    { href: '/diary/availability', label: 'Расписание', icon: Clock },
    { href: '/diary/settings', label: 'Настройки', icon: Settings },
];

export function BottomTabBar() {
    const pathname = usePathname();

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-border safe-area-bottom">
            <nav className="flex items-stretch justify-around px-2 h-16">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = tab.exact
                        ? pathname === tab.href
                        : pathname?.startsWith(tab.href);

                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-all active:scale-90 ${
                                isActive
                                    ? 'text-forest-800'
                                    : 'text-muted-foreground'
                            }`}
                        >
                            <div className={`relative p-1.5 rounded-xl transition-all ${isActive ? 'bg-sage-100' : ''}`}>
                                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.5} />
                            </div>
                            <span className={`text-[10px] leading-none ${isActive ? 'font-bold' : 'font-medium'}`}>
                                {tab.label}
                            </span>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
