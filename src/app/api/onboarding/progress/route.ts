import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPracticeOnboarding } from '@/lib/practice/onboarding';

/**
 * Состояние онбординга для веб-кабинета (Задача 24).
 *
 * Считает не этот маршрут: и веб, и приложение берут состояние из общего ядра
 * src/lib/practice/onboarding.ts. Раньше шаги вычислялись прямо здесь, и
 * мобильный дашборд знал про онбординг совсем другое — один булев
 * needsOnboarding. Две трактовки одного и того же расходились неизбежно.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(await getPracticeOnboarding(session.user.id));
}
