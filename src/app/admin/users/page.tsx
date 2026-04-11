import { db } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, Shield, UserCheck, ShieldAlert, Search } from 'lucide-react';
import { UserActions } from './user-actions';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function UsersPage({
    searchParams,
}: {
    searchParams: Promise<{ search?: string; role?: string; status?: string }>;
}) {
    const params = await searchParams;
    const searchQuery = params.search || '';
    const roleFilter = params.role || '';
    const statusFilter = params.status || '';

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
                u."telegramChatId",
                u."telegramUsername",
                (ps.id IS NOT NULL) AS "hasSettings"
            FROM "User" u
            LEFT JOIN "PsychologistSettings" ps ON ps."psychologistId" = u.id
            ORDER BY u."createdAt" DESC
        `;
        users = rows.map(u => ({ ...u, createdAt: new Date(u.createdAt) }));
    } catch (e: any) {
        queryError = e?.message || 'Unknown error';
    }

    // Trial data
    const trialMap: Record<string, Date | null> = {};
    try {
        const rows = await db.$queryRaw<{ id: string; trialEndsAt: Date | null }[]>`
            SELECT id, "trialEndsAt" FROM "User"
        `;
        rows.forEach(r => { trialMap[r.id] = r.trialEndsAt ? new Date(r.trialEndsAt) : null; });
    } catch { /* column not yet in DB */ }

    // Subscription data
    const subMap: Record<string, { subscriptionEndsAt: Date | null; subscriptionPlan: string | null }> = {};
    try {
        const rows = await db.$queryRaw<any[]>`
            SELECT id, "subscriptionEndsAt", "subscriptionPlan" FROM "User"
        `;
        rows.forEach(r => {
            subMap[r.id] = {
                subscriptionEndsAt: r.subscriptionEndsAt ? new Date(r.subscriptionEndsAt) : null,
                subscriptionPlan: r.subscriptionPlan,
            };
        });
    } catch { /* columns may not exist */ }

    // Legal acceptances
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

    // Client/session counts per user
    const clientCounts: Record<string, number> = {};
    const sessionCounts: Record<string, number> = {};
    try {
        const clientRows = await db.$queryRaw<{ psychologistId: string; count: bigint }[]>`
            SELECT "psychologistId", COUNT(*)::bigint as count FROM "DiaryClient" GROUP BY "psychologistId"
        `;
        clientRows.forEach(r => { clientCounts[r.psychologistId] = Number(r.count); });

        const sessionRows = await db.$queryRaw<{ psychologistId: string; count: bigint }[]>`
            SELECT "psychologistId", COUNT(*)::bigint as count FROM "DiarySession" GROUP BY "psychologistId"
        `;
        sessionRows.forEach(r => { sessionCounts[r.psychologistId] = Number(r.count); });
    } catch { /* tables may not exist */ }

    let enrichedUsers = users.map(u => ({
        ...u,
        psychologistSettings: u.hasSettings ? { id: 'exists' } : null,
        legalAcceptances: acceptMap[u.id] || [],
        trialEndsAt: trialMap[u.id] ?? null,
        subscriptionEndsAt: subMap[u.id]?.subscriptionEndsAt ?? null,
        subscriptionPlan: subMap[u.id]?.subscriptionPlan ?? null,
        clientsCount: clientCounts[u.id] || 0,
        sessionsCount: sessionCounts[u.id] || 0,
    }));

    // Apply filters
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        enrichedUsers = enrichedUsers.filter(u =>
            (u.name || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q)
        );
    }
    if (roleFilter) {
        enrichedUsers = enrichedUsers.filter(u => u.role === roleFilter);
    }
    if (statusFilter === 'blocked') {
        enrichedUsers = enrichedUsers.filter(u => u.isBlocked);
    } else if (statusFilter === 'trial') {
        enrichedUsers = enrichedUsers.filter(u => {
            const te = u.trialEndsAt;
            return te && te > new Date() && (!u.subscriptionEndsAt || u.subscriptionEndsAt < new Date());
        });
    } else if (statusFilter === 'subscribed') {
        enrichedUsers = enrichedUsers.filter(u => u.subscriptionEndsAt && u.subscriptionEndsAt > new Date());
    } else if (statusFilter === 'expired') {
        const now = new Date();
        enrichedUsers = enrichedUsers.filter(u => {
            const isForever = u.trialEndsAt && u.trialEndsAt.getFullYear() >= 2099;
            if (isForever) return false;
            const hasSub = u.subscriptionEndsAt && u.subscriptionEndsAt > now;
            const hasTrial = u.trialEndsAt && u.trialEndsAt > now;
            return !hasSub && !hasTrial;
        });
    }

    const stats = {
        total: users.length,
        admins: users.filter(u => u.role === 'ADMIN' || u.role === 'SUPERADMIN').length,
        verified: users.filter(u => u.emailVerified).length,
        blocked: users.filter(u => u.isBlocked).length,
    };

    const roleColors: Record<string, string> = {
        USER: 'bg-[#f1f5f9] text-[#64748b]',
        ADMIN: 'bg-indigo-50 text-indigo-700',
        SUPERADMIN: 'bg-amber-50 text-amber-700',
    };

    function getSubscriptionBadge(user: any) {
        const now = new Date();
        const isForever = user.trialEndsAt && user.trialEndsAt.getFullYear() >= 2099;

        if (isForever) {
            return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">∞ Free</span>;
        }

        if (user.subscriptionEndsAt && user.subscriptionEndsAt > now) {
            const days = Math.ceil((user.subscriptionEndsAt.getTime() - now.getTime()) / 86400000);
            return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">Подписка ({days}д)</span>;
        }

        if (user.trialEndsAt) {
            const days = Math.ceil((user.trialEndsAt.getTime() - now.getTime()) / 86400000);
            if (days <= 0) {
                return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-red-50 text-red-700">Истёк</span>;
            }
            if (days <= 7) {
                return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700">Триал ({days}д)</span>;
            }
            return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700">Триал ({days}д)</span>;
        }

        return <span className="text-[10px] text-[#94a3b8]">—</span>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-[#0f1729]">Пользователи</h1>
                <p className="text-[#64748b] text-sm mt-0.5">Управление клиентами, подписками и ролями</p>
            </div>

            {queryError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 font-mono">
                    DB error: {queryError}
                </div>
            )}

            {/* Stats */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Card className="border-0 shadow-sm"><CardContent className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center"><Users className="w-5 h-5 text-indigo-500" /></div>
                        <div><p className="text-2xl font-bold text-[#0f1729]">{stats.total}</p><p className="text-xs text-[#94a3b8]">Всего</p></div>
                    </div>
                </CardContent></Card>
                <Card className="border-0 shadow-sm"><CardContent className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><Shield className="w-5 h-5 text-amber-500" /></div>
                        <div><p className="text-2xl font-bold text-[#0f1729]">{stats.admins}</p><p className="text-xs text-[#94a3b8]">Админы</p></div>
                    </div>
                </CardContent></Card>
                <Card className="border-0 shadow-sm"><CardContent className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><UserCheck className="w-5 h-5 text-emerald-500" /></div>
                        <div><p className="text-2xl font-bold text-[#0f1729]">{stats.verified}</p><p className="text-xs text-[#94a3b8]">Подтверждены</p></div>
                    </div>
                </CardContent></Card>
                <Card className="border-0 shadow-sm"><CardContent className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center"><ShieldAlert className="w-5 h-5 text-red-500" /></div>
                        <div><p className="text-2xl font-bold text-[#0f1729]">{stats.blocked}</p><p className="text-xs text-[#94a3b8]">Заблокированы</p></div>
                    </div>
                </CardContent></Card>
            </div>

            {/* Filters */}
            <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                    <form className="flex flex-col md:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                            <input
                                type="text"
                                name="search"
                                defaultValue={searchQuery}
                                placeholder="Поиск по имени или email..."
                                className="w-full h-9 pl-9 pr-4 rounded-lg border border-[#e2e8f0] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
                            />
                        </div>
                        <select
                            name="role"
                            defaultValue={roleFilter}
                            className="h-9 px-3 rounded-lg border border-[#e2e8f0] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                            <option value="">Все роли</option>
                            <option value="USER">USER</option>
                            <option value="ADMIN">ADMIN</option>
                            <option value="SUPERADMIN">SUPERADMIN</option>
                        </select>
                        <select
                            name="status"
                            defaultValue={statusFilter}
                            className="h-9 px-3 rounded-lg border border-[#e2e8f0] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                            <option value="">Все статусы</option>
                            <option value="trial">Триал</option>
                            <option value="subscribed">Подписка</option>
                            <option value="expired">Истёк</option>
                            <option value="blocked">Заблокированы</option>
                        </select>
                        <button
                            type="submit"
                            className="h-9 px-4 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 transition-colors"
                        >
                            Найти
                        </button>
                    </form>
                </CardContent>
            </Card>

            {/* Users Table */}
            <Card className="border-0 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-[#f8fafc]">
                            <TableHead className="text-xs font-semibold text-[#64748b]">Пользователь</TableHead>
                            <TableHead className="text-xs font-semibold text-[#64748b]">Роль</TableHead>
                            <TableHead className="text-xs font-semibold text-[#64748b]">Статус</TableHead>
                            <TableHead className="text-xs font-semibold text-[#64748b]">Подписка</TableHead>
                            <TableHead className="text-xs font-semibold text-[#64748b]">Клиенты</TableHead>
                            <TableHead className="text-xs font-semibold text-[#64748b]">Сессии</TableHead>
                            <TableHead className="text-xs font-semibold text-[#64748b]">Telegram</TableHead>
                            <TableHead className="text-xs font-semibold text-[#64748b]">Регистрация</TableHead>
                            <TableHead className="text-right text-xs font-semibold text-[#64748b]">Действия</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {enrichedUsers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center">
                                    <div className="flex flex-col items-center gap-2 text-[#94a3b8]">
                                        <Users className="w-8 h-8" />
                                        <p className="text-sm">Нет пользователей</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : enrichedUsers.map((user) => (
                            <TableRow key={user.id} className={user.isBlocked ? 'opacity-60 bg-red-50/30' : 'hover:bg-[#f8fafc]'}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 font-semibold text-xs flex-shrink-0">
                                            {(user.name || user.email)?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-[#0f1729] truncate">{user.name || '—'}</p>
                                            <p className="text-[11px] text-[#94a3b8] truncate">{user.email}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${roleColors[user.role] || roleColors.USER}`}>
                                        {user.role}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    {user.isBlocked
                                        ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-red-50 text-red-700">Заблокирован</span>
                                        : user.psychologistSettings
                                            ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">Активен</span>
                                            : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#f1f5f9] text-[#64748b]">Новый</span>
                                    }
                                </TableCell>
                                <TableCell>{getSubscriptionBadge(user)}</TableCell>
                                <TableCell className="text-sm text-[#334155] font-medium">{user.clientsCount || '—'}</TableCell>
                                <TableCell className="text-sm text-[#334155] font-medium">{user.sessionsCount || '—'}</TableCell>
                                <TableCell>
                                    {user.telegramChatId
                                        ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700">✓ {user.telegramUsername || 'Есть'}</span>
                                        : <span className="text-[10px] text-[#94a3b8]">—</span>
                                    }
                                </TableCell>
                                <TableCell className="text-xs text-[#94a3b8]">
                                    {user.createdAt.toLocaleDateString('ru-RU')}
                                </TableCell>
                                <TableCell className="text-right">
                                    <UserActions user={{
                                        id: user.id,
                                        role: user.role,
                                        isBlocked: user.isBlocked,
                                        telegramChatId: user.telegramChatId,
                                        email: user.email,
                                    }} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
