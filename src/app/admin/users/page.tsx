import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, Shield, UserCheck, ShieldAlert } from 'lucide-react';
import { UserActions } from './user-actions';

// Always fetch fresh — never use cached result
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
    // Use raw SQL to guarantee the query works regardless of Prisma schema sync
    let users: any[] = [];
    let queryError = '';

    try {
        const rows = await db.$queryRaw<any[]>`
            SELECT
                u.id,
                u.name,
                u.email,
                u.role,
                u."isBlocked",
                u."emailVerified",
                u."createdAt",
                (ps.id IS NOT NULL) AS "hasSettings"
            FROM "User" u
            LEFT JOIN "PsychologistSettings" ps ON ps."psychologistId" = u.id
            ORDER BY u."createdAt" DESC
        `;
        users = rows.map(u => ({ ...u, createdAt: new Date(u.createdAt) }));
    } catch (e: any) {
        queryError = e?.message || 'Unknown error';
        console.error('[admin/users] raw query failed:', queryError);
    }

    // trialEndsAt — column may not exist yet
    const trialMap: Record<string, Date | null> = {};
    try {
        const rows = await db.$queryRaw<{ id: string; trialEndsAt: Date | null }[]>`
            SELECT id, "trialEndsAt" FROM "User"
        `;
        rows.forEach(r => { trialMap[r.id] = r.trialEndsAt ? new Date(r.trialEndsAt) : null; });
    } catch { /* column not yet in DB */ }

    // legalAcceptances — separate query
    const acceptMap: Record<string, { acceptedAt: Date; document: { type: string; version: string } }[]> = {};
    try {
        const rows = await db.$queryRaw<any[]>`
            SELECT la."userId", la."acceptedAt", ld."type", ld."version"
            FROM "LegalDocumentAcceptance" la
            JOIN "LegalDocument" ld ON la."documentId" = ld.id
        `;
        rows.forEach(r => {
            if (!acceptMap[r.userId]) acceptMap[r.userId] = [];
            acceptMap[r.userId].push({ acceptedAt: new Date(r.acceptedAt), document: { type: r.type, version: r.version } });
        });
    } catch { /* table may not exist */ }

    const enrichedUsers = users.map(u => ({
        ...u,
        psychologistSettings: u.hasSettings ? { id: 'exists' } : null,
        legalAcceptances: acceptMap[u.id] || [],
        trialEndsAt: trialMap[u.id] ?? null,
    }));

    const roleVariants: Record<string, 'default' | 'secondary' | 'new'> = {
        USER: 'secondary',
        ADMIN: 'default',
        SUPERADMIN: 'new',
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-foreground">Пользователи</h1>
                <p className="text-foreground font-light mt-1">Управление пользователями, ролями и доступами</p>
            </div>

            {queryError && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm text-destructive font-mono">
                    DB error: {queryError}
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-4">
                <Card><CardContent className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="w-6 h-6 text-primary" /></div>
                        <div><p className="text-sm text-foreground/60 font-light">Всего</p><p className="text-2xl font-semibold mt-1">{enrichedUsers.length}</p></div>
                    </div>
                </CardContent></Card>
                <Card><CardContent className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-[#f59e0b]/10 flex items-center justify-center"><Shield className="w-6 h-6 text-[#f59e0b]" /></div>
                        <div><p className="text-sm text-foreground/60 font-light">Админы</p><p className="text-2xl font-semibold mt-1">{enrichedUsers.filter(u => u.role === 'ADMIN' || u.role === 'SUPERADMIN').length}</p></div>
                    </div>
                </CardContent></Card>
                <Card><CardContent className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center"><UserCheck className="w-6 h-6 text-emerald-600" /></div>
                        <div><p className="text-sm text-foreground/60 font-light">Подтверждены</p><p className="text-2xl font-semibold mt-1">{enrichedUsers.filter(u => u.emailVerified).length}</p></div>
                    </div>
                </CardContent></Card>
                <Card><CardContent className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center"><ShieldAlert className="w-6 h-6 text-destructive" /></div>
                        <div><p className="text-sm text-foreground/60 font-light">Заблокированы</p><p className="text-2xl font-semibold mt-1">{enrichedUsers.filter(u => u.isBlocked).length}</p></div>
                    </div>
                </CardContent></Card>
            </div>

            <Card>
                <CardHeader><CardTitle className="text-lg">Список пользователей</CardTitle></CardHeader>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Имя</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Роль</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Онбординг</TableHead>
                            <TableHead>Триал</TableHead>
                            <TableHead>Согласия (ПДн / Реклама)</TableHead>
                            <TableHead className="text-right">Регистрация</TableHead>
                            <TableHead className="text-right">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {enrichedUsers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center">
                                    <div className="flex flex-col items-center gap-2 text-foreground/50">
                                        <Users className="w-8 h-8" />
                                        <p>{queryError ? `Ошибка: ${queryError}` : 'Нет пользователей'}</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            enrichedUsers.map((user) => (
                                <TableRow key={user.id} className={user.isBlocked ? 'opacity-60 bg-muted/30 hover:bg-muted/40' : ''}>
                                    <TableCell className="font-medium">{user.name || '—'}</TableCell>
                                    <TableCell className="text-foreground/70">{user.email}</TableCell>
                                    <TableCell>
                                        <Badge variant={roleVariants[user.role] || 'secondary'}>{user.role}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        {user.isBlocked ? <Badge variant="destructive">Заблокирован</Badge>
                                            : user.emailVerified ? <Badge variant="paid">Активен</Badge>
                                            : <Badge variant="secondary">Не подтверждён</Badge>}
                                    </TableCell>
                                    <TableCell>
                                        {user.psychologistSettings
                                            ? <Badge variant="outline" className="border-emerald-500 text-emerald-600">Заполнен</Badge>
                                            : <Badge variant="outline" className="text-muted-foreground">Не пройден</Badge>}
                                    </TableCell>
                                    <TableCell>
                                        {user.trialEndsAt ? (() => {
                                            const daysLeft = Math.ceil((user.trialEndsAt.getTime() - Date.now()) / 86400000);
                                            if (daysLeft <= 0) return <Badge variant="destructive" className="text-xs">Истёк</Badge>;
                                            if (daysLeft <= 7) return <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">{daysLeft} дн.</Badge>;
                                            return <Badge variant="outline" className="text-xs border-emerald-500 text-emerald-600">{daysLeft} дн.</Badge>;
                                        })() : <span className="text-muted-foreground text-xs">—</span>}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1.5">
                                            {(() => {
                                                const pdn = user.legalAcceptances.find((a: any) => a.document.type === 'PRIVACY' || a.document.type === 'TERMS');
                                                const ads = user.legalAcceptances.find((a: any) => a.document.type === 'ADS');
                                                return (<>
                                                    {pdn ? <Badge variant="outline" className="w-fit text-xs border-green-500/30 text-green-600 bg-green-500/5">ПДн: {pdn.document.version} ({pdn.acceptedAt.toLocaleDateString('ru-RU')})</Badge>
                                                        : <Badge variant="outline" className="w-fit text-xs text-muted-foreground bg-muted/30">ПДн: Нет</Badge>}
                                                    {ads ? <Badge variant="outline" className="w-fit text-xs border-green-500/30 text-green-600 bg-green-500/5">Реклама: {ads.document.version} ({ads.acceptedAt.toLocaleDateString('ru-RU')})</Badge>
                                                        : <Badge variant="outline" className="w-fit text-xs text-muted-foreground bg-muted/30">Реклама: Нет</Badge>}
                                                </>);
                                            })()}
                                        </div>
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
