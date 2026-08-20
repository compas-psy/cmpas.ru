import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import type { Metadata } from 'next';

// Единственная проверка роли для всего /admin, включая /admin/panel/*.
// Второго механизма авторизации в панели нет — она наследует этот
// (ТЗ §1: «использовать её же, второй механизм не писать»).
// robots: noindex тоже объявлен здесь и наследуется всеми вложенными экранами.
export const metadata: Metadata = {
    title: 'Admin Panel | Compas',
    robots: { index: false, follow: false },
};

export const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'] as const;

export default async function AdminRootLayout({
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

    return <>{children}</>;
}
