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
        <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
            {/* Logo & User */}
            {/* Logo */}
            <div className="p-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                        {/* A rough approximation of the tree logo */}
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                            <path d="M12 22v-6" />
                            <path d="M12 16a4 4 0 0 0 4-4V8c0-2-2-4-4-4s-4 2-4 4v4a4 4 0 0 0 4 4z" />
                            <path d="M8 12h8" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-lg font-bold text-sidebar-foreground tracking-widest uppercase truncate">КОМПАС</p>
                    </div>
                </div>
            </div>

            <div className="mx-6 h-px bg-sidebar-border" />

            {/* Navigation */}
            <SidebarNav />

            {/* Footer */}
            <div className="p-4 mt-auto border-t border-sidebar-border">
                <Link
                    href="/"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sidebar-foreground hover:bg-destructive/20 hover:text-destructive transition-colors text-sm font-semibold"
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
            <aside className="hidden md:flex w-72 border-r border-sidebar-border fixed h-full flex-col z-30 shadow-sm">
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
            <aside className="md:hidden fixed top-0 left-0 bottom-0 w-[300px] z-50 flex flex-col -translate-x-full peer-checked:translate-x-0 transition-transform duration-300 rounded-r-3xl shadow-2xl overflow-hidden bg-sidebar">
                <div className="flex items-center justify-end p-4 bg-sidebar">
                    <label htmlFor="diary-sidebar-toggle" className="p-2 cursor-pointer hover:bg-sidebar-accent rounded-xl transition-colors active:scale-95">
                        <X className="w-6 h-6 text-sidebar-foreground" />
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
