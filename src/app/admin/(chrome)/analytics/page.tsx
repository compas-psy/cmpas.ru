import { db } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import {
    Globe, MapPin, Smartphone, Monitor, Tablet, Link2,
    Eye, Users, Chrome, Cpu, FileText, Clock, TrendingUp,
    TrendingDown, Activity,
} from 'lucide-react';
import {
    VisitsAreaChart,
    DonutChart,
    HorizontalBarChart,
    HourlyBarChart,
    LegendList,
    CHART_COLORS,
    DONUT_PALETTE,
    type TimeSeriesPoint,
    type DonutItem,
} from '@/components/admin/charts';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PERIODS = {
    '7': { days: 7, label: '7 дней', bucket: 'day' },
    '30': { days: 30, label: '30 дней', bucket: 'day' },
    '90': { days: 90, label: '90 дней', bucket: 'day' },
    '180': { days: 180, label: '6 месяцев', bucket: 'week' },
    '365': { days: 365, label: 'Год', bucket: 'month' },
} as const;

type PeriodKey = keyof typeof PERIODS;

function getDateBounds(days: number) {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - days);
    return { start, end, prevStart, prevEnd: start };
}

function pctChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
}

function formatPct(n: number): string {
    return `${n >= 0 ? '+' : ''}${n}%`;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchTimeSeries(
    start: Date,
    end: Date,
    prevStart: Date,
    prevEnd: Date,
    bucket: 'day' | 'week' | 'month',
): Promise<TimeSeriesPoint[]> {
    // Use PageView if available, fall back to VisitorAnalytics.createdAt
    const hasPageViews = await db.pageView.count({
        where: { createdAt: { gte: start, lt: end } },
    }).catch(() => 0);

    const useLegacy = hasPageViews === 0;

    // Fetch all hits in both periods
    const [currentHits, previousHits] = await Promise.all([
        useLegacy
            ? db.visitorAnalytics.findMany({
                where: { createdAt: { gte: start, lt: end } },
                select: { createdAt: true, visitorId: true },
            }).catch(() => [])
            : db.pageView.findMany({
                where: { createdAt: { gte: start, lt: end } },
                select: { createdAt: true, visitorId: true },
            }).catch(() => []),
        useLegacy
            ? db.visitorAnalytics.findMany({
                where: { createdAt: { gte: prevStart, lt: prevEnd } },
                select: { createdAt: true, visitorId: true },
            }).catch(() => [])
            : db.pageView.findMany({
                where: { createdAt: { gte: prevStart, lt: prevEnd } },
                select: { createdAt: true, visitorId: true },
            }).catch(() => []),
    ]);

    // Bucket size in ms
    const msPerBucket =
        bucket === 'day' ? 86400000 :
            bucket === 'week' ? 86400000 * 7 :
                86400000 * 30;

    const totalMs = end.getTime() - start.getTime();
    const numBuckets = Math.max(1, Math.ceil(totalMs / msPerBucket));

    const buckets: TimeSeriesPoint[] = [];
    for (let i = 0; i < numBuckets; i++) {
        const bStart = new Date(start.getTime() + i * msPerBucket);
        const bEnd = new Date(Math.min(bStart.getTime() + msPerBucket, end.getTime()));

        const inBucket = currentHits.filter(h => h.createdAt >= bStart && h.createdAt < bEnd);
        const unique = new Set(inBucket.map(h => h.visitorId)).size;

        // Previous period — same bucket index
        const prevBStart = new Date(prevStart.getTime() + i * msPerBucket);
        const prevBEnd = new Date(Math.min(prevBStart.getTime() + msPerBucket, prevEnd.getTime()));
        const prevInBucket = previousHits.filter(h => h.createdAt >= prevBStart && h.createdAt < prevBEnd);

        let label: string;
        if (bucket === 'day') {
            label = bStart.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
        } else if (bucket === 'week') {
            label = `${bStart.getDate()} ${bStart.toLocaleDateString('ru-RU', { month: 'short' })}`;
        } else {
            label = bStart.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
        }

        buckets.push({
            label,
            visits: inBucket.length,
            visitors: unique,
            prevVisits: prevInBucket.length,
        });
    }

    return buckets;
}

async function fetchHourlyDistribution(start: Date, end: Date) {
    const hits = await db.pageView.findMany({
        where: { createdAt: { gte: start, lt: end } },
        select: { createdAt: true },
    }).catch(() => []);

    // Fallback to VisitorAnalytics if no PageView
    const fallback = hits.length === 0
        ? await db.visitorAnalytics.findMany({
            where: { createdAt: { gte: start, lt: end } },
            select: { createdAt: true },
        }).catch(() => [])
        : [];

    const source = hits.length > 0 ? hits : fallback;

    const byHour = new Array(24).fill(0);
    for (const h of source) {
        byHour[h.createdAt.getHours()]++;
    }

    return byHour.map((value, i) => ({
        hour: String(i).padStart(2, '0'),
        value,
    }));
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
    icon: Icon,
    label,
    value,
    change,
    color,
}: {
    icon: typeof Users;
    label: string;
    value: number;
    change: number;
    color: string;
}) {
    const isUp = change >= 0;
    return (
        <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: `${color}1a` }}
                    >
                        <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    {(value > 0 || change !== 0) && (
                        <span
                            className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${isUp ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'
                                }`}
                        >
                            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {formatPct(change)}
                        </span>
                    )}
                </div>
                <div className="text-2xl font-bold text-[#0f1729]">
                    {value.toLocaleString('ru-RU')}
                </div>
                <div className="text-xs text-[#94a3b8] font-medium mt-0.5">{label}</div>
            </CardContent>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Period selector
// ---------------------------------------------------------------------------

function PeriodSelector({ current }: { current: PeriodKey }) {
    return (
        <div className="inline-flex items-center bg-white border border-[#e2e8f0] rounded-xl p-1 shadow-sm">
            {(Object.keys(PERIODS) as PeriodKey[]).map(key => (
                <Link
                    key={key}
                    href={`/admin/analytics?period=${key}`}
                    prefetch={false}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${current === key
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'text-[#64748b] hover:text-[#0f1729] hover:bg-[#f1f5f9]'
                        }`}
                >
                    {PERIODS[key].label}
                </Link>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AnalyticsPage({
    searchParams,
}: {
    searchParams: Promise<{ period?: string; page?: string }>;
}) {
    const params = await searchParams;
    const periodKey = (params.period && params.period in PERIODS ? params.period : '30') as PeriodKey;
    const period = PERIODS[periodKey];
    const { start, end, prevStart, prevEnd } = getDateBounds(period.days);
    const listPage = parseInt(params.page || '1');
    const perPage = 30;

    const [
        // Totals
        visitsCurrent,
        visitsPrevious,
        visitorsCurrent,
        visitorsPrevious,
        newVisitorsCurrent,
        newVisitorsPrevious,
        pageViewsCount,
        // Dimensions (current period)
        topCountries,
        topCities,
        deviceStats,
        browserStats,
        osStats,
        utmStats,
        referrerStats,
        topPages,
        // Series
        timeSeries,
        hourlyDist,
        // Latest visits
        visitors,
        totalAllTime,
    ] = await Promise.all([
        db.pageView.count({ where: { createdAt: { gte: start, lt: end } } })
            .catch(async () => db.visitorAnalytics.count({ where: { createdAt: { gte: start, lt: end } } }).catch(() => 0)),
        db.pageView.count({ where: { createdAt: { gte: prevStart, lt: prevEnd } } })
            .catch(async () => db.visitorAnalytics.count({ where: { createdAt: { gte: prevStart, lt: prevEnd } } }).catch(() => 0)),
        db.pageView.findMany({
            where: { createdAt: { gte: start, lt: end } },
            distinct: ['visitorId'],
            select: { visitorId: true },
        }).then(r => r.length).catch(() => 0),
        db.pageView.findMany({
            where: { createdAt: { gte: prevStart, lt: prevEnd } },
            distinct: ['visitorId'],
            select: { visitorId: true },
        }).then(r => r.length).catch(() => 0),
        db.pageView.count({ where: { createdAt: { gte: start, lt: end }, isNewVisitor: true } }).catch(() => 0),
        db.pageView.count({ where: { createdAt: { gte: prevStart, lt: prevEnd }, isNewVisitor: true } }).catch(() => 0),
        db.pageView.count({ where: { createdAt: { gte: start, lt: end } } }).catch(() => 0),
        // Countries (from PageView in period)
        db.pageView.groupBy({
            by: ['country'], _count: { id: true },
            where: { createdAt: { gte: start, lt: end }, country: { not: null } },
            orderBy: { _count: { id: 'desc' } }, take: 10,
        }).catch(() => []),
        db.pageView.groupBy({
            by: ['city'], _count: { id: true },
            where: { createdAt: { gte: start, lt: end }, city: { not: null } },
            orderBy: { _count: { id: 'desc' } }, take: 10,
        }).catch(() => []),
        db.pageView.groupBy({
            by: ['deviceType'], _count: { id: true },
            where: { createdAt: { gte: start, lt: end }, deviceType: { not: null } },
            orderBy: { _count: { id: 'desc' } },
        }).catch(() => []),
        db.visitorAnalytics.groupBy({
            by: ['browserName'], _count: { id: true },
            where: { browserName: { not: null }, createdAt: { gte: start, lt: end } },
            orderBy: { _count: { id: 'desc' } }, take: 8,
        }).catch(() => []),
        db.visitorAnalytics.groupBy({
            by: ['osName'], _count: { id: true },
            where: { osName: { not: null }, createdAt: { gte: start, lt: end } },
            orderBy: { _count: { id: 'desc' } }, take: 8,
        }).catch(() => []),
        db.pageView.groupBy({
            by: ['utmSource'], _count: { id: true },
            where: { utmSource: { not: null }, createdAt: { gte: start, lt: end } },
            orderBy: { _count: { id: 'desc' } }, take: 10,
        }).catch(() => []),
        db.pageView.groupBy({
            by: ['referrerDomain'], _count: { id: true },
            where: { referrerDomain: { not: null }, createdAt: { gte: start, lt: end } },
            orderBy: { _count: { id: 'desc' } }, take: 10,
        }).catch(() => []),
        db.pageView.groupBy({
            by: ['pathname'], _count: { id: true },
            where: { pathname: { not: null }, createdAt: { gte: start, lt: end } },
            orderBy: { _count: { id: 'desc' } }, take: 15,
        }).catch(() => []),
        fetchTimeSeries(start, end, prevStart, prevEnd, period.bucket),
        fetchHourlyDistribution(start, end),
        db.visitorAnalytics.findMany({
            orderBy: { updatedAt: 'desc' },
            skip: (listPage - 1) * perPage,
            take: perPage,
            select: {
                id: true, visitorId: true, country: true, city: true,
                deviceType: true, deviceVendor: true,
                browserName: true, browserMajor: true, osName: true,
                referrer: true, referrerDomain: true,
                utmSource: true, visits: true, updatedAt: true,
            },
        }).catch(() => []),
        db.visitorAnalytics.count().catch(() => 0),
    ]);

    // Device donut
    const deviceDonut: DonutItem[] = deviceStats.map((d, i) => ({
        name: d.deviceType === 'mobile' ? 'Смартфоны'
            : d.deviceType === 'tablet' ? 'Планшеты'
                : d.deviceType === 'desktop' ? 'Десктоп'
                    : d.deviceType || 'Неизвестно',
        value: d._count.id,
        color: d.deviceType === 'mobile' ? CHART_COLORS.secondary
            : d.deviceType === 'tablet' ? CHART_COLORS.warning
                : d.deviceType === 'desktop' ? CHART_COLORS.primary
                    : DONUT_PALETTE[i % DONUT_PALETTE.length],
    }));
    const deviceTotal = deviceDonut.reduce((s, d) => s + d.value, 0);

    // Browser donut
    const browserDonut: DonutItem[] = browserStats.map(b => ({
        name: b.browserName || 'Неизвестно',
        value: b._count.id,
    }));
    const browserTotal = browserDonut.reduce((s, d) => s + d.value, 0);

    // OS donut
    const osDonut: DonutItem[] = osStats.map(o => ({
        name: o.osName || 'Неизвестно',
        value: o._count.id,
    }));
    const osTotal = osDonut.reduce((s, d) => s + d.value, 0);

    // New vs returning donut
    const returningCurrent = Math.max(0, visitorsCurrent - newVisitorsCurrent);
    const newVsReturning: DonutItem[] = [
        { name: 'Новые', value: newVisitorsCurrent, color: CHART_COLORS.primary },
        { name: 'Вернувшиеся', value: returningCurrent, color: CHART_COLORS.success },
    ];

    // Sources
    const utmBar = utmStats.slice(0, 8).map(u => ({ name: u.utmSource || '—', value: u._count.id }));
    const referrerBar = referrerStats.slice(0, 8).map(r => ({ name: r.referrerDomain || '—', value: r._count.id }));

    // Geo
    const countryBar = topCountries.map(c => ({ name: c.country || 'Неизвестно', value: c._count.id }));
    const cityBar = topCities.map(c => ({ name: c.city || 'Неизвестно', value: c._count.id }));

    const avgDepth = visitorsCurrent > 0 ? (visitsCurrent / visitorsCurrent).toFixed(1) : '0';

    const getDeviceIcon = (type: string | null) => {
        switch (type) {
            case 'mobile': return <Smartphone className="w-4 h-4 text-sky-500" />;
            case 'tablet': return <Tablet className="w-4 h-4 text-amber-500" />;
            default: return <Monitor className="w-4 h-4 text-indigo-500" />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[#0f1729]">Аналитика</h1>
                    <p className="text-[#64748b] text-sm mt-0.5">
                        Трафик, источники и поведение посетителей · {period.label}
                    </p>
                </div>
                <PeriodSelector current={periodKey} />
            </div>

            {/* KPI Cards — Yandex.Metrica style */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    icon={Users}
                    label="Посетители"
                    value={visitorsCurrent}
                    change={pctChange(visitorsCurrent, visitorsPrevious)}
                    color={CHART_COLORS.primary}
                />
                <KpiCard
                    icon={Eye}
                    label="Визиты"
                    value={visitsCurrent}
                    change={pctChange(visitsCurrent, visitsPrevious)}
                    color={CHART_COLORS.secondary}
                />
                <KpiCard
                    icon={FileText}
                    label="Просмотры"
                    value={pageViewsCount}
                    change={pctChange(pageViewsCount, visitsPrevious)}
                    color={CHART_COLORS.success}
                />
                <KpiCard
                    icon={Activity}
                    label="Глубина просмотра"
                    value={parseFloat(avgDepth)}
                    change={0}
                    color={CHART_COLORS.warning}
                />
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="bg-white border shadow-sm p-1 rounded-xl h-auto">
                    <TabsTrigger value="overview" className="rounded-lg text-xs px-3 py-1.5">Обзор</TabsTrigger>
                    <TabsTrigger value="sources" className="rounded-lg text-xs px-3 py-1.5">Источники</TabsTrigger>
                    <TabsTrigger value="devices" className="rounded-lg text-xs px-3 py-1.5">Устройства</TabsTrigger>
                    <TabsTrigger value="geo" className="rounded-lg text-xs px-3 py-1.5">География</TabsTrigger>
                    <TabsTrigger value="pages" className="rounded-lg text-xs px-3 py-1.5">Страницы</TabsTrigger>
                    <TabsTrigger value="all" className="rounded-lg text-xs px-3 py-1.5">Все визиты</TabsTrigger>
                </TabsList>

                {/* ------ Overview Tab ------ */}
                <TabsContent value="overview" className="mt-6 space-y-5">
                    {/* Main chart */}
                    <Card className="border-0 shadow-sm">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="font-semibold text-[#0f1729]">Посещаемость</h3>
                                <div className="flex items-center gap-4 text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.primary }} />
                                        <span className="text-[#64748b]">Визиты</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.secondary }} />
                                        <span className="text-[#64748b]">Посетители</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-4 h-[2px] border-t border-dashed" style={{ borderColor: CHART_COLORS.slate }} />
                                        <span className="text-[#64748b]">Предыдущий период</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-[#94a3b8] mb-6">{period.label} · обновлено только что</p>
                            <VisitsAreaChart data={timeSeries} height={300} showComparison />
                        </CardContent>
                    </Card>

                    <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
                        {/* New vs returning */}
                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-5">
                                <h3 className="font-semibold text-sm text-[#0f1729] mb-4">Новые и вернувшиеся</h3>
                                <DonutChart
                                    data={newVsReturning}
                                    height={180}
                                    centerLabel="Посетители"
                                    centerValue={visitorsCurrent.toLocaleString('ru-RU')}
                                />
                                <div className="mt-4 pt-4 border-t border-[#f1f5f9]">
                                    <LegendList data={newVsReturning} total={visitorsCurrent} />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Devices donut */}
                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-5">
                                <h3 className="font-semibold text-sm text-[#0f1729] mb-4">Устройства</h3>
                                <DonutChart
                                    data={deviceDonut}
                                    height={180}
                                    centerLabel="Типы"
                                    centerValue={deviceDonut.length}
                                />
                                <div className="mt-4 pt-4 border-t border-[#f1f5f9]">
                                    <LegendList data={deviceDonut} total={deviceTotal} />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Hourly */}
                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Clock className="w-4 h-4 text-indigo-500" />
                                    <h3 className="font-semibold text-sm text-[#0f1729]">По времени суток</h3>
                                </div>
                                <HourlyBarChart data={hourlyDist} height={200} />
                                <p className="text-[10px] text-[#94a3b8] mt-2 text-center">Часы · местное время сервера</p>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ------ Sources Tab ------ */}
                <TabsContent value="sources" className="mt-6 space-y-5">
                    <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Link2 className="w-4 h-4 text-indigo-500" />
                                    <h3 className="font-semibold text-sm text-[#0f1729]">UTM-источники</h3>
                                </div>
                                {utmBar.length === 0 ? (
                                    <p className="text-xs text-[#94a3b8] py-12 text-center">Нет UTM-меток за выбранный период</p>
                                ) : (
                                    <HorizontalBarChart data={utmBar} color={CHART_COLORS.primary} height={Math.max(200, utmBar.length * 32)} />
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Globe className="w-4 h-4 text-emerald-500" />
                                    <h3 className="font-semibold text-sm text-[#0f1729]">Реферальные домены</h3>
                                </div>
                                {referrerBar.length === 0 ? (
                                    <p className="text-xs text-[#94a3b8] py-12 text-center">Все визиты — прямые заходы</p>
                                ) : (
                                    <HorizontalBarChart data={referrerBar} color={CHART_COLORS.success} height={Math.max(200, referrerBar.length * 32)} />
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ------ Devices Tab ------ */}
                <TabsContent value="devices" className="mt-6 space-y-5">
                    <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Smartphone className="w-4 h-4 text-indigo-500" />
                                    <h3 className="font-semibold text-sm text-[#0f1729]">Устройства</h3>
                                </div>
                                <DonutChart data={deviceDonut} height={200} />
                                <div className="mt-4 pt-4 border-t border-[#f1f5f9]">
                                    <LegendList data={deviceDonut} total={deviceTotal} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Chrome className="w-4 h-4 text-sky-500" />
                                    <h3 className="font-semibold text-sm text-[#0f1729]">Браузеры</h3>
                                </div>
                                {browserDonut.length === 0 ? (
                                    <p className="text-xs text-[#94a3b8] py-12 text-center">Нет данных</p>
                                ) : (
                                    <>
                                        <DonutChart data={browserDonut} height={200} />
                                        <div className="mt-4 pt-4 border-t border-[#f1f5f9]">
                                            <LegendList data={browserDonut} total={browserTotal} />
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Cpu className="w-4 h-4 text-amber-500" />
                                    <h3 className="font-semibold text-sm text-[#0f1729]">Операционные системы</h3>
                                </div>
                                {osDonut.length === 0 ? (
                                    <p className="text-xs text-[#94a3b8] py-12 text-center">Нет данных</p>
                                ) : (
                                    <>
                                        <DonutChart data={osDonut} height={200} />
                                        <div className="mt-4 pt-4 border-t border-[#f1f5f9]">
                                            <LegendList data={osDonut} total={osTotal} />
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ------ Geo Tab ------ */}
                <TabsContent value="geo" className="mt-6 space-y-5">
                    <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Globe className="w-4 h-4 text-indigo-500" />
                                    <h3 className="font-semibold text-sm text-[#0f1729]">Страны</h3>
                                </div>
                                {countryBar.length === 0 ? (
                                    <p className="text-xs text-[#94a3b8] py-12 text-center">Нет данных</p>
                                ) : (
                                    <HorizontalBarChart data={countryBar} color={CHART_COLORS.primary} height={Math.max(200, countryBar.length * 32)} />
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <MapPin className="w-4 h-4 text-amber-500" />
                                    <h3 className="font-semibold text-sm text-[#0f1729]">Города</h3>
                                </div>
                                {cityBar.length === 0 ? (
                                    <p className="text-xs text-[#94a3b8] py-12 text-center">Нет данных</p>
                                ) : (
                                    <HorizontalBarChart data={cityBar} color={CHART_COLORS.warning} height={Math.max(200, cityBar.length * 32)} />
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ------ Pages Tab (NEW) ------ */}
                <TabsContent value="pages" className="mt-6">
                    <Card className="border-0 shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <FileText className="w-4 h-4 text-indigo-500" />
                                <h3 className="font-semibold text-sm text-[#0f1729]">Популярные страницы</h3>
                            </div>
                            {topPages.length === 0 ? (
                                <div className="text-center py-12">
                                    <FileText className="w-10 h-10 text-[#cbd5e1] mx-auto mb-3" />
                                    <p className="text-sm text-[#94a3b8]">
                                        Пока нет данных по страницам за этот период.<br />
                                        Данные начнут появляться после новых визитов.
                                    </p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Страница</TableHead>
                                            <TableHead className="text-right">Просмотры</TableHead>
                                            <TableHead className="text-right w-32">Доля</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {topPages.map((p, i) => {
                                            const pct = pageViewsCount > 0 ? Math.round((p._count.id / pageViewsCount) * 100) : 0;
                                            return (
                                                <TableRow key={i}>
                                                    <TableCell className="font-medium text-sm text-[#0f1729]">
                                                        {p.pathname || '—'}
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm font-semibold">
                                                        {p._count.id.toLocaleString('ru-RU')}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center gap-2 justify-end">
                                                            <div className="w-20 h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-indigo-500 rounded-full"
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs text-[#94a3b8] w-8 text-right">{pct}%</span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ------ All Visits Tab ------ */}
                <TabsContent value="all" className="mt-6">
                    <Card className="border-0 shadow-sm">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Последний заход</TableHead>
                                    <TableHead>Локация</TableHead>
                                    <TableHead>Устройство</TableHead>
                                    <TableHead>Браузер</TableHead>
                                    <TableHead>ОС</TableHead>
                                    <TableHead>Источник</TableHead>
                                    <TableHead className="text-right">Визиты</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visitors.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center">
                                            <div className="flex flex-col items-center gap-3 text-[#94a3b8]">
                                                <Eye className="w-10 h-10" />
                                                <p>Нет данных о посетителях</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    visitors.map((v) => (
                                        <TableRow key={v.id}>
                                            <TableCell className="text-[#64748b] text-sm">
                                                {v.updatedAt.toLocaleDateString('ru-RU')}
                                                <span className="text-[#94a3b8] ml-1">
                                                    {v.updatedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <p className="font-medium text-sm">
                                                    {[v.country, v.city].filter(Boolean).join(' / ') || '—'}
                                                </p>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm">
                                                    {getDeviceIcon(v.deviceType)}
                                                    <span>{v.deviceVendor || v.deviceType || 'Неизвестно'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {v.browserName ? `${v.browserName} ${v.browserMajor || ''}`.trim() : '—'}
                                            </TableCell>
                                            <TableCell className="text-sm text-[#64748b]">
                                                {v.osName || '—'}
                                            </TableCell>
                                            <TableCell className="text-sm text-[#64748b]">
                                                {v.utmSource || v.referrerDomain || 'Direct'}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold text-sm">{v.visits}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                    <div className="flex justify-between items-center mt-3 text-xs text-[#94a3b8]">
                        <span>Всего уникальных посетителей за всё время: <strong className="text-[#334155]">{totalAllTime.toLocaleString('ru-RU')}</strong></span>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
