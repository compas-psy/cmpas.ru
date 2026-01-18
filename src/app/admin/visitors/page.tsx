import { db } from '@/lib/db';

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

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">👥 Аналитика посетителей</h1>
                <p className="text-gray-500 mt-1">Всего уникальных посетителей: {totalCount}</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Top Countries */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">🌍 Страны</h3>
                    <div className="space-y-2">
                        {topCountries.length === 0 ? (
                            <p className="text-gray-500 text-sm">Нет данных</p>
                        ) : (
                            topCountries.slice(0, 5).map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700">{item.country || 'Неизвестно'}</span>
                                    <span className="font-medium text-gray-900">{item._count.id}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Top Cities */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">🏙️ Города</h3>
                    <div className="space-y-2">
                        {topCities.length === 0 ? (
                            <p className="text-gray-500 text-sm">Нет данных</p>
                        ) : (
                            topCities.slice(0, 5).map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700">{item.city || 'Неизвестно'}</span>
                                    <span className="font-medium text-gray-900">{item._count.id}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Devices */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">📱 Устройства</h3>
                    <div className="space-y-2">
                        {deviceStats.length === 0 ? (
                            <p className="text-gray-500 text-sm">Нет данных</p>
                        ) : (
                            deviceStats.map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700">
                                        {item.deviceType === 'desktop' ? '🖥️' : item.deviceType === 'mobile' ? '📱' : '📲'} {item.deviceType || 'Unknown'}
                                    </span>
                                    <span className="font-medium text-gray-900">{item._count.id}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* UTM Sources */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">🔗 Источники</h3>
                    <div className="space-y-2">
                        {utmStats.length === 0 ? (
                            <p className="text-gray-500 text-sm">Нет UTM данных</p>
                        ) : (
                            utmStats.slice(0, 5).map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700">{item.utmSource}</span>
                                    <span className="font-medium text-gray-900">{item._count.id}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Visitors Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Страна</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Город</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Устройство</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Язык</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Источник</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Визиты</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {visitors.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                        Нет данных о посетителях
                                    </td>
                                </tr>
                            ) : (
                                visitors.map((v) => (
                                    <tr key={v.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {v.createdAt.toLocaleDateString('ru-RU')}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                                            {v.visitorId.slice(0, 8)}...
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">{v.country || '—'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-900">{v.city || '—'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{v.deviceType || '—'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{v.language || '—'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{v.utmSource || v.referrer?.slice(0, 20) || 'Direct'}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{v.visits}</td>
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
                    {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
                        <a
                            key={p}
                            href={`/admin/visitors?page=${p}`}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${p === page ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                            {p}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}
