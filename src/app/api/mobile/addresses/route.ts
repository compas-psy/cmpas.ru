import { NextRequest, NextResponse } from 'next/server';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { createPracticeAddress, listPracticeAddresses } from '@/lib/practice/addresses';
import { OwnershipError } from '@/lib/practice/ownership';

/**
 * Кабинеты практики для приложения (Задача 21).
 *
 * Маршрут — тонкий переходник: он отвечает только на вопрос «кто спрашивает»,
 * а все правила (первый кабинет становится основным, чужого не видно, вывод
 * из работы вместо удаления) живут в общем ядре src/lib/practice/addresses.ts
 * вместе с веб-кабинетом. Вторая трактовка этих правил означала бы кабинет,
 * который из приложения выводится, а из веба — нет.
 */

export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        // Только действующие: выведенный из работы кабинет в приложении не
        // выбирают и не показывают.
        const addresses = await listPracticeAddresses(auth.userId);
        return NextResponse.json({ addresses });
    } catch (error) {
        console.error('[mobile/addresses GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const body = await req.json().catch(() => null) as { name?: unknown; address?: unknown } | null;
        const name = typeof body?.name === 'string' ? body.name : '';
        const address = typeof body?.address === 'string' ? body.address : '';
        if (!name.trim() || !address.trim()) {
            return NextResponse.json({ error: 'NAME_AND_ADDRESS_REQUIRED' }, { status: 400 });
        }

        const created = await createPracticeAddress(auth.userId, { name, address });
        return NextResponse.json(created, { status: 201 });
    } catch (error) {
        if (error instanceof OwnershipError) {
            return NextResponse.json({ error: 'NAME_AND_ADDRESS_REQUIRED' }, { status: 400 });
        }
        console.error('[mobile/addresses POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
