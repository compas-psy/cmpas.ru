import { db } from '@/lib/db';

async function getSystemStats() {
    const startTime = Date.now();

    // Test DB connection
    let dbStatus = 'OK';
    let dbLatency = 0;
    try {
        const dbStart = Date.now();
        await db.$queryRaw`SELECT 1`;
        dbLatency = Date.now() - dbStart;
    } catch {
        dbStatus = 'ERROR';
    }

    // Get counts
    const [ordersCount, visitorsCount, usersCount, auditCount] = await Promise.all([
        db.order.count().catch(() => 0),
        db.visitorAnalytics.count().catch(() => 0),
        db.user.count().catch(() => 0),
        db.auditLog.count().catch(() => 0),
    ]);

    return {
        dbStatus,
        dbLatency,
        ordersCount,
        visitorsCount,
        usersCount,
        auditCount,
        serverTime: new Date().toISOString(),
        responseTime: Date.now() - startTime,
    };
}

export default async function SystemPage() {
    const stats = await getSystemStats();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">⚙️ Мониторинг системы</h1>
                <p className="text-gray-500 mt-1">Состояние и статистика</p>
            </div>

            {/* Health Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">База данных</h3>
                    <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full ${stats.dbStatus === 'OK' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span className="text-2xl font-bold text-gray-900">{stats.dbStatus}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Latency: {stats.dbLatency}ms</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Время сервера</h3>
                    <span className="text-lg font-mono text-gray-900">{stats.serverTime}</span>
                    <p className="text-sm text-gray-500 mt-2">Response: {stats.responseTime}ms</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Версия</h3>
                    <span className="text-lg font-mono text-gray-900">1.0.0</span>
                    <p className="text-sm text-gray-500 mt-2">Next.js 16.1.1</p>
                </div>
            </div>

            {/* Database Stats */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Статистика базы данных</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                        <p className="text-sm text-gray-500">Заказы</p>
                        <p className="text-3xl font-bold text-gray-900">{stats.ordersCount}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Посетители</p>
                        <p className="text-3xl font-bold text-gray-900">{stats.visitorsCount}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Пользователи</p>
                        <p className="text-3xl font-bold text-gray-900">{stats.usersCount}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Audit логи</p>
                        <p className="text-3xl font-bold text-gray-900">{stats.auditCount}</p>
                    </div>
                </div>
            </div>

            {/* Environment Info */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🔧 Окружение</h3>
                <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-500">NODE_ENV</span>
                        <span className="font-mono text-gray-900">{process.env.NODE_ENV}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-500">AUTH_URL</span>
                        <span className="font-mono text-gray-900">{process.env.AUTH_URL || '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-500">DATABASE_URL</span>
                        <span className="font-mono text-gray-900">***configured***</span>
                    </div>
                    <div className="flex justify-between py-2">
                        <span className="text-gray-500">TELEGRAM_BOT</span>
                        <span className="font-mono text-gray-900">{process.env.TELEGRAM_BOT_TOKEN ? '✓ Configured' : '✗ Not set'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
