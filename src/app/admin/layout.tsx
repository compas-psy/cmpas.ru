import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Admin Panel | Compas',
    robots: { index: false, follow: false },
};

const navItems = [
    { href: '/admin', label: 'Dashboard', icon: '📊' },
    { href: '/admin/orders', label: 'Заказы', icon: '📦' },
    { href: '/admin/visitors', label: 'Посетители', icon: '👥' },
    { href: '/admin/users', label: 'Пользователи', icon: '👤' },
    { href: '/admin/audit', label: 'Аудит', icon: '🔐' },
    { href: '/admin/system', label: 'Система', icon: '⚙️' },
];

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    // Check if user is admin
    if (!session?.user?.email) {
        redirect('/auth');
    }

    // Check admin role (allow ADMIN and SUPERADMIN)
    const userRole = (session.user as { role?: string }).role;
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
        redirect('/');
    }

    return (
        <div className="min-h-screen bg-background flex">
            {/* Sidebar */}
            <aside className="w-64 bg-primary fixed h-full shadow-xl">
                {/* Logo */}
                <div className="p-6 border-b border-white/10">
                    <Link href="/" className="flex items-center gap-3">
                        <Image
                            src="/images/logo.png"
                            alt="Compas Logo"
                            width={40}
                            height={40}
                            className="rounded-lg"
                        />
                        <div>
                            <span className="text-white font-bold text-lg">Compas</span>
                            <span className="text-accent text-xs block">Admin Panel</span>
                        </div>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="p-4 mt-2">
                    <ul className="space-y-1">
                        {navItems.map((item) => (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white"
                                >
                                    <span className="text-lg">{item.icon}</span>
                                    <span className="font-medium">{item.label}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* User Info */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10 bg-primary">
                    <div className="text-sm text-white/60">
                        Вы вошли как:
                        <div className="font-medium text-white truncate mt-1">
                            {session.user.email}
                        </div>
                        <span className="inline-block mt-2 px-2 py-0.5 text-xs bg-accent text-primary rounded-full font-bold">
                            {userRole}
                        </span>
                    </div>
                    <Link
                        href="/"
                        className="mt-3 block w-full text-center py-2 text-sm text-white/70 hover:text-white border border-white/20 rounded-lg hover:bg-white/10 transition"
                    >
                        ← На сайт
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
