/**
 * Проверка доступа для API-маршрутов панели.
 *
 * Это НЕ второй механизм авторизации: та же сессия и та же роль, что и в
 * `src/app/admin/layout.tsx` (ТЗ §1). Layout закрывает страницы, но route
 * handler живёт вне дерева layout'ов — поэтому проверка повторяется на
 * каждом запросе, а не только при рендере (ТЗ §2).
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const ADMIN_ROLES = new Set(['ADMIN', 'SUPERADMIN']);

export type PanelAuthFailure = { response: NextResponse };

/**
 * Возвращает `null`, если доступ разрешён, иначе готовый 401/403.
 * 401 — сессии нет вовсе; 403 — сессия есть, но роль не админская.
 */
export async function requirePanelAdmin(): Promise<PanelAuthFailure | null> {
    const session = await auth();

    if (!session?.user?.email) {
        return { response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !ADMIN_ROLES.has(role)) {
        return { response: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
    }

    return null;
}
