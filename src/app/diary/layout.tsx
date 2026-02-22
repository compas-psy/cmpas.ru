import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Calendar, Users, Clock, Link2, Settings, LogOut, Menu, X } from 'lucide-react';
import { Toaster } from 'sonner';
import { SidebarNav } from './sidebar-nav';

export const metadata: Metadata = {
    title: 'Ежедневник | Compas',
    robots: { index: false, follow: false },
};

function SidebarContent({ userName, userInitials }: { userName: string; userInitials: string }) {
    return (
        <div className="flex flex-col h-full bg-card">
            {/* Logo & User */}
            <div className="p-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0 shadow-sm border border-primary/20">
                        {userInitials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-foreground truncate">{userName}</p>
                        <p className="text-sm font-medium text-muted-foreground">Психолог</p>
                    </div>
                </div>
            </div>

            <div className="mx-6 h-px bg-border/50" />

            {/* Navigation */}
            <SidebarNav />

            {/* Footer */}
            <div className="p-4 mt-auto border-t border-border/50">
                <Link
                    href="/"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-foreground hover:bg-destructive/10 hover:text-destructive transition-colors text-sm font-semibold"
                >
                    <LogOut className="w-5 h-5" />
                    <span>Выйти</span>
                </Link>
            </div>
        </div>
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
    let dbUser;
    try {
        dbUser = await db.user.findUnique({
            where: { email: session.user.email },
            include: { psychologistSettings: true }
        });
    } catch (error: any) {
        return (
            <div className="p-10 bg-red-50 text-red-900 border border-red-200 m-10 rounded-xl">
                <h1 className="text-2xl font-bold mb-4">Server Error in DiaryLayout</h1>
                <p className="font-mono whitespace-pre-wrap">{error?.message || 'Unknown error'}</p>
            </div>
        );
    }

    if (!dbUser?.psychologistSettings) {
        redirect('/onboarding');
    }

    const userName = session.user.name || session.user.email?.split('@')[0] || 'Психолог';
    const userInitials = userName.slice(0, 2).toUpperCase();

    return (
        <div className="min-h-screen bg-background flex">
            {/* Desktop sidebar */}
            <aside className="hidden md:flex w-72 border-r border-border fixed h-full flex-col z-30 shadow-sm">
                <SidebarContent userName={userName} userInitials={userInitials} />
            </aside>

            {/* Mobile header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-card/80 backdrop-blur-md border-b border-border z-40 flex items-center px-4 gap-3 shadow-sm">
                <label htmlFor="diary-sidebar-toggle" className="p-2 -ml-2 cursor-pointer rounded-xl hover:bg-muted transition-colors active:scale-95">
                    <Menu className="w-6 h-6" />
                </label>
                <div className="font-bold text-lg tracking-tight">Ежедневник</div>
            </div>

            {/* Mobile sidebar overlay */}
            <input type="checkbox" id="diary-sidebar-toggle" className="hidden peer" />
            <div className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 opacity-0 pointer-events-none peer-checked:opacity-100 peer-checked:pointer-events-auto transition-opacity duration-300">
                <label htmlFor="diary-sidebar-toggle" className="absolute inset-0" />
            </div>
            <aside className="md:hidden fixed top-0 left-0 bottom-0 w-[300px] z-50 flex flex-col -translate-x-full peer-checked:translate-x-0 transition-transform duration-300 rounded-r-3xl shadow-2xl overflow-hidden bg-card">
                <div className="flex items-center justify-end p-4 bg-card">
                    <label htmlFor="diary-sidebar-toggle" className="p-2 cursor-pointer hover:bg-muted rounded-xl transition-colors active:scale-95">
                        <X className="w-6 h-6 text-muted-foreground" />
                    </label>
                </div>
                <SidebarContent userName={userName} userInitials={userInitials} />
            </aside>

            {/* Main content */}
            <main className="flex-1 md:ml-72 pt-16 md:pt-0 min-h-screen">
                <div className="p-4 md:p-8 max-w-6xl mx-auto">
                    {children}
                </div>
            </main>

            <Toaster position="top-right" richColors theme="system" />
        </div>
    );
}
