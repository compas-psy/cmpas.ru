import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import Link from 'next/link';
import type { Metadata } from 'next';
import { LogOut } from 'lucide-react';
import { Toaster } from 'sonner';
import { SidebarNav } from './sidebar-nav';
import { MobileSidebar } from './mobile-sidebar';
import { checkUserAcceptance } from '@/app/legal/actions';
import { AdsConsentWrapper } from '@/components/legal/AdsConsentWrapper';

export const metadata: Metadata = {
    title: 'Ежедневник | Compas',
    robots: { index: false, follow: false },
};

function SidebarContent({ userName, userInitials }: { userName: string; userInitials: string }) {
    return (
        <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
            {/* Logo */}
            <div className="p-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img src="/icon.png" alt="Компаc" className="w-full h-full object-contain" />
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

    if (!dbUser?.psychologistSettings?.onboardingCompleted) {
        redirect('/onboarding');
    }

    // Check if user has accepted the latest mandatory documents
    const acceptanceCheck = await checkUserAcceptance(dbUser.id, ["TERMS", "PRIVACY"]);
    if (acceptanceCheck.success && acceptanceCheck.needsAcceptance && acceptanceCheck.needsAcceptance.length > 0) {
        // We redirect to a page OUTSIDE of /diary to avoid layout loops
        redirect('/legal-acceptance');
    }

    const userName = session.user.name || session.user.email?.split('@')[0] || 'Психолог';
    const userInitials = userName.slice(0, 2).toUpperCase();

    return (
        <div className="min-h-screen bg-background flex">
            {/* Desktop sidebar */}
            <aside className="hidden md:flex w-72 border-r border-sidebar-border fixed h-full flex-col z-30 shadow-sm">
                <SidebarContent userName={userName} userInitials={userInitials} />
            </aside>

            {/* Mobile sidebar */}
            <MobileSidebar>
                <SidebarContent userName={userName} userInitials={userInitials} />
            </MobileSidebar>

            {/* Main content */}
            <main className="flex-1 md:ml-72 pt-16 md:pt-0 min-h-screen">
                <div className="p-4 md:p-8 max-w-6xl mx-auto">
                    {children}
                </div>
            </main>

            <Toaster position="top-right" richColors theme="system" />

            {/* Deferred Ads Consent Modal */}
            <AdsConsentWrapper userId={dbUser.id} />
        </div>
    );
}
