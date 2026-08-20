'use client';

import { useState, useTransition } from 'react';
import {
    LayoutGrid, User, CreditCard, Scale, BookOpen, Activity, MessageSquare,
    Users, Calendar, Clock, TrendingUp, Shield, Send,
    Tag, StickyNote, Trash2, Pin, Plus, X, Loader2, ChevronRight,
    Lock, Unlock, RefreshCw, Infinity, Zap, Mail, AlertTriangle,
    Check, FileText, Globe, Smartphone, Monitor,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    toggleUserBlock, changeUserRole, resetUserTrialFromNow, setUserTrialForever,
    extendUserTrial, testModeReset, deleteUserAccount,
} from '@/app/admin/actions/users';
import {
    addUserNote, deleteUserNote, toggleNotePin,
    addUserTag, removeUserTag,
    sendAdminMessage, logAdminAction,
} from '@/app/admin/actions/crm';

type TabKey = 'overview' | 'profile' | 'billing' | 'legal' | 'diary' | 'activity' | 'communicate';

const TABS: { key: TabKey; label: string; icon: typeof LayoutGrid }[] = [
    { key: 'overview', label: 'Обзор', icon: LayoutGrid },
    { key: 'profile', label: 'Профиль', icon: User },
    { key: 'billing', label: 'Оплата', icon: CreditCard },
    { key: 'legal', label: 'Легал', icon: Scale },
    { key: 'diary', label: 'Кабинет', icon: BookOpen },
    { key: 'activity', label: 'Журнал', icon: Activity },
    { key: 'communicate', label: 'Связь', icon: MessageSquare },
];

function formatDate(d: string | Date | null | undefined) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatDateTime(d: string | Date | null | undefined) {
    if (!d) return '—';
    return new Date(d).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function UserDetailTabs({ user }: { user: any }) {
    const [tab, setTab] = useState<TabKey>('overview');
    const [isPending, startTransition] = useTransition();

    return (
        <div>
            {/* Tab Navigation */}
            <div className="flex gap-1 bg-white rounded-xl shadow-sm p-1 mb-6 overflow-x-auto">
                {TABS.map(t => {
                    const Icon = t.icon;
                    const isActive = tab === t.key;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                                isActive
                                    ? 'bg-[#0f1729] text-white shadow-sm'
                                    : 'text-[#64748b] hover:text-[#0f1729] hover:bg-gray-50'
                            }`}
                        >
                            <Icon className="w-4 h-4" strokeWidth={1.8} />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            {tab === 'overview' && <OverviewTab user={user} onNavigate={setTab} />}
            {tab === 'profile' && <ProfileTab user={user} />}
            {tab === 'billing' && <BillingTab user={user} />}
            {tab === 'legal' && <LegalTab user={user} />}
            {tab === 'diary' && <DiaryTab user={user} />}
            {tab === 'activity' && <ActivityTab user={user} />}
            {tab === 'communicate' && <CommunicateTab user={user} />}
        </div>
    );
}

// ═══════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════
function OverviewTab({ user, onNavigate }: { user: any; onNavigate: (t: TabKey) => void }) {
    const [isPending, startTransition] = useTransition();

    const kpiCards = [
        { label: 'Клиентов', value: user._counts.clients, icon: Users, color: 'text-blue-600 bg-blue-50' },
        { label: 'Сессий', value: `${user._counts.completedSessions} / ${user._counts.sessions}`, icon: Calendar, color: 'text-green-600 bg-green-50' },
        { label: 'Слотов', value: user._counts.slots, icon: Clock, color: 'text-amber-600 bg-amber-50' },
        { label: 'За 30 дн', value: user._counts.sessionsLast30, icon: TrendingUp, color: 'text-purple-600 bg-purple-50' },
    ];

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
                {kpiCards.map(kpi => {
                    const Icon = kpi.icon;
                    return (
                        <div key={kpi.label} className="bg-white rounded-2xl shadow-sm p-5">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider">{kpi.label}</span>
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${kpi.color}`}>
                                    <Icon className="w-4 h-4" strokeWidth={1.8} />
                                </div>
                            </div>
                            <p className="text-2xl font-bold text-[#0f1729]">{kpi.value}</p>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-2 gap-6">
                {/* Quick Actions */}
                <div className="bg-white rounded-2xl shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-[#0f1729] mb-4">Быстрые действия</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <QuickAction
                            icon={user.isBlocked ? Unlock : Lock}
                            label={user.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                            variant={user.isBlocked ? 'success' : 'danger'}
                            onClick={() => {
                                startTransition(async () => {
                                    await toggleUserBlock(user.id, !user.isBlocked);
                                    await logAdminAction(user.isBlocked ? 'unblock' : 'block', user.id);
                                    toast.success(user.isBlocked ? 'Разблокирован' : 'Заблокирован');
                                    window.location.reload();
                                });
                            }}
                        />
                        <QuickAction
                            icon={RefreshCw}
                            label="Сброс триал 30д"
                            onClick={() => {
                                startTransition(async () => {
                                    await resetUserTrialFromNow(user.id, 30);
                                    toast.success('Триал сброшен на 30 дней');
                                    window.location.reload();
                                });
                            }}
                        />
                        <QuickAction icon={MessageSquare} label="Написать" onClick={() => onNavigate('communicate')} />
                        <QuickAction icon={StickyNote} label="Заметка" onClick={() => onNavigate('communicate')} />
                    </div>
                </div>

                {/* Mini Timeline */}
                <div className="bg-white rounded-2xl shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-[#0f1729] mb-4">Последние события</h3>
                    <div className="space-y-3">
                        {[...user._recentAudit.map((a: any) => ({
                            type: 'audit',
                            date: a.createdAt,
                            text: auditLabel(a.action),
                            ip: a.ipAddress,
                        })), ...user._recentAdminActions.map((a: any) => ({
                            type: 'admin',
                            date: a.createdAt,
                            text: actionLabel(a.action),
                        }))]
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .slice(0, 5)
                            .map((event, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${event.type === 'audit' ? 'bg-blue-400' : 'bg-amber-400'}`} />
                                    <div className="min-w-0">
                                        <p className="text-sm text-[#0f1729] truncate">{event.text}</p>
                                        <p className="text-[11px] text-[#94a3b8]">
                                            {formatDateTime(event.date)}
                                            {event.ip ? ` · ${event.ip}` : ''}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        {user._recentAudit.length === 0 && user._recentAdminActions.length === 0 && (
                            <p className="text-sm text-[#94a3b8] text-center py-4">Нет событий</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Tags */}
            {user._tags.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-[#0f1729] mb-3">Теги</h3>
                    <div className="flex flex-wrap gap-2">
                        {user._tags.map((t: any) => (
                            <span key={t.id} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium">
                                #{t.tag}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function QuickAction({ icon: Icon, label, onClick, variant = 'default' }: {
    icon: typeof Lock; label: string; onClick: () => void; variant?: 'default' | 'danger' | 'success';
}) {
    const colors = {
        default: 'hover:bg-gray-50 text-[#64748b] hover:text-[#0f1729]',
        danger: 'hover:bg-red-50 text-[#64748b] hover:text-red-600',
        success: 'hover:bg-green-50 text-[#64748b] hover:text-green-600',
    };
    return (
        <button onClick={onClick} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border border-gray-100 ${colors[variant]}`}>
            <Icon className="w-4 h-4" strokeWidth={1.8} />
            {label}
        </button>
    );
}

// ═══════════════════════════════════════════
// PROFILE TAB
// ═══════════════════════════════════════════
function ProfileTab({ user }: { user: any }) {
    const ps = user.psychologistSettings;
    const ns = user.notificationSettings?.[0];

    return (
        <div className="space-y-6">
            {/* Account */}
            <Section title="Аккаунт">
                <InfoRow label="Email" value={user.email} />
                <InfoRow label="Имя" value={user.name || '—'} />
                <InfoRow label="Email подтверждён" value={user.emailVerified ? `✓ ${formatDate(user.emailVerified)}` : '✗ Нет'} />
                <InfoRow label="Методы входа" value={user.accounts.map((a: any) => `${a.provider} (${a.type})`).join(', ') || 'Email Magic Link'} />
                <InfoRow label="Онбординг" value={ps ? '✓ Пройден' : '✗ Не завершён'} />
            </Section>

            {/* Psychologist Settings */}
            {ps && (
                <Section title="Профиль психолога">
                    <InfoRow label="Полное имя" value={ps.fullName || '—'} />
                    <InfoRow label="Часовой пояс" value={ps.timezone || '—'} />
                    <InfoRow label="Базовая цена" value={ps.basePrice ? `${ps.basePrice} ₽` : '—'} />
                    <InfoRow label="Длительность" value={ps.defaultSessionDuration ? `${ps.defaultSessionDuration} мин` : '—'} />
                    <InfoRow label="Перерыв" value={ps.sessionBreak != null ? `${ps.sessionBreak} мин` : '—'} />
                    <InfoRow label="Макс. сессий/день" value={ps.maxSessionsPerDay?.toString() || '—'} />
                    <InfoRow label="Методы" value={ps.methods?.join(', ') || '—'} />
                    <InfoRow label="Политика отмены" value={ps.cancellationPolicy || '—'} />
                    <InfoRow label="Режим расписания" value={ps.scheduleMode || '—'} />
                    <InfoRow label="Ссылка онлайн" value={ps.onlineSessionLink || '—'} />
                </Section>
            )}

            {/* Notifications */}
            {ns && (
                <Section title="Уведомления">
                    <InfoRow label="Новая запись" value={ns.newBooking ? '✓' : '✗'} />
                    <InfoRow label="Отмена" value={ns.cancellation ? '✓' : '✗'} />
                    <InfoRow label="Напоминания" value={ns.reminder ? '✓' : '✗'} />
                </Section>
            )}

            {/* Addresses */}
            {user._addresses.length > 0 && (
                <Section title="Адреса">
                    {user._addresses.map((a: any) => (
                        <InfoRow key={a.id} label={a.name} value={a.address} />
                    ))}
                </Section>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════
// BILLING TAB
// ═══════════════════════════════════════════
function BillingTab({ user }: { user: any }) {
    const [isPending, startTransition] = useTransition();
    const [addDays, setAddDays] = useState(30);
    const [addMonths, setAddMonths] = useState(1);

    const now = new Date();
    const hasActiveSubscription = user.subscriptionEndsAt && new Date(user.subscriptionEndsAt) > now;
    const hasActiveTrial = user.trialEndsAt && new Date(user.trialEndsAt) > now;
    const isForever = user.trialEndsAt && new Date(user.trialEndsAt) > new Date('2090-01-01');

    return (
        <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
                <h3 className="text-sm font-semibold text-[#0f1729] mb-4">Текущий статус</h3>
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div>
                        <p className="text-xs text-[#94a3b8] mb-1">План</p>
                        <p className="text-sm font-semibold text-[#0f1729]">{user.subscriptionPlan || 'Нет'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-[#94a3b8] mb-1">Триал до</p>
                        <p className="text-sm font-semibold text-[#0f1729]">
                            {isForever ? '∞ Навсегда' : formatDate(user.trialEndsAt)}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-[#94a3b8] mb-1">Подписка до</p>
                        <p className="text-sm font-semibold text-[#0f1729]">{formatDate(user.subscriptionEndsAt)}</p>
                    </div>
                </div>

                {/* Management Actions */}
                <h3 className="text-sm font-semibold text-[#0f1729] mb-3">Управление</h3>
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <button
                            disabled={isPending}
                            onClick={() => startTransition(async () => {
                                await resetUserTrialFromNow(user.id, 30);
                                await logAdminAction('trial_reset', user.id, { days: 30 });
                                toast.success('Триал сброшен на 30 дней');
                                window.location.reload();
                            })}
                            className="px-4 py-2 bg-[#0f1729] text-white text-sm font-medium rounded-xl hover:bg-[#1a2744] transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className="w-3.5 h-3.5 inline mr-2" />
                            Сбросить триал (30 дн)
                        </button>
                        <button
                            disabled={isPending}
                            onClick={() => startTransition(async () => {
                                await setUserTrialForever(user.id);
                                await logAdminAction('trial_forever', user.id);
                                toast.success('Вечный доступ установлен');
                                window.location.reload();
                            })}
                            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
                        >
                            <Infinity className="w-3.5 h-3.5 inline mr-2" />
                            Вечный доступ
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-[#64748b]">Продлить триал на</span>
                        <input
                            type="number" min="1" max="365" value={addDays}
                            onChange={e => setAddDays(Number(e.target.value))}
                            className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-center"
                        />
                        <span className="text-sm text-[#64748b]">дней</span>
                        <button
                            disabled={isPending}
                            onClick={() => startTransition(async () => {
                                await extendUserTrial(user.id, addDays);
                                await logAdminAction('trial_reset', user.id, { days: addDays, type: 'extend' });
                                toast.success(`Триал продлён на ${addDays} дн`);
                                window.location.reload();
                            })}
                            className="px-3 py-1.5 bg-gray-100 text-[#0f1729] text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                            Продлить
                        </button>
                    </div>
                </div>
            </div>

            {/* Payments Table */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[#0f1729]">История платежей</h3>
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-3 py-1 rounded-lg">
                        Итого: {(user._counts.totalPaid / 100).toLocaleString('ru-RU')} ₽
                    </span>
                </div>
                {user.payments.length === 0 ? (
                    <p className="text-sm text-[#94a3b8] text-center py-4">Нет платежей</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[#94a3b8] text-xs uppercase tracking-wider border-b border-gray-100">
                                <th className="pb-3">Дата</th>
                                <th className="pb-3">План</th>
                                <th className="pb-3">Сумма</th>
                                <th className="pb-3">Мес.</th>
                                <th className="pb-3">Статус</th>
                                <th className="pb-3">Order ID</th>
                            </tr>
                        </thead>
                        <tbody>
                            {user.payments.map((p: any) => (
                                <tr key={p.id} className="border-b border-gray-50">
                                    <td className="py-2.5">{formatDate(p.createdAt)}</td>
                                    <td className="py-2.5 font-medium">{p.plan}</td>
                                    <td className="py-2.5">{(p.amount / 100).toLocaleString('ru-RU')} ₽</td>
                                    <td className="py-2.5">{p.months}</td>
                                    <td className="py-2.5">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                            p.status === 'paid' ? 'bg-green-100 text-green-700' :
                                            p.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                            'bg-red-100 text-red-700'
                                        }`}>{p.status}</span>
                                    </td>
                                    <td className="py-2.5 text-[#94a3b8] text-xs font-mono">{p.orderId}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════
// LEGAL TAB
// ═══════════════════════════════════════════
function LegalTab({ user }: { user: any }) {
    const docTypes = ['TERMS', 'PRIVACY', 'ADS'];
    const docLabels: Record<string, string> = {
        TERMS: 'Условия использования',
        PRIVACY: 'Политика конфиденциальности',
        ADS: 'Согласие на рекламу',
    };

    return (
        <div className="space-y-6">
            {/* Status Cards */}
            <div className="grid grid-cols-3 gap-4">
                {docTypes.map(type => {
                    const acceptance = user.legalAcceptances.find((a: any) => a.document?.type === type);
                    return (
                        <div key={type} className="bg-white rounded-2xl shadow-sm p-5">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-medium text-[#94a3b8] uppercase">{type}</span>
                                {acceptance ? (
                                    <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                                        <Check className="w-3.5 h-3.5 text-green-600" />
                                    </span>
                                ) : (
                                    <span className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                                        <X className="w-3.5 h-3.5 text-red-600" />
                                    </span>
                                )}
                            </div>
                            <p className="text-sm font-semibold text-[#0f1729] mb-1">{docLabels[type]}</p>
                            {acceptance ? (
                                <div className="text-xs text-[#64748b] space-y-0.5">
                                    <p>Версия: {acceptance.document?.version}</p>
                                    <p>Принято: {formatDateTime(acceptance.acceptedAt)}</p>
                                    {acceptance.ipAddress && <p>IP: {acceptance.ipAddress}</p>}
                                </div>
                            ) : (
                                <p className="text-xs text-red-500">Не принято</p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* All Acceptances Table */}
            {user.legalAcceptances.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-[#0f1729] mb-4">Полная история</h3>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[#94a3b8] text-xs uppercase tracking-wider border-b border-gray-100">
                                <th className="pb-3">Тип</th>
                                <th className="pb-3">Версия</th>
                                <th className="pb-3">Дата</th>
                                <th className="pb-3">IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {user.legalAcceptances.map((a: any) => (
                                <tr key={a.id} className="border-b border-gray-50">
                                    <td className="py-2.5">{a.document?.type || '—'}</td>
                                    <td className="py-2.5 font-medium">{a.document?.version || '—'}</td>
                                    <td className="py-2.5">{formatDateTime(a.acceptedAt)}</td>
                                    <td className="py-2.5 text-[#94a3b8] font-mono text-xs">{a.ipAddress || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════
// DIARY TAB
// ═══════════════════════════════════════════
function DiaryTab({ user }: { user: any }) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
                {/* Stats */}
                <div className="bg-white rounded-2xl shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-[#0f1729] mb-4">Состояние кабинета</h3>
                    <div className="space-y-3">
                        <InfoRow label="Клиентов" value={String(user._counts.clients)} />
                        <InfoRow label="Всего сессий" value={String(user._counts.sessions)} />
                        <InfoRow label="Завершённых" value={String(user._counts.completedSessions)} />
                        <InfoRow label="Слотов расписания" value={String(user._counts.slots)} />
                        <InfoRow label="Онлайн-ссылка" value={user.psychologistSettings?.onlineSessionLink || '—'} />
                        <InfoRow label="Базовая цена" value={user.psychologistSettings?.basePrice ? `${user.psychologistSettings.basePrice} ₽` : '—'} />
                    </div>
                </div>

                {/* Calendar Integrations */}
                <div className="bg-white rounded-2xl shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-[#0f1729] mb-4">Календарная интеграция</h3>
                    {user._calendarIntegrations.length === 0 ? (
                        <p className="text-sm text-[#94a3b8] text-center py-4">Не подключено</p>
                    ) : (
                        <div className="space-y-3">
                            {user._calendarIntegrations.map((ci: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                    <div>
                                        <p className="text-sm font-medium text-[#0f1729] capitalize">{ci.provider}</p>
                                        <p className="text-xs text-[#94a3b8]">{ci.accountEmail || '—'}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${ci.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {ci.isActive ? 'Активно' : 'Откл.'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Upcoming Sessions */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-[#0f1729] mb-4">Предстоящие сессии</h3>
                {user._upcomingSessions.length === 0 ? (
                    <p className="text-sm text-[#94a3b8] text-center py-4">Нет предстоящих сессий</p>
                ) : (
                    <div className="space-y-2">
                        {user._upcomingSessions.map((s: any) => (
                            <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <Calendar className="w-4 h-4 text-[#94a3b8]" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-[#0f1729]">
                                        {formatDate(s.date)} · {s.time}
                                    </p>
                                    <p className="text-xs text-[#64748b]">{s.client?.name || 'Клиент'} · {s.format}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    s.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                }`}>{s.status}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Addresses */}
            {user._addresses.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-[#0f1729] mb-4">Адреса</h3>
                    <div className="space-y-2">
                        {user._addresses.map((a: any) => (
                            <InfoRow key={a.id} label={a.name} value={a.address} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════
// ACTIVITY TAB
// ═══════════════════════════════════════════
function ActivityTab({ user }: { user: any }) {
    // Combine both audit and admin logs
    const events = [
        ...user._recentAudit.map((a: any) => ({
            type: 'auth' as const, date: a.createdAt, action: a.action,
            text: auditLabel(a.action), ip: a.ipAddress, ua: a.userAgent,
        })),
        ...user._recentAdminActions.map((a: any) => ({
            type: 'admin' as const, date: a.createdAt, action: a.action,
            text: actionLabel(a.action), payload: a.payload,
        })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-sm font-semibold text-[#0f1729] mb-4">Хронология событий</h3>
            {events.length === 0 ? (
                <p className="text-sm text-[#94a3b8] text-center py-8">Нет событий</p>
            ) : (
                <div className="space-y-0">
                    {events.map((event, i) => (
                        <div key={i} className="flex items-start gap-4 py-3 border-b border-gray-50 last:border-0">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                event.type === 'auth' ? 'bg-blue-50' : 'bg-amber-50'
                            }`}>
                                {event.type === 'auth' ? (
                                    <Shield className="w-4 h-4 text-blue-600" strokeWidth={1.8} />
                                ) : (
                                    <Zap className="w-4 h-4 text-amber-600" strokeWidth={1.8} />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#0f1729]">{event.text}</p>
                                <p className="text-[11px] text-[#94a3b8]">
                                    {formatDateTime(event.date)}
                                    {event.ip ? ` · IP: ${event.ip}` : ''}
                                </p>
                            </div>
                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                                event.type === 'auth' ? 'text-blue-500 bg-blue-50' : 'text-amber-500 bg-amber-50'
                            }`}>
                                {event.type === 'auth' ? 'AUTH' : 'ADMIN'}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════
// COMMUNICATE TAB
// ═══════════════════════════════════════════
function CommunicateTab({ user }: { user: any }) {
    const [channel, setChannel] = useState<'telegram' | 'max' | 'email'>('telegram');
    const [message, setMessage] = useState('');
    const [subject, setSubject] = useState('');
    const [sending, setSending] = useState(false);
    const [messages, setMessages] = useState<any[]>([]);
    const [messagesLoaded, setMessagesLoaded] = useState(false);

    // Notes
    const [notes, setNotes] = useState<any[]>(user._notes || []);
    const [newNote, setNewNote] = useState('');
    const [savingNote, setSavingNote] = useState(false);

    // Tags
    const [tags, setTags] = useState<any[]>(user._tags || []);
    const [newTag, setNewTag] = useState('');
    const [savingTag, setSavingTag] = useState(false);

    const channels = [
        { key: 'telegram' as const, label: 'Telegram', available: !!user.telegramChatId, icon: Send },
        { key: 'max' as const, label: 'MAX', available: !!user.maxChatId, icon: MessageSquare },
        { key: 'email' as const, label: 'Email', available: !!user.email, icon: Mail },
    ];

    const handleSend = async () => {
        if (!message.trim()) return;
        setSending(true);
        try {
            const result = await sendAdminMessage(user.id, channel, message, channel === 'email' ? subject : undefined);
            if (result.success) {
                toast.success('Сообщение отправлено');
                setMessage('');
                setSubject('');
                // Reload messages
                const { getMessageHistory } = await import('@/app/admin/actions/crm');
                const updated = await getMessageHistory(user.id);
                setMessages(updated);
            } else {
                toast.error(result.error || 'Ошибка отправки');
            }
        } catch (err: any) {
            toast.error(err.message || 'Ошибка');
        }
        setSending(false);
    };

    const handleAddNote = async () => {
        if (!newNote.trim()) return;
        setSavingNote(true);
        try {
            const note = await addUserNote(user.id, newNote);
            setNotes(prev => [note, ...prev]);
            setNewNote('');
            toast.success('Заметка добавлена');
        } catch { toast.error('Ошибка'); }
        setSavingNote(false);
    };

    const handleAddTag = async () => {
        if (!newTag.trim()) return;
        setSavingTag(true);
        try {
            const tag = await addUserTag(user.id, newTag);
            setTags(prev => [...prev, tag]);
            setNewTag('');
            toast.success('Тег добавлен');
        } catch { toast.error('Ошибка'); }
        setSavingTag(false);
    };

    const handleRemoveTag = async (tag: string) => {
        try {
            await removeUserTag(user.id, tag);
            setTags(prev => prev.filter(t => t.tag !== tag));
        } catch { toast.error('Ошибка'); }
    };

    // Load messages on mount
    if (!messagesLoaded) {
        import('@/app/admin/actions/crm').then(mod => {
            mod.getMessageHistory(user.id).then(msgs => {
                setMessages(msgs);
                setMessagesLoaded(true);
            });
        });
    }

    return (
        <div className="space-y-6">
            {/* Send Message */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
                <h3 className="text-sm font-semibold text-[#0f1729] mb-4">Отправить сообщение</h3>
                {/* Channel Selection */}
                <div className="flex gap-2 mb-4">
                    {channels.map(ch => {
                        const Icon = ch.icon;
                        return (
                            <button
                                key={ch.key}
                                onClick={() => ch.available && setChannel(ch.key)}
                                disabled={!ch.available}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                    channel === ch.key && ch.available
                                        ? 'bg-[#0f1729] text-white'
                                        : ch.available
                                            ? 'bg-gray-50 text-[#64748b] hover:bg-gray-100'
                                            : 'bg-gray-50 text-[#c4c9d2] cursor-not-allowed'
                                }`}
                                title={!ch.available ? `${ch.label} не подключён` : ''}
                            >
                                <Icon className="w-4 h-4" strokeWidth={1.8} />
                                {ch.label}
                                {ch.available ? <Check className="w-3 h-3 text-green-500" /> : <X className="w-3 h-3" />}
                            </button>
                        );
                    })}
                </div>
                {channel === 'email' && (
                    <input
                        type="text"
                        placeholder="Тема письма"
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                    />
                )}
                <textarea
                    placeholder="Сообщение..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                />
                <button
                    onClick={handleSend}
                    disabled={sending || !message.trim()}
                    className="mt-3 px-6 py-2.5 bg-[#0f1729] text-white text-sm font-medium rounded-xl hover:bg-[#1a2744] transition-colors disabled:opacity-50"
                >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : <Send className="w-4 h-4 inline mr-2" />}
                    Отправить
                </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
                {/* Message History */}
                <div className="bg-white rounded-2xl shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-[#0f1729] mb-4">История сообщений</h3>
                    {messages.length === 0 ? (
                        <p className="text-sm text-[#94a3b8] text-center py-4">Нет сообщений</p>
                    ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {messages.map((m: any) => (
                                <div key={m.id} className="p-3 bg-gray-50 rounded-xl">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                            m.channel === 'telegram' ? 'bg-blue-100 text-blue-600' :
                                            m.channel === 'max' ? 'bg-violet-100 text-violet-600' :
                                            'bg-green-100 text-green-600'
                                        }`}>{m.channel}</span>
                                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                                            m.status === 'delivered' ? 'bg-green-100 text-green-600' :
                                            m.status === 'failed' ? 'bg-red-100 text-red-600' :
                                            'bg-gray-100 text-gray-500'
                                        }`}>{m.status}</span>
                                    </div>
                                    <p className="text-sm text-[#0f1729] line-clamp-2">{m.content}</p>
                                    <p className="text-[11px] text-[#94a3b8] mt-1">{formatDateTime(m.createdAt)}</p>
                                    {m.errorMsg && (
                                        <p className="text-[11px] text-red-500 mt-1">⚠ {m.errorMsg}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Notes */}
                <div className="bg-white rounded-2xl shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-[#0f1729] mb-4">Заметки</h3>
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            placeholder="Добавить заметку..."
                            value={newNote}
                            onChange={e => setNewNote(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                        <button
                            onClick={handleAddNote}
                            disabled={savingNote || !newNote.trim()}
                            className="px-3 py-2 bg-[#0f1729] text-white rounded-lg text-sm disabled:opacity-50"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {notes.map((n: any) => (
                            <div key={n.id} className={`p-3 rounded-xl text-sm ${n.pinned ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
                                <p className="text-[#0f1729]">{n.content}</p>
                                <p className="text-[11px] text-[#94a3b8] mt-1">{formatDateTime(n.createdAt)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tags */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
                <h3 className="text-sm font-semibold text-[#0f1729] mb-4">Теги</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                    {tags.map((t: any) => (
                        <span key={t.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium">
                            #{t.tag}
                            <button onClick={() => handleRemoveTag(t.tag)} className="hover:text-red-600 transition-colors">
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Новый тег..."
                        value={newTag}
                        onChange={e => setNewTag(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                        className="w-48 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                    <button
                        onClick={handleAddTag}
                        disabled={savingTag || !newTag.trim()}
                        className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                    >
                        <Tag className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-sm font-semibold text-[#0f1729] mb-4">{title}</h3>
            <div className="space-y-3">{children}</div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between py-1">
            <span className="text-sm text-[#64748b]">{label}</span>
            <span className="text-sm font-medium text-[#0f1729] text-right max-w-[60%] break-all">{value}</span>
        </div>
    );
}

function auditLabel(action: string): string {
    const labels: Record<string, string> = {
        LOGIN_SUCCESS: 'Успешный вход',
        LOGIN_FAILED: 'Неудачный вход',
        OTP_REQUESTED: 'Запрошен OTP-код',
        OTP_VERIFIED: 'OTP подтверждён',
        LOGOUT: 'Выход',
        PASSWORD_CHANGE: 'Смена пароля',
    };
    return labels[action] || action;
}

function actionLabel(action: string): string {
    const labels: Record<string, string> = {
        block: 'Заблокирован',
        unblock: 'Разблокирован',
        role_change: 'Изменена роль',
        trial_reset: 'Сброс триала',
        trial_forever: 'Вечный доступ',
        test_reset: 'Тестовый сброс',
        delete: 'Удалён',
        message_sent: 'Отправлено сообщение',
        note_added: 'Добавлена заметка',
        tag_added: 'Добавлен тег',
        tag_removed: 'Удалён тег',
        mass_communication: 'Массовая рассылка',
    };
    return labels[action] || action;
}
