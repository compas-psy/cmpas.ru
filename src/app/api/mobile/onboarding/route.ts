import { NextRequest, NextResponse } from 'next/server';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import {
    dismissPracticeOnboarding,
    getPracticeOnboarding,
    markBookingLinkShared,
} from '@/lib/practice/onboarding';

/**
 * Две записи состояния онбординга с телефона (Задача 24).
 *
 * Ресурс намеренно узкий: он принимает не «вот новое состояние», а имя
 * состоявшегося действия. Шаги «клиенты», «расписание» и «запись»
 * вычисляются из данных практики, и отметить их снаружи нельзя ни отсюда, ни
 * откуда бы то ни было ещё — их можно только сделать.
 *
 * Это НЕ аналитика: событий здесь не заводится, счётчиков не ведётся.
 * Хранятся ровно две отметки времени, каждая из которых меняет то, что
 * человек видит на экране.
 */

const ACTIONS = ['shared', 'dismiss'] as const;
type OnboardingAction = (typeof ACTIONS)[number];

function isAction(value: unknown): value is OnboardingAction {
    return typeof value === 'string' && (ACTIONS as readonly string[]).includes(value);
}

export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        return NextResponse.json(await getPracticeOnboarding(auth.userId));
    } catch (error) {
        console.error('[mobile/onboarding GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const body = await req.json().catch(() => null) as { action?: unknown } | null;
        if (!isAction(body?.action)) {
            return NextResponse.json({ error: 'UNKNOWN_ACTION' }, { status: 400 });
        }

        if (body.action === 'shared') {
            // Приходит только с состоявшегося действия в приложении:
            // скопировали, система приняла share, показали QR. Открытие
            // шторки сюда не доходит.
            await markBookingLinkShared(auth.userId);
        } else {
            await dismissPracticeOnboarding(auth.userId);
        }

        return NextResponse.json(await getPracticeOnboarding(auth.userId));
    } catch (error) {
        console.error('[mobile/onboarding POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
