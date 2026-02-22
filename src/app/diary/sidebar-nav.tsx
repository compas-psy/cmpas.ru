'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Users, Clock, Link2, Settings } from 'lucide-react';

const navItems = [
    { href: '/diary', label: 'Календарь', icon: Calendar },
    { href: '/diary/clients', label: 'Клиенты', icon: Users },
    { href: '/diary/availability', label: 'Расписание', icon: Clock },
    { href: '/diary/integrations', label: 'Интеграции', icon: Link2 },
    { href: '/diary/settings', label: 'Настройки', icon: Settings },
];

export function SidebarNav() {
    const pathname = usePathname();

    return (
        <nav className="flex-1 p-4 overflow-y-auto">
            <ul className="space-y-1.5">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    // Exact match for /diary, otherwise prefix match
                    const isActive = item.href === '/diary'
                        ? pathname === '/diary'
                        : pathname?.startsWith(item.href);

                    return (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm ${isActive
                                        ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                                        : 'text-foreground/80 hover:bg-secondary hover:text-foreground font-medium'
                                    }`}
                            >
                                <Icon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.5} />
                                <span>{item.label}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
