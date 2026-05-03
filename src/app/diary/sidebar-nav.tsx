'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Calendar, Users, Clock, Link2, Settings, Bell, HelpCircle,
    BarChart3, FileText, Layers, StickyNote, Stethoscope,
    ChevronRight, Sparkles
} from 'lucide-react';
import { useEffect, useState } from 'react';

const navGroups = [
    {
        label: 'Главная работа',
        items: [
            { href: '/diary', label: 'Сегодня', icon: Layers, exact: true },
            { href: '/diary/calendar', label: 'Календарь', icon: Calendar },
            { href: '/diary/availability', label: 'Расписание', icon: Clock },
            { href: '/diary/clients', label: 'Клиенты', icon: Users, badge: 'clients' },
            { href: '/diary/notes', label: 'Заметки', icon: StickyNote, badge: 'notes' },
        ],
    },
    {
        label: 'Практика',
        items: [
            { href: '/diary/analytics', label: 'Аналитика', icon: BarChart3 },
            { href: '/diary/documents', label: 'Документы', icon: FileText },
            { href: '/diary/diagnostics', label: 'Диагностика', icon: Stethoscope },
        ],
    },
    {
        label: 'Система',
        items: [
            { href: '/diary/notifications', label: 'Уведомления', icon: Bell },
            { href: '/diary/integrations', label: 'Интеграции', icon: Link2 },
            { href: '/diary/settings', label: 'Настройки', icon: Settings },
            { href: '/diary/changelog', label: 'Что нового', icon: Sparkles },
            { href: '/diary/help', label: 'Помощь', icon: HelpCircle },
        ],
    },
];

type NavItem = (typeof navGroups)[0]['items'][0];

export function SidebarNav() {
    const pathname = usePathname();
    const [user, setUser] = useState<{ name?: string; image?: string } | null>(null);
    const [badges, setBadges] = useState<{ clients: number; notes: number }>({ clients: 0, notes: 0 });

    useEffect(() => {
        fetch('/api/auth/session')
            .then(r => r.json())
            .then(d => { if (d?.user) setUser(d.user); })
            .catch(() => { });
    }, []);

    // Fetch badge counts
    useEffect(() => {
        const fetchBadges = async () => {
            try {
                const { getClients } = await import('./actions/clients');
                const data = await getClients(undefined, 'active');
                setBadges(prev => ({ ...prev, clients: data.length }));
            } catch { /* empty */ }
        };
        fetchBadges();
    }, []);

    const profileActive = pathname?.startsWith('/diary/profile');
    const initials = user?.name ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '👤';

    const isActive = (item: NavItem) => {
        if ((item as any).exact) return pathname === item.href;
        return pathname?.startsWith(item.href);
    };

    const getBadge = (item: NavItem): number | null => {
        if (!(item as any).badge) return null;
        return (badges as any)[(item as any).badge] || null;
    };

    return (
        <nav className="flex-1 px-4 py-2 overflow-y-auto telegram-miniapp-scrollbar-hide">
            {/* Profile card */}
            <Link
                href="/diary/profile"
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all mb-5 group ${profileActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'hover:bg-sidebar-accent text-sidebar-foreground'
                    }`}
            >
                <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center overflow-hidden shrink-0 border border-white/10">
                    {user?.image ? (
                        <img src={user.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-sm font-bold text-white">{initials}</span>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate text-white">{user?.name || 'Мой профиль'}</div>
                    <div className="text-[11px] font-medium text-white/50">Психолог • Профиль</div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors shrink-0" />
            </Link>

            {/* Grouped navigation */}
            {navGroups.map((group, groupIdx) => (
                <div key={groupIdx} className={groupIdx > 0 ? 'mt-5' : ''}>
                    <div className="px-3 mb-2.5">
                        <span className="text-sidebar-caption text-white/35">
                            {group.label}
                        </span>
                    </div>
                    <ul className="space-y-0.5">
                        {group.items.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item);
                            const badge = getBadge(item);

                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all text-sidebar-primary ${active
                                            ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold'
                                            : 'text-white/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-medium'
                                            }`}
                                    >
                                        <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={active ? 2 : 1.5} />
                                        <span className="flex-1 text-[15px]">{item.label}</span>
                                        {badge !== null && badge > 0 && (
                                            <span className={`min-w-[22px] h-[22px] flex items-center justify-center rounded-full text-[11px] font-bold px-1.5 ${active
                                                ? 'bg-white/25 text-white'
                                                : 'bg-white/10 text-white/70'
                                                }`}>
                                                {badge}
                                            </span>
                                        )}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </nav>
    );
}
