import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { suggestForUser } from '@/lib/dadata/reply';

/**
 * Прокси подсказок адресов DaData для веб-кабинета.
 *
 * Токен остаётся на сервере, но этого мало: подсказки платные и считаются по
 * запросам, поэтому маршрут закрыт авторизацией и ограничен по частоте —
 * иначе это открытый счёт, который может тратить кто угодно (Задача 19).
 *
 * Сам разбор — в `src/lib/dadata/reply.ts`: тот же, что у приложения.
 */
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Кривое тело — это тоже негодный запрос, а не 500 со стеком.
    const body = await req.json().catch(() => null);
    const reply = await suggestForUser(session.user.id, (body as { query?: unknown } | null)?.query);
    return NextResponse.json(reply.body, { status: reply.status });
}
