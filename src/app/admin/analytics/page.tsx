import { db } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Globe, MapPin, Smartphone, Monitor, Tablet, Link2, Eye, Users, Chrome, Cpu } from 'lucide-react';

export const dynamic = 'force-dynamic';

// Fetch daily visits for chart
async function getDailyVisits(days: number) {
    const result: { date: string; label: string; count: number }[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const count = await db.visitorAnalytics.count({
            where: { createdAt: { gte: dayStart, lt: dayEnd } },
        }).catch(() => 0);

        result.push({
            date: dayStart.toISOString().split('T')[0],
            label: dayStart.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
            count,
        });
    }

    return result;
}

function ProgressBar({ value, max, color = 'bg-indigo-500' }: { value: number; max: number; color?: string }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className="flex items-center gap-3 flex-1">
            <div className="flex-1 h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-[#94a3b8] w-8 text-right">{pct}%</span>
        </div>
    );
}

export default async function AnalyticsPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; period?: string }>;
}) {
    const params = await searchParams;
    const page = parseInt(params.page || '1');
    const perPage = 30;

    const [
        visitors,
        totalCount,
        topCountries,
        topCities,
        deviceStats,
        browserStats,
        deviceVendorStats,
        osStats,
        utmStats,
        referrerStats,
        dailyVisits,
    ] = await Promise.all([
        db.visitorAnalytics.findMany({
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * perPage,
            take: perPage,
            select: {
                id: true, visitorId: true, country: true, city: true, district: true,
                deviceType: true, deviceVendor: true, deviceModel: true,
                browserName: true, browserMajor: true, osName: true, osVersion: true,
                language: true, referrer: true, referrerDomain: true,
                utmSource: true, utmMedium: true, utmCampaign: true,
                visits: true, createdAt: true,
            },
        }).catch(() => []),
        db.visitorAnalytics.count().catch(() => 0),
        db.visitorAnalytics.groupBy({
            by: ['country'], _count: { id: true },
            orderBy: { _count: { id: 'desc' } }, take: 10,
        }).catch(() => []),
        db.visitorAnalytics.groupBy({
            by: ['city'], _count: { id: true },
            orderBy: { _count: { id: 'desc' } }, take: 10,
        }).catch(() => []),
        db.visitorAnalytics.groupBy({
            by: ['deviceType'], _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
        }).catch(() => []),
        db.visitorAnalytics.groupBy({
            by: ['browserName'], _count: { id: true },
            where: { browserName: { not: null } },
            orderBy: { _count: { id: 'desc' } }, take: 6,
        }).catch(() => []),
        db.visitorAnalytics.groupBy({
            by: ['deviceVendor'], _count: { id: true },
            where: { deviceVendor: { not: null } },
            orderBy: { _count: { id: 'desc' } }, take: 6,
        }).catch(() => []),
        db.visitorAnalytics.groupBy({
            by: ['osName'], _count: { id: true },
            where: { osName: { not: null } },
            orderBy: { _count: { id: 'desc' } }, take: 6,
        }).catch(() => []),
        db.visitorAnalytics.groupBy({
            by: ['utmSource'], _count: { id: true },
            where: { utmSource: { not: null } },
            orderBy: { _count: { id: 'desc' } }, take: 10,
        }).catch(() => []),
        db.visitorAnalytics.groupBy({
            by: ['referrerDomain'], _count: { id: true },
            where: { referrerDomain: { not: null } },
            orderBy: { _count: { id: 'desc' } }, take: 10,
        }).catch(() => []),
        getDailyVisits(30),
    ]);

    const totalPages = Math.ceil(totalCount / perPage);
    const totalDevices = deviceStats.reduce((s, d) => s + d._count.id, 0);

    const getDeviceIcon = (type: string | null) => {
        switch (type) {
            case 'mobile': return <Smartphone className="w-4 h-4 text-sky-500" />;
            case 'tablet': return <Tablet className="w-4 h-4 text-amber-500" />;
            default: return <Monitor className="w-4 h-4 text-indigo-500" />;
        }
    };

    const deviceLabel = (type: string | null) => {
        switch (type) {
            case 'mobile': return 'Мобильные';
            case 'tablet': return 'Планшеты';
            case 'desktop': return 'Десктоп';
            default: return type || 'Неизвестно';
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-[#0f1729]">Аналитика</h1>
                <p className="text-[#64748b] text-sm mt-0.5">Трафик, источники и поведение посетителей</p>
            </div>

            {/* Top metrics */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Card className="border-0 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                                <Users className="w-5 h-5 text-indigo-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-[#0f1729]">{totalCount.toLocaleString()}</p>
                                <p className="text-xs text-[#94a3b8]">Всего посетителей</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                {deviceStats.slice(0, 3).map((d, i) => (
                    <Card key={i} className="border-0 shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#f8fafc] flex items-center justify-center">
                                    {getDeviceIcon(d.deviceType)}
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-[#0f1729]">{d._count.id.toLocaleString()}</p>
                                    <p className="text-xs text-[#94a3b8]">{deviceLabel(d.deviceType)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="bg-white border shadow-sm p-1 rounded-xl">
                    <TabsTrigger value="overview" className="rounded-lg text-xs">Обзор</TabsTrigger>
                    <TabsTrigger value="sources" className="rounded-lg text-xs">Источники</TabsTrigger>
                    <TabsTrigger value="devices" className="rounded-lg text-xs">Устройства</TabsTrigger>
                    <TabsTrigger value="geo" className="rounded-lg text-xs">География</TabsTrigger>
                    <TabsTrigger value="all" className="rounded-lg text-xs">Все визиты</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="mt-6 space-y-5">
                    <Card className="border-0 shadow-sm">
                        <CardContent className="p-6">
                            <h3 className="font-semibold text-[#0f1729] mb-1">Визиты по дням</h3>
                            <p className="text-xs text-[#94a3b8] mb-6">30 дней</p>
                            <VisitsBarChart data={dailyVisits} />
                        </CardContent>
                    </Card>

                    <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
                        {/* Device split */}
                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-5">
                                <h3 className="font-semibold text-sm text-[#0f1729] mb-4">Устройства</h3>
                                <div className="space-y-3">
                                    {deviceStats.map((d, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            {getDeviceIcon(d.deviceType)}
                                            <span className="text-sm font-medium text-[#334155] w-24">{deviceLabel(d.deviceType)}</span>
                                            <ProgressBar value={d._count.id} max={totalDevices} />
                                            <span className="text-xs font-semibold text-[#334155] w-8 text-right">{d._count.id}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Browsers */}
                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-5">
                                <h3 className="font-semibold text-sm text-[#0f1729] mb-4">Браузеры</h3>
                                <div className="space-y-3">
                                    {browserStats.length === 0 ? (
                                        <p className="text-xs text-[#94a3b8]">Нет данных</p>
                                    ) : (
                                        browserStats.map((b, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <Chrome className="w-4 h-4 text-sky-500" />
                                                <span className="text-sm font-medium text-[#334155] w-24">{b.browserName}</span>
                                                <ProgressBar value={b._count.id} max={browserStats[0]._count.id} color="bg-sky-500" />
                                                <span className="text-xs font-semibold text-[#334155] w-8 text-right">{b._count.id}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Sources Tab */}
                <TabsContent value="sources" className="mt-6 space-y-5">
                    <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Link2 className="w-4 h-4 text-indigo-500" />
                                    <h3 className="font-semibold text-sm text-[#0f1729]">UTM-источники</h3>
                                </div>
                                {utmStats.length === 0 ? (
                                    <p className="text-xs text-[#94a3b8]">Нет UTM-меток</p>
                                ) : (
                                    <div className="space-y-3">
                                        {utmStats.map((item, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <span className="text-sm font-medium text-[#334155] w-32 truncate">{item.utmSource}</span>
                                                <ProgressBar value={item._count.id} max={utmStats[0]._count.id} />
                                                <span className="text-xs font-semibold text-[#334155] w-8 text-right">{item._count.id}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Globe className="w-4 h-4 text-emerald-500" />
                                    <h3 className="font-semibold text-sm text-[#0f1729]">Реферальные домены</h3>
                                </div>
                                {referrerStats.length === 0 ? (
                                    <p className="text-xs text-[#94a3b8]">Все визиты — прямые</p>
                                ) : (
                                    <div className="space-y-3">
                                        {referrerStats.map((item, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <span className="text-sm font-medium text-[#334155] w-32 truncate">{item.referrerDomain}</span>
                                                <ProgressBar value={item._count.id} max={referrerStats[0]._count.id} color="bg-emerald-500" />
                                                <span className="text-xs font-semibold text-[#334155] w-8 text-right">{item._count.id}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Devices Tab */}
                <TabsContent value="devices" className="mt-6 space-y-5">
                    <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Smartphone className="w-4 h-4 text-indigo-500" />
                                    <h3 className="font-semibold text-sm text-[#0f1729]">Производители</h3>
                                </div>
                                {deviceVendorStats.length === 0 ? (
                                    <p className="text-xs text-[#94a3b8]">Нет данных</p>
                                ) : deviceVendorStats.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between py-2 border-b border-[#f1f5f9] last:border-0">
                                        <span className="text-sm font-medium text-[#334155]">{item.deviceVendor}</span>
                                        <span className="text-xs text-[#94a3b8] font-semibold">{item._count.id}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Chrome className="w-4 h-4 text-sky-500" />
                                    <h3 className="font-semibold text-sm text-[#0f1729]">Браузеры</h3>
                                </div>
                                {browserStats.length === 0 ? (
                                    <p className="text-xs text-[#94a3b8]">Нет данных</p>
                                ) : browserStats.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between py-2 border-b border-[#f1f5f9] last:border-0">
                                        <span className="text-sm font-medium text-[#334155]">{item.browserName}</span>
                                        <span className="text-xs text-[#94a3b8] font-semibold">{item._count.id}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Cpu className="w-4 h-4 text-amber-500" />
                                    <h3 className="font-semibold text-sm text-[#0f1729]">Операционные системы</h3>
                                </div>
                                {osStats.length === 0 ? (
                                    <p className="text-xs text-[#94a3b8]">Нет данных</p>
                                ) : osStats.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between py-2 border-b border-[#f1f5f9] last:border-0">
                                        <span className="text-sm font-medium text-[#334155]">{item.osName}</span>
                                        <span className="text-xs text-[#94a3b8] font-semibold">{item._count.id}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Geo Tab */}
                <TabsContent value="geo" className="mt-6 space-y-5">
                    <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Globe className="w-4 h-4 text-indigo-500" />
                                    <h3 className="font-semibold text-sm text-[#0f1729]">Страны</h3>
                                </div>
                                <div className="space-y-3">
                                    {topCountries.length === 0 ? (
                                        <p className="text-xs text-[#94a3b8]">Нет данных</p>
                                    ) : topCountries.map((item, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <span className="text-sm font-medium text-[#334155] w-32">{item.country || 'Неизвестно'}</span>
                                            <ProgressBar value={item._count.id} max={topCountries[0]._count.id} />
                                            <span className="text-xs font-semibold text-[#334155] w-8 text-right">{item._count.id}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <MapPin className="w-4 h-4 text-amber-500" />
                                    <h3 className="font-semibold text-sm text-[#0f1729]">Города</h3>
                                </div>
                                <div className="space-y-3">
                                    {topCities.length === 0 ? (
                                        <p className="text-xs text-[#94a3b8]">Нет данных</p>
                                    ) : topCities.map((item, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <span className="text-sm font-medium text-[#334155] w-32">{item.city || 'Неизвестно'}</span>
                                            <ProgressBar value={item._count.id} max={topCities[0]._count.id} color="bg-amber-500" />
                                            <span className="text-xs font-semibold text-[#334155] w-8 text-right">{item._count.id}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* All Visits Tab */}
                <TabsContent value="all" className="mt-6">
                    <Card className="border-0 shadow-sm">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Дата</TableHead>
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
                                                {v.createdAt.toLocaleDateString('ru-RU')}
                                            </TableCell>
                                            <TableCell>
                                                <p className="font-medium text-sm">
                                                    {[v.country, v.city].filter(Boolean).join(' / ') || '—'}
                                                </p>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm">
                                                    {getDeviceIcon(v.deviceType)}
                                                    <span>{v.deviceVendor || deviceLabel(v.deviceType)}</span>
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

                    {totalPages > 1 && (
                        <div className="flex justify-center mt-4">
                            <p className="text-xs text-[#94a3b8]">Страница {page} из {totalPages}</p>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

function VisitsBarChart({ data }: { data: { date: string; label: string; count: number }[] }) {
    if (data.length === 0) {
        return <div className="h-48 flex items-center justify-center text-sm text-[#94a3b8]">Нет данных</div>;
    }

    const max = Math.max(...data.map(d => d.count), 1);
    const totalVisits = data.reduce((s, d) => s + d.count, 0);
    const avgVisits = Math.round(totalVisits / data.length);

    return (
        <div>
            <div className="flex items-center gap-4 mb-4 text-xs text-[#94a3b8]">
                <span>Всего: <strong className="text-[#334155]">{totalVisits}</strong></span>
                <span>Среднее: <strong className="text-[#334155]">{avgVisits}/день</strong></span>
            </div>
            <div className="h-48 flex items-end gap-[2px]">
                {data.map((d, i) => {
                    const height = Math.max((d.count / max) * 100, 2);
                    const isToday = i === data.length - 1;
                    return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#0f1729] text-white text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                {d.label}: {d.count}
                            </div>
                            <div
                                className={`w-full rounded-t-sm transition-all ${isToday ? 'bg-indigo-500' : 'bg-indigo-200 hover:bg-indigo-400'}`}
                                style={{ height: `${height}%` }}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
