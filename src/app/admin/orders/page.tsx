import { db } from '@/lib/db';
import Link from 'next/link';

const statusColors: Record<string, string> = {
    NEW: 'bg-blue-100 text-blue-800',
    CONTACTED: 'bg-yellow-100 text-yellow-800',
    PROCESSING: 'bg-purple-100 text-purple-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
    NEW: 'Новый',
    CONTACTED: 'Связались',
    PROCESSING: 'В работе',
    COMPLETED: 'Завершён',
    CANCELLED: 'Отменён',
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

    const [orders, totalCount] = await Promise.all([
        db.order.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * perPage,
            take: perPage,
        }).catch(() => []),
        db.order.count({ where }).catch(() => 0),
    ]);

    const totalPages = Math.ceil(totalCount / perPage);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">📦 Заказы</h1>
                    <p className="text-gray-500 mt-1">Всего: {totalCount}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                <Link
                    href="/admin/orders"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${!statusFilter ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                    Все
                </Link>
                {Object.entries(statusLabels).map(([key, label]) => (
                    <Link
                        key={key}
                        href={`/admin/orders?status=${key}`}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${statusFilter === key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                        {label}
                    </Link>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Имя</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Телефон</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Способ связи</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Город</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Страна</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        Заказов нет
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order) => (
                                    <tr key={order.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {order.createdAt.toLocaleDateString('ru-RU')}
                                            <br />
                                            <span className="text-xs">{order.createdAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-900">{order.phone}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{order.contactMethod}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{order.city || '—'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{order.country || '—'}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                                                {statusLabels[order.status] || order.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <Link
                            key={p}
                            href={`/admin/orders?${statusFilter ? `status=${statusFilter}&` : ''}page=${p}`}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${p === page ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                            {p}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
