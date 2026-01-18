import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import {
    LayoutDashboard,
    ShoppingCart,
    Users,
    Eye,
    Shield,
    Settings,
    LogOut
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = {
    title: 'Admin Panel | Compas',
    robots: { index: false, follow: false },
};

const navItems = [
    { href: '/admin', label: 'Главная', icon: LayoutDashboard },
    { href: '/admin/orders', label: 'Заказы', icon: ShoppingCart },
    { href: '/admin/visitors', label: 'Посетители', icon: Eye },
    { href: '/admin/users', label: 'Пользователи', icon: Users },
    { href: '/admin/audit', label: 'Безопасность', icon: Shield },
    { href: '/admin/system', label: 'Настройки', icon: Settings },
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
        <div className="min-h-screen bg-background flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-border fixed h-full flex flex-col">
                {/* Logo & User */}
                <div className="p-4">
                    <div className="flex items-center gap-3 p-2">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm">
                            {userInitials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{userName}</p>
                            <p className="text-xs text-foreground/60 font-light">Psycho</p>
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Navigation */}
                <nav className="flex-1 p-3">
                    <ul className="space-y-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-primary hover:text-white transition-colors text-sm font-medium"
                                    >
                                        <Icon className="w-5 h-5" strokeWidth={1.5} />
                                        <span>{item.label}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                <Separator />

                {/* Footer */}
                <div className="p-3">
                    <Link
                        href="/"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors text-sm font-medium"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>Выйти</span>
                    </Link>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 ml-64 p-8 bg-background min-h-screen">
                {children}
            </main>
        </div>
    );
}
