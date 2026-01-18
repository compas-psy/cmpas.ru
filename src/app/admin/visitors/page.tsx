import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Globe, MapPin, Smartphone, Monitor, Tablet, Link2, Eye, Users } from 'lucide-react';

export default async function VisitorsPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const params = await searchParams;
    const page = parseInt(params.page || '1');
    const perPage = 30;

    const [visitors, totalCount, topCountries, topCities, deviceStats, utmStats] = await Promise.all([
        db.visitorAnalytics.findMany({
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * perPage,
            take: perPage,
            select: {
                id: true,
                visitorId: true,
                country: true,
                city: true,
                deviceType: true,
                language: true,
                referrer: true,
                utmSource: true,
                visits: true,
                createdAt: true,
            },
        }).catch(() => []),
        db.visitorAnalytics.count().catch(() => 0),
        db.visitorAnalytics.groupBy({
            by: ['country'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 10,
        }).catch(() => []),
        db.visitorAnalytics.groupBy({
            by: ['city'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 10,
        }).catch(() => []),
        db.visitorAnalytics.groupBy({
            by: ['deviceType'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
        }).catch(() => []),
        db.visitorAnalytics.groupBy({
            by: ['utmSource'],
            _count: { id: true },
            where: { utmSource: { not: null } },
            orderBy: { _count: { id: 'desc' } },
            take: 10,
        }).catch(() => []),
    ]);

    const totalPages = Math.ceil(totalCount / perPage);

    const getDeviceIcon = (type: string | null) => {
        switch (type) {
            case 'mobile': return <Smartphone className="w-4 h-4" />;
            case 'tablet': return <Tablet className="w-4 h-4" />;
            default: return <Monitor className="w-4 h-4" />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold text-foreground">Посетители</h1>
                <p className="text-foreground font-light mt-1">
                    Аналитика посещений и поведения пользователей
                </p>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="overview">Обзор</TabsTrigger>
                    <TabsTrigger value="all">Все посетители</TabsTrigger>
                </TabsList>

                {/* Tab: Overview */}
                <TabsContent value="overview" className="space-y-6">
                    {/* Stats Cards */}
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <Users className="w-6 h-6 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-foreground/60 font-light">Всего</p>
                                        <p className="text-2xl font-semibold mt-1">{totalCount}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Countries */}
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <Globe className="w-5 h-5 text-primary" />
                                    <CardTitle className="text-base">Страны</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {topCountries.slice(0, 3).map((item, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm">
                                        <span>{item.country || 'Неизвестно'}</span>
                                        <span className="font-medium">{item._count.id}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Cities */}
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-5 h-5 text-[#f59e0b]" />
                                    <CardTitle className="text-base">Города</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {topCities.slice(0, 3).map((item, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm">
                                        <span>{item.city || 'Неизвестно'}</span>
                                        <span className="font-medium">{item._count.id}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Devices */}
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <Smartphone className="w-5 h-5 text-blue-600" />
                                    <CardTitle className="text-base">Устройства</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {deviceStats.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            {getDeviceIcon(item.deviceType)}
                                            <span className="capitalize">{item.deviceType || 'Unknown'}</span>
                                        </div>
                                        <span className="font-medium">{item._count.id}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>

                    {/* UTM Sources */}
                    {utmStats.length > 0 && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Link2 className="w-5 h-5 text-primary" />
                                    <CardTitle className="text-base">Источники трафика</CardTitle>
                                </div>
                                <CardDescription>UTM метки и реферальные источники</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                                    {utmStats.map((item, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border">
                                            <span className="text-sm font-medium">{item.utmSource}</span>
                                            <span className="text-sm text-foreground/60">{item._count.id}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Tab: All Visitors */}
                <TabsContent value="all">
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Дата</TableHead>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Страна</TableHead>
                                    <TableHead>Город</TableHead>
                                    <TableHead>Устройство</TableHead>
                                    <TableHead>Язык</TableHead>
                                    <TableHead>Источник</TableHead>
                                    <TableHead className="text-right">Визиты</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visitors.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center">
                                            <div className="flex flex-col items-center gap-3 text-foreground/50">
                                                <Eye className="w-10 h-10" />
                                                <p>Нет данных о посетителях</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    visitors.map((v) => (
                                        <TableRow key={v.id}>
                                            <TableCell className="text-foreground/70">
                                                {v.createdAt.toLocaleDateString('ru-RU')}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-foreground/60">
                                                {v.visitorId.slice(0, 8)}...
                                            </TableCell>
                                            <TableCell>{v.country || '—'}</TableCell>
                                            <TableCell>{v.city || '—'}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {getDeviceIcon(v.deviceType)}
                                                    <span className="capitalize">{v.deviceType || '—'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-foreground/70">{v.language || '—'}</TableCell>
                                            <TableCell className="text-foreground/70">
                                                {v.utmSource || (v.referrer ? v.referrer.slice(0, 20) + '...' : 'Direct')}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">{v.visits}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Card>

                    {totalPages > 1 && (
                        <div className="flex justify-center mt-4">
                            <p className="text-sm text-foreground/60">
                                Страница {page} из {totalPages}
                            </p>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
