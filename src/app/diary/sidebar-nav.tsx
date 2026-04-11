'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Users, Clock, Link2, Settings, Bell, HelpCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

const navItems = [
    { href: '/diary', label: 'Календарь', icon: Calendar },
    { href: '/diary/clients', label: 'Клиенты', icon: Users },
    { href: '/diary/availability', label: 'Расписание', icon: Clock },
    { href: '/diary/notifications', label: 'Уведомления', icon: Bell },
    { href: '/diary/integrations', label: 'Интеграции', icon: Link2 },
    { href: '/diary/settings', label: 'Настройки', icon: Settings },
];

const secondaryNavItems = [
    { href: '/diary/help', label: 'Помощь', icon: HelpCircle },
];

export function SidebarNav() {
    const pathname = usePathname();
    const [user, setUser] = useState<{ name?: string; image?: string } | null>(null);

    useEffect(() => {
        fetch('/api/auth/session')
            .then(r => r.json())
            .then(d => { if (d?.user) setUser(d.user); })
            .catch(() => { });
    }, []);

    const profileActive = pathname?.startsWith('/diary/profile');
    const initials = user?.name ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '👤';

    return (
        <nav className="flex-1 p-4 overflow-y-auto">
            {/* Profile card */}
            <Link
                href="/diary/profile"
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all mb-4 ${profileActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                    : 'bg-sidebar-accent/50 hover:bg-sidebar-accent text-sidebar-foreground'
                    }`}
            >
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center overflow-hidden shrink-0 border border-white/10 shadow-sm">
                    {user?.image ? (
                        <img src={user.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-sm font-bold">{initials}</span>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{user?.name || 'Мой профиль'}</div>
                    <div className="text-[10px] font-medium opacity-70">Профиль</div>
                </div>
            </Link>

            <ul className="space-y-1.5">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.href === '/diary'
                        ? pathname === '/diary'
                        : pathname?.startsWith(item.href);

                    return (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm ${isActive
                                    ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm'
                                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-medium'
                                    }`}
                            >
                                <Icon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.5} />
                                <span>{item.label}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>

            <div className="my-4 mx-2 border-t border-sidebar-border/60" />

            <ul className="space-y-1.5">
                {secondaryNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname?.startsWith(item.href);

                    return (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm ${isActive
                                    ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm'
                                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-medium'
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
