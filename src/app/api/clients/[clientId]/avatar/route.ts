/**
 * Аватарка клиента для веб-кабинета: GET /api/clients/<id>/avatar
 *
 * Тонкая обёртка: вся работа — в src/lib/clients/avatar-service.ts, потому
 * что тот же ответ отдаётся приложению по адресу
 * /api/mobile/clients/<id>/avatar.
 */

import { NextRequest } from 'next/server';
import { serveClientAvatar } from '@/lib/clients/avatar-service';

export const dynamic = 'force-dynamic';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ clientId: string }> },
) {
    const { clientId } = await params;
    return serveClientAvatar(req, clientId);
}
