import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import Link from 'next/link';
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
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 fixed h-full">
                <div className="p-6 border-b border-gray-200">
                    <Link href="/" className="text-xl font-bold text-primary">
                        🧭 Compas Admin
                    </Link>
                </div>
                <nav className="p-4">
                    <ul className="space-y-1">
                        {navItems.map((item) => (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors text-gray-700 hover:text-primary"
                                >
                                    <span className="text-lg">{item.icon}</span>
                                    <span className="font-medium">{item.label}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
                    <div className="text-sm text-gray-500">
                        Вы вошли как:
                        <div className="font-medium text-gray-900 truncate">
                            {session.user.email}
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 ml-64 p-8">
                {children}
            </main>
        </div>
    );
}
