import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, Shield, UserCheck, ShieldAlert } from 'lucide-react';
import { UserActions } from './user-actions';

export default async function UsersPage() {
    const users = await db.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isBlocked: true,
            emailVerified: true,
            createdAt: true,
            psychologistSettings: { select: { id: true } }
        },
    }).catch(() => []);

    const roleVariants: Record<string, 'default' | 'secondary' | 'new'> = {
        USER: 'secondary',
        ADMIN: 'default',
        SUPERADMIN: 'new',
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-foreground">Пользователи</h1>
                <p className="text-foreground font-light mt-1">
                    Управление пользователями, ролями и доступами
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Users className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm text-foreground/60 font-light">Всего</p>
                                <p className="text-2xl font-semibold mt-1">{users.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-[#f59e0b]/10 flex items-center justify-center">
                                <Shield className="w-6 h-6 text-[#f59e0b]" />
                            </div>
                            <div>
                                <p className="text-sm text-foreground/60 font-light">Админы</p>
                                <p className="text-2xl font-semibold mt-1">{users.filter(u => u.role === 'ADMIN' || u.role === 'SUPERADMIN').length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <UserCheck className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm text-foreground/60 font-light">Подтверждены</p>
                                <p className="text-2xl font-semibold mt-1">{users.filter(u => u.emailVerified).length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                                <ShieldAlert className="w-6 h-6 text-destructive" />
                            </div>
                            <div>
                                <p className="text-sm text-foreground/60 font-light">Заблокированы</p>
                                <p className="text-2xl font-semibold mt-1">{users.filter(u => u.isBlocked).length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Список пользователей</CardTitle>
                </CardHeader>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Имя</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Роль</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Онбординг</TableHead>
                            <TableHead className="text-right">Регистрация</TableHead>
                            <TableHead className="text-right">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    <div className="flex flex-col items-center gap-2 text-foreground/50">
                                        <Users className="w-8 h-8" />
                                        <p>Нет пользователей</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => (
                                <TableRow key={user.id} className={user.isBlocked ? "opacity-60 bg-muted/30 hover:bg-muted/40" : ""}>
                                    <TableCell className="font-medium">{user.name || '—'}</TableCell>
                                    <TableCell className="text-foreground/70">{user.email}</TableCell>
                                    <TableCell>
                                        <Badge variant={roleVariants[user.role] || 'secondary'}>
                                            {user.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {user.isBlocked ? (
                                            <Badge variant="destructive">Заблокирован</Badge>
                                        ) : user.emailVerified ? (
                                            <Badge variant="paid">Активен</Badge>
                                        ) : (
                                            <Badge variant="secondary">Не подтверждён</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {user.psychologistSettings ? (
                                            <Badge variant="outline" className="border-emerald-500 text-emerald-600">Заполнен</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground">Не пройден</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right text-foreground/70">
                                        {user.createdAt.toLocaleDateString('ru-RU')}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <UserActions user={{ id: user.id, role: user.role, isBlocked: user.isBlocked }} />
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
