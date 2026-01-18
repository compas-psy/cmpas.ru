import { db } from '@/lib/db';

// Stats Card Component
function StatCard({ title, value, icon, change }: { title: string; value: string | number; icon: string; change?: string }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
                    {change && (
                        <p className={`text-sm mt-2 ${change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                            {change}
                        </p>
                    )}
                </div>
                <div className="text-4xl">{icon}</div>
            </div>
        </div>
    );
}

// Recent Orders Table
function RecentOrders({ orders }: { orders: { id: string; name: string; phone: string; status: string; createdAt: Date; city: string | null }[] }) {
    const statusColors: Record<string, string> = {
        NEW: 'bg-blue-100 text-blue-800',
        CONTACTED: 'bg-yellow-100 text-yellow-800',
        PROCESSING: 'bg-purple-100 text-purple-800',
        COMPLETED: 'bg-green-100 text-green-800',
        CANCELLED: 'bg-red-100 text-red-800',
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Последние заказы</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Имя</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Телефон</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Город</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {orders.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                    Заказов пока нет
                                </td>
                            </tr>
                        ) : (
                            orders.map((order) => (
                                <tr key={order.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{order.phone}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{order.city || '—'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {order.createdAt.toLocaleDateString('ru-RU')}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// Top Locations
function TopLocations({ locations }: { locations: { country: string | null; _count: { id: number } }[] }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🌍 География посетителей</h3>
            <div className="space-y-3">
                {locations.length === 0 ? (
                    <p className="text-gray-500 text-sm">Нет данных</p>
                ) : (
                    locations.map((loc, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">{loc.country || 'Неизвестно'}</span>
                            <span className="text-sm font-medium text-gray-900">{loc._count.id}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// Device Stats
function DeviceStats({ devices }: { devices: { deviceType: string | null; _count: { id: number } }[] }) {
    const deviceIcons: Record<string, string> = {
        desktop: '🖥️',
        mobile: '📱',
        tablet: '📲',
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📱 Устройства</h3>
            <div className="space-y-3">
                {devices.length === 0 ? (
                    <p className="text-gray-500 text-sm">Нет данных</p>
                ) : (
                    devices.map((device, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">
                                {deviceIcons[device.deviceType || ''] || '❓'} {device.deviceType || 'Unknown'}
                            </span>
                            <span className="text-sm font-medium text-gray-900">{device._count.id}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default async function AdminDashboard() {
    // Fetch stats
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
        totalOrders,
        todayOrders,
        totalVisitors,
        todayVisitors,
        recentOrders,
        topCountries,
        deviceStats,
        totalUsers,
    ] = await Promise.all([
        db.order.count().catch(() => 0),
        db.order.count({ where: { createdAt: { gte: todayStart } } }).catch(() => 0),
        db.visitorAnalytics.count().catch(() => 0),
        db.visitorAnalytics.count({ where: { createdAt: { gte: todayStart } } }).catch(() => 0),
        db.order.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { id: true, name: true, phone: true, status: true, createdAt: true, city: true },
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
        db.user.count().catch(() => 0),
    ]);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-500 mt-1">Обзор активности сайта</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Всего заказов" value={totalOrders} icon="📦" />
                <StatCard title="Заказов сегодня" value={todayOrders} icon="🛒" />
                <StatCard title="Всего посетителей" value={totalVisitors} icon="👥" />
                <StatCard title="Посетителей сегодня" value={todayVisitors} icon="📈" />
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <RecentOrders orders={recentOrders} />
                </div>
                <div className="space-y-6">
                    <TopLocations locations={topCountries} />
                    <DeviceStats devices={deviceStats} />
                </div>
            </div>
        </div>
    );
}
