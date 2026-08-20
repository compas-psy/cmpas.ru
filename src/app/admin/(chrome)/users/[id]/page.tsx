import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getUserDetailsFull } from '@/app/admin/actions/crm';
import UserDetailTabs from './user-detail-tabs';

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getUserDetailsFull(id);
    if (!user) return notFound();

    // Determine account status
    const now = new Date();
    const hasActiveSubscription = user.subscriptionEndsAt && user.subscriptionEndsAt > now;
    const hasActiveTrial = user.trialEndsAt && user.trialEndsAt > now;
    const isForever = user.trialEndsAt && user.trialEndsAt > new Date('2090-01-01');
    const daysSinceRegistration = Math.floor((now.getTime() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    let planBadge = { label: 'Нет доступа', color: 'bg-red-100 text-red-700' };
    if (isForever) planBadge = { label: '∞ Вечный', color: 'bg-purple-100 text-purple-700' };
    else if (hasActiveSubscription) planBadge = { label: `💳 ${user.subscriptionPlan || 'Подписка'}`, color: 'bg-green-100 text-green-700' };
    else if (hasActiveTrial) {
        const daysLeft = Math.ceil((user.trialEndsAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        planBadge = { label: `🎁 Триал (${daysLeft} дн)`, color: 'bg-amber-100 text-amber-700' };
    }

    const roleBadge = {
        USER: { label: 'Пользователь', color: 'bg-gray-100 text-gray-600' },
        ADMIN: { label: 'Администратор', color: 'bg-indigo-100 text-indigo-700' },
        SUPERADMIN: { label: 'Суперадмин', color: 'bg-red-100 text-red-700' },
    }[user.role] || { label: user.role, color: 'bg-gray-100 text-gray-600' };

    return (
        <div>
            {/* Breadcrumb + Back */}
            <div className="mb-6">
                <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#0f1729] transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                    Назад к пользователям
                </Link>
            </div>

            {/* Header Card */}
            <div className="bg-white rounded-2xl border-0 shadow-sm p-6 mb-6">
                <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                        {user.image ? (
                            <img src={user.image} alt="" className="w-16 h-16 rounded-2xl object-cover" />
                        ) : (
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xl font-bold">
                                {(user.name || user.email || '?')[0].toUpperCase()}
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-bold text-[#0f1729] truncate">{user.name || 'Без имени'}</h1>
                        <p className="text-sm text-[#64748b] truncate">{user.email}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${roleBadge.color}`}>
                                {roleBadge.label}
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${planBadge.color}`}>
                                {planBadge.label}
                            </span>
                            {user.isBlocked && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-700">
                                    🚫 Заблокирован
                                </span>
                            )}
                            <span className="text-xs text-[#94a3b8]">
                                Регистрация {daysSinceRegistration} дн. назад
                            </span>
                        </div>
                    </div>

                    {/* Quick Channels */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${user.telegramChatId ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                            TG {user.telegramChatId ? '✓' : '✗'}
                        </span>
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${user.maxChatId ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-400'}`}>
                            MAX {user.maxChatId ? '✓' : '✗'}
                        </span>
                        <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-green-100 text-green-600">
                            Email ✓
                        </span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <UserDetailTabs user={JSON.parse(JSON.stringify(user))} />
        </div>
    );
}
