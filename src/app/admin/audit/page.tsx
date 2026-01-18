import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Shield, LogIn, LogOut, Mail, CheckCircle, XCircle } from 'lucide-react';

const actionConfig: Record<string, { label: string; variant: 'paid' | 'cancelled' | 'secondary' | 'new'; icon: typeof LogIn }> = {
    LOGIN_SUCCESS: { label: 'Вход', variant: 'paid', icon: LogIn },
    LOGIN_FAILED: { label: 'Ошибка', variant: 'cancelled', icon: XCircle },
    LOGOUT: { label: 'Выход', variant: 'secondary', icon: LogOut },
    OTP_SENT: { label: 'OTP отправлен', variant: 'new', icon: Mail },
    OTP_VERIFIED: { label: 'OTP подтверждён', variant: 'paid', icon: CheckCircle },
};

export default async function AuditPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const params = await searchParams;
    const page = parseInt(params.page || '1');
    const perPage = 50;

    const [logs, totalCount] = await Promise.all([
        db.auditLog.findMany({
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * perPage,
            take: perPage,
        }).catch(() => []),
        db.auditLog.count().catch(() => 0),
    ]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-foreground">Безопасность</h1>
                <p className="text-foreground font-light mt-1">
                    Журнал безопасности и аудит действий
                </p>
            </div>

            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Shield className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-foreground/60 font-light">Всего событий</p>
                            <p className="text-2xl font-semibold mt-1">{totalCount}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Журнал событий</CardTitle>
                </CardHeader>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Время</TableHead>
                            <TableHead>Действие</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Провайдер</TableHead>
                            <TableHead className="text-right">IP</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    <div className="flex flex-col items-center gap-2 text-foreground/50">
                                        <Shield className="w-8 h-8" />
                                        <p>Нет данных</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => {
                                const config = actionConfig[log.action] || { label: log.action, variant: 'secondary' as const, icon: Shield };
                                const Icon = config.icon;
                                return (
                                    <TableRow key={log.id}>
                                        <TableCell className="text-foreground/70">
                                            {log.createdAt.toLocaleDateString('ru-RU')}{' '}
                                            {log.createdAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={config.variant}>
                                                <Icon className="w-3 h-3 mr-1" />
                                                {config.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-medium">{log.email || '—'}</TableCell>
                                        <TableCell className="text-foreground/70">{log.provider || '—'}</TableCell>
                                        <TableCell className="text-right font-mono text-sm text-foreground/60">{log.ipAddress || '—'}</TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
