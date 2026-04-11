import { db } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import {
    Users,
    TrendingUp,
    TrendingDown,
    Eye,
    CreditCard,
    ArrowRight,
    Activity,
    UserPlus,
    BarChart3,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

// Generate daily visit data for the last N days
async function getDailyVisits(days: number) {
    const result: { date: string; count: number }[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const count = await db.visitorAnalytics.count({
            where: {
                createdAt: { gte: dayStart, lt: dayEnd },
            },
        }).catch(() => 0);

        result.push({
            date: dayStart.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
            count,
        });
    }

    return result;
}

function Sparkline({ data, color = '#6366f1' }: { data: number[]; color?: string }) {
    if (data.length === 0 || data.every(d => d === 0)) {
        return <div className="h-12 flex items-center text-xs text-muted-foreground">Нет данных</div>;
    }

    const max = Math.max(...data, 1);
    const width = 200;
    const height = 48;
    const padding = 2;
    const effectiveWidth = width - padding * 2;
    const effectiveHeight = height - padding * 2;

    const points = data.map((value, index) => {
        const x = padding + (index / Math.max(data.length - 1, 1)) * effectiveWidth;
        const y = padding + effectiveHeight - (value / max) * effectiveHeight;
        return `${x},${y}`;
    });

    const areaPoints = [
        `${padding},${height - padding}`,
        ...points,
        `${width - padding},${height - padding}`,
    ].join(' ');

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
            <defs>
                <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={areaPoints} fill={`url(#grad-${color.replace('#', '')})`} />
            <polyline
                points={points.join(' ')}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function TrendBadge({ current, previous }: { current: number; previous: number }) {
    if (previous === 0 && current === 0) return null;
    const diff = previous > 0 ? Math.round(((current - previous) / previous) * 100) : (current > 0 ? 100 : 0);
    const isUp = diff >= 0;

    return (
        <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${isUp ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>
            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isUp ? '+' : ''}{diff}%
        </span>
    );
}

export default async function AdminDashboard() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(todayStart);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(todayStart);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const [
        totalUsers,
        usersThisWeek,
        usersPrevWeek,
        totalVisitors,
        visitorsThisWeek,
        visitorsPrevWeek,
        activeTrials,
        activeSubs,
        dailyVisits,
        recentUsers,
        topSources,
    ] = await Promise.all([
        db.user.count().catch(() => 0),
        db.user.count({ where: { createdAt: { gte: weekAgo } } }).catch(() => 0),
        db.user.count({ where: { createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }).catch(() => 0),
        db.visitorAnalytics.count().catch(() => 0),
        db.visitorAnalytics.count({ where: { createdAt: { gte: weekAgo } } }).catch(() => 0),
        db.visitorAnalytics.count({ where: { createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }).catch(() => 0),
        db.user.count({ where: { trialEndsAt: { gt: now } } }).catch(() => 0),
        db.user.count({ where: { subscriptionEndsAt: { gt: now } } }).catch(() => 0),
        getDailyVisits(30),
        db.user.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { id: true, name: true, email: true, role: true, createdAt: true },
        }).catch(() => []),
        db.visitorAnalytics.groupBy({
            by: ['utmSource'],
            _count: { id: true },
            where: { utmSource: { not: null }, createdAt: { gte: weekAgo } },
            orderBy: { _count: { id: 'desc' } },
            take: 5,
        }).catch(() => []),
    ]);

    const kpiCards = [
        {
            title: 'Пользователи',
            value: totalUsers,
            current: usersThisWeek,
            previous: usersPrevWeek,
            icon: Users,
            color: '#6366f1',
            bgColor: 'bg-indigo-50',
        },
        {
            title: 'Визиты (7 дн)',
            value: visitorsThisWeek,
            current: visitorsThisWeek,
            previous: visitorsPrevWeek,
            icon: Eye,
            color: '#0ea5e9',
            bgColor: 'bg-sky-50',
        },
        {
            title: 'Активные триалы',
            value: activeTrials,
            current: activeTrials,
            previous: 0,
            icon: UserPlus,
            color: '#f59e0b',
            bgColor: 'bg-amber-50',
        },
        {
            title: 'Подписки',
            value: activeSubs,
            current: activeSubs,
            previous: 0,
            icon: CreditCard,
            color: '#10b981',
            bgColor: 'bg-emerald-50',
        },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[#0f1729]">Дашборд</h1>
                    <p className="text-[#64748b] text-sm mt-0.5">
                        Обзор платформы за последние 7 дней
                    </p>
                </div>
                <div className="text-xs text-[#94a3b8] font-medium">
                    {now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-5 grid-cols-2 lg:grid-cols-4">
                {kpiCards.map((kpi) => {
                    const Icon = kpi.icon;
                    return (
                        <Card key={kpi.title} className="border-0 shadow-sm bg-white">
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className={`w-10 h-10 rounded-xl ${kpi.bgColor} flex items-center justify-center`}>
                                        <Icon className="w-5 h-5" style={{ color: kpi.color }} />
                                    </div>
                                    <TrendBadge current={kpi.current} previous={kpi.previous} />
                                </div>
                                <div className="text-2xl font-bold text-[#0f1729]">{kpi.value.toLocaleString()}</div>
                                <div className="text-xs text-[#94a3b8] font-medium mt-0.5">{kpi.title}</div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Charts Row */}
            <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
                {/* Visits Chart */}
                <Card className="lg:col-span-2 border-0 shadow-sm bg-white">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="font-semibold text-[#0f1729]">Визиты</h3>
                                <p className="text-xs text-[#94a3b8] mt-0.5">За последние 30 дней</p>
                            </div>
                            <Link
                                href="/admin/analytics"
                                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                            >
                                Подробнее <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>
                        <VisitsChart data={dailyVisits} />
                    </CardContent>
                </Card>

                {/* Quick Stats */}
                <div className="space-y-5">
                    {/* Sources */}
                    <Card className="border-0 shadow-sm bg-white">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <BarChart3 className="w-4 h-4 text-indigo-500" />
                                <h3 className="font-semibold text-sm text-[#0f1729]">Источники (7 дн)</h3>
                            </div>
                            {topSources.length === 0 ? (
                                <p className="text-xs text-[#94a3b8]">Нет данных по UTM</p>
                            ) : (
                                <div className="space-y-2.5">
                                    {topSources.map((item, i) => {
                                        const maxCount = topSources[0]._count.id;
                                        const pct = Math.round((item._count.id / maxCount) * 100);
                                        return (
                                            <div key={i}>
                                                <div className="flex items-center justify-between text-xs mb-1">
                                                    <span className="font-medium text-[#334155]">{item.utmSource}</span>
                                                    <span className="text-[#94a3b8]">{item._count.id}</span>
                                                </div>
                                                <div className="h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-indigo-500 rounded-full transition-all"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* System Quick */}
                    <Card className="border-0 shadow-sm bg-white">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <Activity className="w-4 h-4 text-emerald-500" />
                                <h3 className="font-semibold text-sm text-[#0f1729]">Система</h3>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-[#94a3b8]">Всего визитов</span>
                                    <span className="font-semibold text-[#334155]">{totalVisitors.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-[#94a3b8]">Конверсия</span>
                                    <span className="font-semibold text-[#334155]">
                                        {totalVisitors > 0 ? ((totalUsers / totalVisitors) * 100).toFixed(1) : 0}%
                                    </span>
                                </div>
                            </div>
                            <Link
                                href="/admin/health"
                                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium mt-3"
                            >
                                Мониторинг <ArrowRight className="w-3 h-3" />
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Recent Users */}
            <Card className="border-0 shadow-sm bg-white">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="font-semibold text-[#0f1729]">Новые пользователи</h3>
                        <Link
                            href="/admin/users"
                            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                        >
                            Все пользователи <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {recentUsers.length === 0 ? (
                            <p className="text-sm text-[#94a3b8] text-center py-8">Нет пользователей</p>
                        ) : (
                            recentUsers.map((user) => (
                                <div key={user.id} className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 font-semibold text-xs">
                                            {(user.name || user.email)?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-[#0f1729]">{user.name || '—'}</p>
                                            <p className="text-xs text-[#94a3b8]">{user.email}</p>
                                        </div>
                                    </div>
                                    <div className="text-xs text-[#94a3b8]">
                                        {user.createdAt.toLocaleDateString('ru-RU')}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function VisitsChart({ data }: { data: { date: string; count: number }[] }) {
    if (data.length === 0) {
        return <div className="h-48 flex items-center justify-center text-sm text-[#94a3b8]">Нет данных</div>;
    }

    const max = Math.max(...data.map(d => d.count), 1);
    const width = 100; // percentage
    const barCount = data.length;

    return (
        <div className="h-48 flex items-end gap-[2px]">
            {data.map((d, i) => {
                const height = Math.max((d.count / max) * 100, 2);
                const isToday = i === data.length - 1;
                return (
                    <div
                        key={i}
                        className="flex-1 flex flex-col items-center justify-end group relative"
                    >
                        {/* Tooltip */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#0f1729] text-white text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                            {d.date}: {d.count}
                        </div>
                        <div
                            className={`w-full rounded-t-sm transition-all ${isToday ? 'bg-indigo-500' : 'bg-indigo-200 hover:bg-indigo-400'}`}
                            style={{ height: `${height}%` }}
                        />
                    </div>
                );
            })}
        </div>
    );
}
