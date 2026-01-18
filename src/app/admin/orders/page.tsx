import { db } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShoppingCart, Clock, CheckCircle2, Package, XCircle, Filter, Download, Eye, Search } from 'lucide-react';
import Link from 'next/link';
import { detectGenderFromName, getGenderEmoji } from '@/lib/gender';

const statusConfig: Record<string, { label: string; variant: 'new' | 'processing' | 'paid' | 'completed' | 'cancelled'; icon: typeof Clock }> = {
    NEW: { label: 'Новый', variant: 'new', icon: Clock },
    CONTACTED: { label: 'В работе', variant: 'processing', icon: Package },
    PROCESSING: { label: 'В работе', variant: 'processing', icon: Package },
    COMPLETED: { label: 'Завершено', variant: 'completed', icon: CheckCircle2 },
    CANCELLED: { label: 'Отменено', variant: 'cancelled', icon: XCircle },
};

export default async function OrdersPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; page?: string }>;
}) {
    const params = await searchParams;
    const statusFilter = params.status;
    const page = parseInt(params.page || '1');
    const perPage = 20;

    const where = statusFilter ? { status: statusFilter } : {};

    const [orders, totalCount, stats] = await Promise.all([
        db.order.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * perPage,
            take: perPage,
        }).catch(() => []),
        db.order.count({ where }).catch(() => 0),
        Promise.all([
            db.order.count().catch(() => 0),
            db.order.count({ where: { status: 'NEW' } }).catch(() => 0),
            db.order.count({ where: { status: 'PROCESSING' } }).catch(() => 0),
            db.order.count({ where: { status: 'COMPLETED' } }).catch(() => 0),
        ]).then(([total, newOrders, processing, completed]) => ({
            total, newOrders, processing, completed
        })),
    ]);

    const totalPages = Math.ceil(totalCount / perPage);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-semibold text-foreground">Заказы</h1>
                <p className="text-foreground font-light mt-1">
                    Управление заказами и платежами от клиентов
                </p>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-md">
                    <TabsTrigger value="all">Все заказы</TabsTrigger>
                    <TabsTrigger value="stats">Статистика</TabsTrigger>
                    <TabsTrigger value="settings">Настройки</TabsTrigger>
                </TabsList>

                {/* Tab: All Orders */}
                <TabsContent value="all" className="space-y-4">
                    {/* Filters */}
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Поиск по имени, email или номеру заказа..."
                                            className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Link
                                        href="/admin/orders"
                                        className="flex items-center gap-2 px-4 h-10 rounded-lg border border-border bg-white text-sm hover:bg-accent/50 transition"
                                    >
                                        <Filter className="w-4 h-4" />
                                        <span>Все статусы</span>
                                    </Link>
                                    <button className="flex items-center gap-2 px-4 h-10 rounded-lg border border-border bg-white text-sm hover:bg-accent/50 transition">
                                        <Download className="w-4 h-4" />
                                        <span>Экспорт</span>
                                    </button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Orders Table */}
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Заказ</TableHead>
                                    <TableHead>Дата</TableHead>
                                    <TableHead>Клиент</TableHead>
                                    <TableHead>Способ связи</TableHead>
                                    <TableHead>Город</TableHead>
                                    <TableHead>Статус</TableHead>
                                    <TableHead className="text-right">Действия</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center">
                                            <div className="flex flex-col items-center gap-3 text-foreground/50">
                                                <ShoppingCart className="w-10 h-10" />
                                                <p>Заказов пока нет</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    orders.map((order) => {
                                        const config = statusConfig[order.status] || statusConfig.NEW;
                                        const StatusIcon = config.icon;
                                        return (
                                            <TableRow key={order.id}>
                                                <TableCell className="font-mono text-sm">
                                                    #{order.id.slice(0, 8)}
                                                </TableCell>
                                                <TableCell className="text-foreground/70">
                                                    {order.createdAt.toLocaleDateString('ru-RU')}
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium">
                                                            {getGenderEmoji(detectGenderFromName(order.name).gender)}{' '}
                                                            {order.name}
                                                        </p>
                                                        <p className="text-sm text-foreground/60">{order.phone}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-foreground/70">
                                                    {order.contactMethod === 'telegram' ? 'Telegram' :
                                                        order.contactMethod === 'whatsapp' ? 'WhatsApp' :
                                                            order.contactMethod === 'max' ? 'MAX' : order.contactMethod}
                                                </TableCell>
                                                <TableCell className="text-foreground/70">
                                                    {order.city && order.country
                                                        ? `${order.city}, ${order.country}`
                                                        : order.city || order.country || '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={config.variant}>
                                                        <StatusIcon className="w-3 h-3 mr-1" />
                                                        {config.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <button className="p-2 rounded-lg hover:bg-accent/50 transition">
                                                        <Eye className="w-4 h-4 text-foreground/60" />
                                                    </button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </Card>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center gap-2">
                            <p className="text-sm text-foreground/60">
                                Показано {((page - 1) * perPage) + 1}—{Math.min(page * perPage, totalCount)} из {totalCount} заказов
                            </p>
                        </div>
                    )}
                </TabsContent>

                {/* Tab: Stats */}
                <TabsContent value="stats" className="space-y-6">
                    {/* Metric Cards */}
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-[#f59e0b]/10 flex items-center justify-center">
                                        <ShoppingCart className="w-6 h-6 text-[#f59e0b]" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-foreground/60 font-light">Всего заказов</p>
                                        <p className="text-2xl font-semibold mt-1">{stats.total}</p>
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
                                        <p className="text-sm text-foreground/60 font-light">Новых</p>
                                        <p className="text-2xl font-semibold mt-1">{stats.newOrders}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                        <Package className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-foreground/60 font-light">В работе</p>
                                        <p className="text-2xl font-semibold mt-1">{stats.processing}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-foreground/60 font-light">Завершено</p>
                                        <p className="text-2xl font-semibold mt-1">{stats.completed}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Tab: Settings */}
                <TabsContent value="settings">
                    <Card>
                        <CardContent className="p-6">
                            <p className="text-foreground/60">Настройки заказов будут доступны в следующем обновлении.</p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
