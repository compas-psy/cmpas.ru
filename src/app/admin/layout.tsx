import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
    LayoutDashboard,
    BarChart3,
    Users,
    Activity,
    Shield,
    FileText,
    LogOut,
    ChevronLeft,
    MessageSquare,
} from 'lucide-react';

export const metadata: Metadata = {
    title: 'Admin Panel | Compas',
    robots: { index: false, follow: false },
};

const navItems = [
    { href: '/admin', label: 'Дашборд', icon: LayoutDashboard },
    { href: '/admin/analytics', label: 'Аналитика', icon: BarChart3 },
    { href: '/admin/users', label: 'Пользователи', icon: Users },
    { href: '/admin/communications', label: 'Коммуникации', icon: MessageSquare },
    { href: '/admin/health', label: 'Здоровье', icon: Activity },
    { href: '/admin/audit', label: 'Безопасность', icon: Shield },
    { href: '/admin/legal', label: 'Документы', icon: FileText },
];

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (!session?.user?.email) {
        redirect('/auth');
    }

    const userRole = (session.user as { role?: string }).role;
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
        redirect('/');
    }

    const userName = session.user.name || session.user.email?.split('@')[0] || 'Admin';
    const userInitials = userName.slice(0, 2).toUpperCase();

    return (
        <div className="min-h-screen bg-[#f8f9fb] flex">
            {/* Sidebar */}
            <aside className="w-[260px] bg-[#0f1729] fixed h-full flex flex-col z-30">
                {/* Logo */}
                <div className="px-5 pt-6 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/30">
                            К
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white tracking-wider">КОМПАС</p>
                            <p className="text-[10px] text-white/40 font-medium uppercase tracking-widest">Admin</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 mt-2">
                    <ul className="space-y-0.5">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.07] transition-all text-[13px] font-medium"
                                    >
                                        <Icon className="w-[18px] h-[18px] group-hover:text-indigo-400 transition-colors" strokeWidth={1.8} />
                                        <span>{item.label}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* User & Footer */}
                <div className="px-3 pb-4 space-y-2">
                    <div className="h-px bg-white/[0.06] mx-2" />
                    <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold text-[11px]">
                            {userInitials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-white/90 truncate">{userName}</p>
                            <p className="text-[11px] text-white/30">{userRole}</p>
                        </div>
                    </div>
                    <Link
                        href="/diary"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all text-[13px] font-medium"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        <span>В кабинет</span>
                    </Link>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 ml-[260px] min-h-screen">
                <div className="p-8 max-w-[1400px] mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
