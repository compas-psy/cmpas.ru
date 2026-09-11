import { NextRequest, NextResponse } from 'next/server';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { suggestForUser } from '@/lib/dadata/reply';

/**
 * Подсказки адресов для приложения.
 *
 * Кабинеты заводятся и правятся с телефона (Задача 21), а подсказка адреса
 * при этом была только в вебе: маршрут `/api/dadata` закрыт веб-сессией,
 * которой у приложения нет. Человек на телефоне набирал адрес целиком и
 * руками — там, где ошибиться проще всего.
 *
 * Разбор и ограничение частоты общие с вебом (`src/lib/dadata/reply.ts`):
 * счёт у подсказок один, и считается он по человеку, а не по устройству.
 */
export async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    const body = await req.json().catch(() => null);
    const reply = await suggestForUser(auth.userId, (body as { query?: unknown } | null)?.query);
    return NextResponse.json(reply.body, { status: reply.status });
}
