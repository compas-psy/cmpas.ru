import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Database, Server, Clock, CheckCircle, XCircle, Settings } from 'lucide-react';

async function getSystemStats() {
    const startTime = Date.now();

    let dbStatus = 'OK';
    let dbLatency = 0;
    try {
        const dbStart = Date.now();
        await db.$queryRaw`SELECT 1`;
        dbLatency = Date.now() - dbStart;
    } catch {
        dbStatus = 'ERROR';
    }

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
                <h1 className="text-2xl font-semibold text-foreground">Настройки</h1>
                <p className="text-foreground font-light mt-1">
                    Мониторинг системы и конфигурация
                </p>
            </div>

            {/* Health Status */}
            <div className="grid gap-6 md:grid-cols-3">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stats.dbStatus === 'OK' ? 'bg-emerald-500/10' : 'bg-destructive/10'}`}>
                                {stats.dbStatus === 'OK' ? (
                                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                                ) : (
                                    <XCircle className="w-6 h-6 text-destructive" />
                                )}
                            </div>
                            <div>
                                <p className="text-sm text-foreground/60 font-light">База данных</p>
                                <p className="text-xl font-semibold mt-1">{stats.dbStatus}</p>
                                <p className="text-xs text-foreground/50">{stats.dbLatency}ms latency</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Server className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm text-foreground/60 font-light">Ответ сервера</p>
                                <p className="text-xl font-semibold mt-1">{stats.responseTime}ms</p>
                                <p className="text-xs text-foreground/50">Next.js 16.1.1</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <Clock className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-foreground/60 font-light">Время сервера</p>
                                <p className="text-sm font-mono mt-1">
                                    {new Date(stats.serverTime).toLocaleString('ru-RU')}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Database Stats */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-primary" />
                        <CardTitle className="text-lg">Статистика базы данных</CardTitle>
                    </div>
                    <CardDescription>Количество записей в таблицах</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-4">
                        <div className="p-4 rounded-lg border border-border">
                            <p className="text-sm text-foreground/60 font-light">Заказы</p>
                            <p className="text-2xl font-semibold mt-1">{stats.ordersCount}</p>
                        </div>
                        <div className="p-4 rounded-lg border border-border">
                            <p className="text-sm text-foreground/60 font-light">Посетители</p>
                            <p className="text-2xl font-semibold mt-1">{stats.visitorsCount}</p>
                        </div>
                        <div className="p-4 rounded-lg border border-border">
                            <p className="text-sm text-foreground/60 font-light">Пользователи</p>
                            <p className="text-2xl font-semibold mt-1">{stats.usersCount}</p>
                        </div>
                        <div className="p-4 rounded-lg border border-border">
                            <p className="text-sm text-foreground/60 font-light">Audit логи</p>
                            <p className="text-2xl font-semibold mt-1">{stats.auditCount}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Environment */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-primary" />
                        <CardTitle className="text-lg">Окружение</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-0">
                    <div className="flex justify-between py-3">
                        <span className="text-foreground/60">NODE_ENV</span>
                        <span className="font-mono text-sm">{process.env.NODE_ENV}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between py-3">
                        <span className="text-foreground/60">AUTH_URL</span>
                        <span className="font-mono text-sm">{process.env.AUTH_URL || '—'}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between py-3">
                        <span className="text-foreground/60">DATABASE</span>
                        <span className="font-mono text-sm">✓ Configured</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between py-3">
                        <span className="text-foreground/60">TELEGRAM</span>
                        <span className="font-mono text-sm">{process.env.TELEGRAM_BOT_TOKEN ? '✓ Configured' : '✗ Not set'}</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
