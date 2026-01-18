import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    ShoppingCart,
    Users,
    Eye,
    TrendingUp,
    Clock,
    Package,
    CheckCircle2,
    XCircle,
    Globe,
    Smartphone
} from 'lucide-react';

const statusConfig: Record<string, { label: string; variant: 'new' | 'processing' | 'completed' | 'cancelled'; icon: typeof Clock }> = {
    NEW: { label: 'Новый', variant: 'new', icon: Clock },
    CONTACTED: { label: 'В работе', variant: 'processing', icon: Package },
    PROCESSING: { label: 'В работе', variant: 'processing', icon: Package },
    COMPLETED: { label: 'Завершено', variant: 'completed', icon: CheckCircle2 },
    CANCELLED: { label: 'Отменено', variant: 'cancelled', icon: XCircle },
};

export default async function AdminDashboard() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
        totalOrders,
        todayOrders,
        newOrders,
        totalVisitors,
        todayVisitors,
        recentOrders,
        topCountries,
        deviceStats,
    ] = await Promise.all([
        db.order.count().catch(() => 0),
        db.order.count({ where: { createdAt: { gte: todayStart } } }).catch(() => 0),
        db.order.count({ where: { status: 'NEW' } }).catch(() => 0),
        db.visitorAnalytics.count().catch(() => 0),
        db.visitorAnalytics.count({ where: { createdAt: { gte: todayStart } } }).catch(() => 0),
        db.order.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { id: true, name: true, phone: true, status: true, createdAt: true, city: true, country: true },
        }).catch(() => []),
        db.visitorAnalytics.groupBy({
            by: ['country'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 5,
        }).catch(() => []),
        db.visitorAnalytics.groupBy({
            by: ['deviceType'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
        }).catch(() => []),
    ]);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold text-foreground">Главная</h1>
                <p className="text-foreground font-light mt-1">
                    Обзор активности и ключевые метрики
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-[#f59e0b]/10 flex items-center justify-center">
                                <ShoppingCart className="w-6 h-6 text-[#f59e0b]" />
                            </div>
                            <div>
                                <p className="text-sm text-foreground/60 font-light">Всего заказов</p>
                                <p className="text-2xl font-semibold mt-1">{totalOrders}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Clock className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm text-foreground/60 font-light">Новых заказов</p>
                                <p className="text-2xl font-semibold mt-1">{newOrders}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <Eye className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-foreground/60 font-light">Посетителей</p>
                                <p className="text-2xl font-semibold mt-1">{totalVisitors}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <TrendingUp className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm text-foreground/60 font-light">Сегодня</p>
                                <p className="text-2xl font-semibold mt-1">+{todayVisitors}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Orders */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Последние заказы</CardTitle>
                            <CardDescription>Последняя активность от клиентов</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Клиент</TableHead>
                                        <TableHead>Город</TableHead>
                                        <TableHead>Статус</TableHead>
                                        <TableHead className="text-right">Дата</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentOrders.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">
                                                <div className="flex flex-col items-center gap-2 text-foreground/50">
                                                    <ShoppingCart className="w-8 h-8" />
                                                    <p>Заказов пока нет</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        recentOrders.map((order) => {
                                            const config = statusConfig[order.status] || statusConfig.NEW;
                                            const StatusIcon = config.icon;
                                            return (
                                                <TableRow key={order.id}>
                                                    <TableCell>
                                                        <div>
                                                            <p className="font-medium">{order.name}</p>
                                                            <p className="text-xs text-foreground/60">{order.phone}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-foreground/70">
                                                        {order.city || '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={config.variant}>
                                                            <StatusIcon className="w-3 h-3 mr-1" />
                                                            {config.label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right text-foreground/70">
                                                        {order.createdAt.toLocaleDateString('ru-RU')}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>

                {/* Side Stats */}
                <div className="space-y-6">
                    {/* Geography */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Globe className="w-5 h-5 text-primary" />
                                <CardTitle className="text-base">География</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {topCountries.length === 0 ? (
                                <p className="text-sm text-foreground/50">Нет данных</p>
                            ) : (
                                topCountries.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <span className="text-sm">{item.country || 'Неизвестно'}</span>
                                        <span className="text-sm font-medium">{item._count.id}</span>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Devices */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Smartphone className="w-5 h-5 text-primary" />
                                <CardTitle className="text-base">Устройства</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {deviceStats.length === 0 ? (
                                <p className="text-sm text-foreground/50">Нет данных</p>
                            ) : (
                                deviceStats.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <span className="text-sm capitalize">{item.deviceType || 'Unknown'}</span>
                                        <span className="text-sm font-medium">{item._count.id}</span>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
