import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import Link from 'next/link';
import type { Metadata } from 'next';
import { LogOut, Sparkles } from 'lucide-react';
import { Toaster } from 'sonner';
import { SidebarNav } from './sidebar-nav';
import { MobileSidebar } from './mobile-sidebar';
import { checkUserAcceptance } from '@/app/legal/actions';
import { AdsConsentWrapper } from '@/components/legal/AdsConsentWrapper';
import { TrialBanner } from '@/components/psidairy/TrialBanner';
import { BottomTabBar } from './bottom-tab-bar';

export const metadata: Metadata = {
    title: 'Ежедневник | Compas',
    robots: { index: false, follow: false },
};

function TrialCard({ daysLeft, totalDays }: { daysLeft: number; totalDays: number }) {
    const progress = Math.max(0, Math.min(100, ((totalDays - daysLeft) / totalDays) * 100));
    return (
        <div className="mx-4 mb-3 bg-forest-900/60 rounded-2xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-bold text-white/90">Пробный период</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-[12px] text-white/50 font-medium mb-3">
                Осталось {daysLeft} дней
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
                <div
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                />
            </div>
            <div className="text-[11px] text-white/40 font-medium mb-3">
                Использовано {Math.round(progress)}% функций
            </div>
            <Link
                href="/billing"
                className="block w-full py-2.5 bg-accent text-white text-center rounded-xl text-[13px] font-bold hover:bg-accent/90 transition-all active:scale-[0.98]"
            >
                Выбрать тариф
            </Link>
        </div>
    );
}

function SidebarContent({
    userName,
    userInitials,
    daysLeft,
}: {
    userName: string;
    userInitials: string;
    daysLeft: number | null;
}) {
    return (
        <div className="flex flex-col h-full bg-sidebar">
            {/* Logo */}
            <div className="px-6 pt-6 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img src="/icon.png" alt="Компаc" className="w-full h-full object-contain" />
                    </div>
                    <p className="text-[17px] font-bold text-white tracking-[0.12em] uppercase">КОМПАС</p>
                </div>
            </div>

            {/* Navigation */}
            <SidebarNav />

            {/* Trial Card or Spacer */}
            <div className="mt-auto">
                {daysLeft !== null && daysLeft > 0 && (
                    <TrialCard daysLeft={daysLeft} totalDays={30} />
                )}

                {/* Logout */}
                <div className="px-4 pb-4 pt-2 border-t border-sidebar-border">
                    <Link
                        href="/"
                        className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-white/50 hover:bg-white/5 hover:text-white/80 transition-all text-[14px] font-medium"
                    >
                        <LogOut className="w-[18px] h-[18px]" />
                        <span>Выйти</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default async function DiaryLayout({
    children,
    params,
    searchParams,
}: {
    children: React.ReactNode;
    params?: Promise<any>;
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const resolvedSearch = searchParams ? await searchParams : {};
    const fromOnboarding = resolvedSearch?.from === 'onboarding';

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

    if (!dbUser) {
        redirect('/auth');
    }

    // Legal gate runs before onboarding: a psychologist must accept TERMS+PRIVACY
    // (and see any version bump) before ever reaching the onboarding wizard.
    const acceptanceCheck = await checkUserAcceptance(dbUser.id, ["TERMS", "PRIVACY"]);
    if (acceptanceCheck.success && acceptanceCheck.needsAcceptance && acceptanceCheck.needsAcceptance.length > 0) {
        redirect('/legal-acceptance');
    }

    if (!dbUser?.psychologistSettings?.onboardingCompleted && !fromOnboarding) {
        redirect('/onboarding');
    }

    // Trial & subscription check
    const trialEndsAt = dbUser.trialEndsAt;
    const now = new Date();
    const isForever = trialEndsAt && trialEndsAt.getFullYear() >= 2099;

    const subscriptionEndsAt = dbUser.subscriptionEndsAt;

    const hasActiveSub = subscriptionEndsAt && subscriptionEndsAt > now;
    const effectiveEnd = hasActiveSub ? subscriptionEndsAt : trialEndsAt;
    const isExpired = !isForever && effectiveEnd && effectiveEnd < now;

    if (isExpired) {
        redirect('/billing');
    }

    const daysLeft = (!isForever && effectiveEnd)
        ? Math.ceil((effectiveEnd.getTime() - now.getTime()) / 86400000)
        : null;

    const userName = session.user.name || session.user.email?.split('@')[0] || 'Психолог';
    const userInitials = userName.slice(0, 2).toUpperCase();

    return (
        <div className="min-h-screen bg-background flex">
            {/* Desktop sidebar — 252px width */}
            <aside className="hidden md:flex w-[252px] fixed h-full flex-col z-30" style={{ boxShadow: '4px 0 24px rgba(20,32,24,0.06)' }}>
                <SidebarContent userName={userName} userInitials={userInitials} daysLeft={daysLeft} />
            </aside>

            {/* Mobile sidebar */}
            <MobileSidebar>
                <SidebarContent userName={userName} userInitials={userInitials} daysLeft={daysLeft} />
            </MobileSidebar>

            {/* Main content — 252px offset, 32px padding */}
            <main className="flex-1 md:ml-[252px] pt-16 md:pt-0 min-h-screen">
                {daysLeft !== null && daysLeft <= 7 && <TrialBanner daysLeft={daysLeft} />}
                <div className="p-4 md:p-8 pb-24 md:pb-8 max-w-[1400px] mx-auto overflow-x-hidden">
                    {children}
                </div>
            </main>

            <Toaster position="top-right" richColors theme="system" />

            {/* Mobile Bottom Tab Bar */}
            <BottomTabBar />

            {/* Deferred Ads Consent Modal */}
            <AdsConsentWrapper userId={dbUser.id} />
        </div>
    );
}
