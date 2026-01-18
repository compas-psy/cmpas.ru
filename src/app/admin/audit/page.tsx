import { db } from '@/lib/db';

const actionLabels: Record<string, { label: string; color: string }> = {
    LOGIN_SUCCESS: { label: 'Вход', color: 'bg-green-100 text-green-800' },
    LOGIN_FAILED: { label: 'Ошибка входа', color: 'bg-red-100 text-red-800' },
    LOGOUT: { label: 'Выход', color: 'bg-gray-100 text-gray-800' },
    OTP_SENT: { label: 'OTP отправлен', color: 'bg-blue-100 text-blue-800' },
    OTP_VERIFIED: { label: 'OTP проверен', color: 'bg-purple-100 text-purple-800' },
};

export default async function AuditPage({
    searchParams,
}: {
    searchParams: Promise<{ action?: string; page?: string }>;
}) {
    const params = await searchParams;
    const actionFilter = params.action;
    const page = parseInt(params.page || '1');
    const perPage = 50;

    const where = actionFilter ? { action: actionFilter } : {};

    const [logs, totalCount] = await Promise.all([
        db.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * perPage,
            take: perPage,
        }).catch(() => []),
        db.auditLog.count({ where }).catch(() => 0),
    ]);

    const totalPages = Math.ceil(totalCount / perPage);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">🔐 Аудит безопасности</h1>
                <p className="text-gray-500 mt-1">Всего событий: {totalCount}</p>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                <a
                    href="/admin/audit"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${!actionFilter ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                    Все
                </a>
                {Object.entries(actionLabels).map(([key, { label }]) => (
                    <a
                        key={key}
                        href={`/admin/audit?action=${key}`}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${actionFilter === key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                        {label}
                    </a>
                ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Время</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действие</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Провайдер</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        Нет данных
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => {
                                    const actionInfo = actionLabels[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-800' };
                                    return (
                                        <tr key={log.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {log.createdAt.toLocaleDateString('ru-RU')}{' '}
                                                {log.createdAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${actionInfo.color}`}>
                                                    {actionInfo.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900">{log.email || '—'}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{log.provider || '—'}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500 font-mono">{log.ipAddress || '—'}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                    {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
                        <a
                            key={p}
                            href={`/admin/audit?${actionFilter ? `action=${actionFilter}&` : ''}page=${p}`}
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
