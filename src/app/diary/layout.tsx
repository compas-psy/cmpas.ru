import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { safeReturnPath, DEFAULT_RETURN_PATH } from '@/lib/auth/return-path';
import { auth, signOut } from '@/auth';
import { db } from '@/lib/db';
import Link from 'next/link';
import type { Metadata } from 'next';
import { LogOut, Sparkles } from 'lucide-react';
import { Toaster } from 'sonner';
import { SidebarNav } from './sidebar-nav';
import { MobileSidebar } from './mobile-sidebar';
import { checkUserAcceptance } from '@/app/legal/actions';
import { ACCOUNT_REQUIRED_TYPES } from '@/lib/legal-documents';
import { AdsConsentWrapper } from '@/components/legal/AdsConsentWrapper';
import { TrialBanner } from '@/components/psidairy/TrialBanner';
import { computeBillingStatus } from '@/lib/billing/status';
import { dayWord } from '@/lib/ru-plural';
import { BottomTabBar } from './bottom-tab-bar';

export const metadata: Metadata = {
    title: 'Ежедневник | Compas',
    robots: { index: false, follow: false },
};

/**
 * КАРТОЧКА СОСТОЯНИЯ ОПЛАТЫ В БОКОВОМ МЕНЮ.
 *
 * Здесь было три неправды сразу, и все три — в одном маленьком блоке.
 *
 * 1. Заголовок «Пробный период» показывался и ПЛАТЯЩЕМУ: карточка рисовалась
 *    по одному лишь числу оставшихся дней, а оно не пустое и у подписки.
 *    Человек, оплативший месяц, видел «Пробный период» и кнопку «Выбрать
 *    тариф» — то есть предложение купить то, что он уже купил.
 *
 * 2. «Использовано 70% функций» не мерило функций вовсе. Это прошедшие дни,
 *    переименованные в функции: не открыв ни одного экрана, человек на
 *    двадцать первый день читал, что израсходовал семьдесят процентов.
 *
 * 3. «Осталось 1 дней» — число без согласования.
 *
 * Теперь карточка называет то состояние, в котором человек находится, и
 * полоса показывает то, что считает: прошедшие дни срока.
 */
function BillingCard({ daysLeft, totalDays, mode }: { daysLeft: number; totalDays: number; mode: 'trial' | 'subscription' }) {
    const progress = Math.max(0, Math.min(100, ((totalDays - daysLeft) / totalDays) * 100));
    const trial = mode === 'trial';
    return (
        <div className="mx-4 mb-3 bg-forest-900/60 rounded-2xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-bold text-white/90">{trial ? 'Пробный период' : 'Подписка'}</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-[12px] text-white/50 font-medium mb-3">
                Осталось {daysLeft} {dayWord(daysLeft)}
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
                <div
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                />
            </div>
            <div className="text-[11px] text-white/40 font-medium mb-3">
                {trial ? `Прошло ${totalDays - daysLeft} из ${totalDays} дней` : 'Продлевается вручную'}
            </div>
            <Link
                href="/billing"
                className="block w-full py-2.5 bg-accent text-white text-center rounded-xl text-[13px] font-bold hover:bg-accent/90 transition-all active:scale-[0.98]"
            >
                {trial ? 'Выбрать тариф' : 'Продлить'}
            </Link>
        </div>
    );
}

function SidebarContent({
    userName,
    userInitials,
    daysLeft,
    billingMode,
}: {
    userName: string;
    userInitials: string;
    daysLeft: number | null;
    /** Что именно кончается. null — ни триала, ни подписки: карточки нет. */
    billingMode: 'trial' | 'subscription' | null;
}) {
    return (
        <div className="flex flex-col h-full bg-sidebar">
            <div className="px-6 pt-6 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img src="/icon.png" alt="ПРАКТИКА" className="w-full h-full object-contain" />
                    </div>
                    <p className="text-[17px] font-bold text-white tracking-[0.12em] uppercase">ПРАКТИКА</p>
                </div>
            </div>

            <SidebarNav />

            <div className="mt-auto">
                {billingMode !== null && daysLeft !== null && daysLeft > 0 && (
                    <BillingCard daysLeft={daysLeft} totalDays={30} mode={billingMode} />
                )}

                {/* «ВЫЙТИ» ДОЛЖНО ВЫХОДИТЬ.
                    Здесь стояла обычная ссылка на главную: человек нажимал
                    «Выйти», видел лендинг и считал, что вышел, — а сессия
                    оставалась живой, и любой, кто откроет /diary на том же
                    устройстве, попадал в его практику. На общем компьютере
                    это не мелочь: в карточках клиентов лежат персональные
                    данные, за которые специалист отвечает как оператор.

                    Форма, а не ссылка: выход меняет состояние, и делать это
                    переходом по адресу нельзя. */}
                <div className="px-4 pb-4 pt-2 border-t border-sidebar-border">
                    <form
                        action={async () => {
                            'use server';
                            await signOut({ redirectTo: '/' });
                        }}
                    >
                        <button
                            type="submit"
                            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-white/50 hover:bg-white/5 hover:text-white/80 transition-all text-[14px] font-medium"
                        >
                            <LogOut className="w-[18px] h-[18px]" />
                            <span>Выйти</span>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default async function DiaryLayout({
    children,
}: {
    children: React.ReactNode;
    params?: Promise<any>;
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const session = await auth();

    // Отправляя на вход, запоминаем, куда человек шёл: иначе ссылка из
    // бота на /diary/clients?attest=1 после входа приводит на «Сегодня»,
    // и обещанное окно подтверждения не открывается.
    const here = safeReturnPath((await headers()).get('x-pathname'));
    const signInPath = here === DEFAULT_RETURN_PATH ? '/auth' : `/auth?next=${encodeURIComponent(here)}`;

    if (!session?.user?.email) {
        redirect(signInPath);
    }

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
        redirect(signInPath);
    }

    // Legal gate goes before onboarding: a new psychologist must explicitly
    // accept TERMS first; onboarding must not become an implicit acceptance
    // path. PRIVACY is informational only — it is never in this list.
    const acceptanceCheck = await checkUserAcceptance(ACCOUNT_REQUIRED_TYPES);
    if (acceptanceCheck.success && acceptanceCheck.needsAcceptance && acceptanceCheck.needsAcceptance.length > 0) {
        redirect('/legal-acceptance');
    }

    // Задача 24: обязательный барьер после legal остался ровно один —
    // сами документы. Раньше следом стоял второй: пока
    // onboardingCompleted=false, /diary целиком подменялся визардом
    // /onboarding, и человек не мог даже посмотреть кабинет, не пройдя его.
    //
    // Настройка практики — помощь, а не пропуск: она живёт чек-листом на
    // дашборде, который можно закрыть. Подменять этот барьер новым, по
    // completed из чек-листа, тем более нельзя — чек-лист не барьер вовсе.
    //
    // Страница /onboarding остаётся доступной сама по себе: на неё ведут
    // письма и старые ссылки, и её проходят по желанию.

    // ОДНО ПРАВИЛО НА ВОПРОС «КОНЧИЛСЯ ЛИ ДОСТУП».
    //
    // Здесь стояла собственная копия правила — и это была ПРЕЖНЯЯ его
    // версия, которую однажды признали неверной и переписали в
    // src/lib/billing/status.ts. Ошибка прежней версии: конец доступа брался
    // из даты пробного периода всегда, когда подписка не активна. У человека,
    // который оплатил сразу, не пробуя, даты триала нет вовсе — и конец
    // доступа получался «неизвестно», то есть доступ не кончался никогда.
    //
    // Поймать это сегодня трудно: src/auth.ts проставляет дату триала при
    // каждом входе, если её нет. Но два ответа на один вопрос существовали, и
    // правило, охраняющее деньги, жило в двух видах — до первой правки в
    // одном из них.
    //
    // Запроса не добавляется: dbUser уже прочитан целиком, а computeBillingStatus —
    // чистая функция над теми же тремя полями, и именно её проверяют тесты.
    const billing = computeBillingStatus(dbUser);

    if (billing.isExpired) {
        redirect('/billing');
    }

    const daysLeft = billing.daysLeft;
    // Что именно кончается — решает то же правило, а не экран. Раньше экран
    // звал это «пробным периодом» в обоих случаях.
    const billingMode = billing.trialActive ? 'trial' as const
        : billing.subscriptionActive ? 'subscription' as const
            : null;

    const userName = session.user.name || session.user.email?.split('@')[0] || 'Психолог';
    const userInitials = userName.slice(0, 2).toUpperCase();

    return (
        <div className="min-h-screen bg-background flex">
            <aside className="hidden md:flex w-[252px] fixed h-full flex-col z-30" style={{ boxShadow: '4px 0 24px rgba(20,32,24,0.06)' }}>
                <SidebarContent userName={userName} userInitials={userInitials} daysLeft={daysLeft} billingMode={billingMode} />
            </aside>

            <MobileSidebar>
                <SidebarContent userName={userName} userInitials={userInitials} daysLeft={daysLeft} billingMode={billingMode} />
            </MobileSidebar>

            {/*
              * Задача 27: min-w-0 — не косметика, а причина, по которой кабинет
              * вообще помещался в телефон. flex-элемент по умолчанию не
              * сжимается уже своего содержимого (min-width: auto), поэтому
              * одна широкая строка внутри страницы растягивала <main> шире
              * экрана — и вместе с ним уезжали вправо и шапка, и нижняя
              * панель, и кнопка «Сохранить». Внутренний overflow-x-hidden от
              * этого не спасал: переполнение случалось этажом выше.
              */}
            <main className="flex-1 min-w-0 md:ml-[252px] pt-16 md:pt-0 min-h-screen">
                {/* Баннер предупреждает о конце ТОГО срока, который идёт. Раньше
                    он говорил «пробный период заканчивается» и платящему
                    подписчику в последнюю неделю оплаченного месяца. */}
                {billingMode !== null && daysLeft !== null && daysLeft <= 7 && (
                    <TrialBanner daysLeft={daysLeft} mode={billingMode} />
                )}
                <div className="p-4 md:p-8 pb-24 md:pb-8 max-w-[1400px] mx-auto overflow-x-hidden">
                    {children}
                </div>
            </main>

            <Toaster position="top-right" richColors theme="system" />
            <BottomTabBar />
            <AdsConsentWrapper userId={dbUser.id} />
        </div>
    );
}
