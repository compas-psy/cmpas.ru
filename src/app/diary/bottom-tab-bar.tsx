'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Users, Clock, Settings, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

const tabs = [
    { href: '/diary', label: 'Календарь', icon: Calendar, exact: true },
    { href: '/diary/clients', label: 'Клиенты', icon: Users },
    { href: '/diary/availability', label: 'Расписание', icon: Clock },
    { href: '/diary/settings', label: 'Настройки', icon: Settings },
];

export function BottomTabBar() {
    const pathname = usePathname();

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border/50 safe-area-bottom">
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
                                    ? 'text-primary'
                                    : 'text-muted-foreground'
                            }`}
                        >
                            <div className={`relative p-1.5 rounded-xl transition-all ${isActive ? 'bg-primary/10' : ''}`}>
                                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.5} />
                                {isActive && (
                                    <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                                )}
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
