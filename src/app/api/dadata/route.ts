import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { suggestAddresses } from '@/lib/dadata/suggest';

/**
 * Прокси подсказок адресов DaData. Токен остаётся на сервере, но этого мало:
 * подсказки платные и считаются по запросам, поэтому эндпоинт закрыт
 * авторизацией и ограничен по частоте — иначе это открытый счёт, который
 * может тратить кто угодно (Задача 19).
 *
 * Маршрут отвечает только на вопрос «кто спрашивает»; всё остальное —
 * проверка запроса, лимит, кэш, таймаут и деградация — в
 * src/lib/dadata/suggest.ts, где это проверяется тестами без Next.
 */
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Кривое тело — не повод для 500: подсказки не обязательны, поле работает
    // и без них.
    const body = await req.json().catch(() => null);

    const { suggestions } = await suggestAddresses({
        userId: session.user.id,
        query: (body as { query?: unknown } | null)?.query,
        token: process.env.DADATA_API_KEY,
    });

    return NextResponse.json({ suggestions });
}
