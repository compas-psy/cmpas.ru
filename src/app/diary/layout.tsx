import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
    Calendar,
    Users,
    Clock,
    Link2,
    Settings,
    LogOut,
    Menu,
    X,
} from 'lucide-react';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
    title: 'Ежедневник | Compas',
    robots: { index: false, follow: false },
};

const navItems = [
    { href: '/diary', label: 'Календарь', icon: Calendar },
    { href: '/diary/clients', label: 'Клиенты', icon: Users },
    { href: '/diary/availability', label: 'Расписание', icon: Clock },
    { href: '/diary/integrations', label: 'Интеграции', icon: Link2 },
    { href: '/diary/settings', label: 'Настройки', icon: Settings },
];

function SidebarContent({ userName, userInitials }: { userName: string; userInitials: string }) {
    return (
        <>
            {/* Logo & User */}
            <div className="p-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                        {userInitials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{userName}</p>
                        <p className="text-xs text-muted-foreground">Психолог</p>
                    </div>
                </div>
            </div>

            <div className="mx-4 h-px bg-border" />

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

            <div className="mx-4 h-px bg-border" />

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
        </>
    );
}

export default async function DiaryLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (!session?.user?.email) {
        redirect('/auth');
    }

    // Fetch user with settings to determine onboarding and block status
    const dbUser = await db.user.findUnique({
        where: { email: session.user.email },
        include: { psychologistSettings: true }
    });

    if (dbUser?.isBlocked) {
        redirect('/auth/blocked');
    }

    if (!dbUser?.psychologistSettings) {
        redirect('/onboarding');
    }

    const userName = session.user.name || session.user.email?.split('@')[0] || 'Психолог';
    const userInitials = userName.slice(0, 2).toUpperCase();

    return (
        <div className="min-h-screen bg-[#f5f5f5] flex">
            {/* Desktop sidebar */}
            <aside className="hidden md:flex w-64 bg-white border-r border-border fixed h-full flex-col z-30">
                <SidebarContent userName={userName} userInitials={userInitials} />
            </aside>

            {/* Mobile header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-border z-40 flex items-center px-4 gap-3">
                <label htmlFor="diary-sidebar-toggle" className="p-1 cursor-pointer">
                    <Menu className="w-6 h-6" />
                </label>
                <span className="font-semibold text-sm">Ежедневник</span>
            </div>

            {/* Mobile sidebar overlay */}
            <input type="checkbox" id="diary-sidebar-toggle" className="hidden peer" />
            <div className="md:hidden fixed inset-0 bg-black/40 z-40 opacity-0 pointer-events-none peer-checked:opacity-100 peer-checked:pointer-events-auto transition-opacity">
                <label htmlFor="diary-sidebar-toggle" className="absolute inset-0" />
            </div>
            <aside className="md:hidden fixed top-0 left-0 bottom-0 w-72 bg-white z-50 flex flex-col -translate-x-full peer-checked:translate-x-0 transition-transform">
                <div className="flex items-center justify-end p-3">
                    <label htmlFor="diary-sidebar-toggle" className="p-2 cursor-pointer hover:bg-muted rounded-lg">
                        <X className="w-5 h-5" />
                    </label>
                </div>
                <SidebarContent userName={userName} userInitials={userInitials} />
            </aside>

            {/* Main content */}
            <main className="flex-1 md:ml-64 pt-14 md:pt-0 min-h-screen">
                <div className="p-4 md:p-8">
                    {children}
                </div>
            </main>

            <Toaster position="top-right" richColors />
        </div>
    );
}
