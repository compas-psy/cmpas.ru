import { NextRequest, NextResponse } from 'next/server';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import {
    dismissPracticeOnboarding,
    getPracticeOnboarding,
    recordBookingLinkShared,
} from '@/lib/practice/onboarding';

/**
 * Две записи состояния онбординга с телефона (Задача 24).
 *
 * Ресурс намеренно узкий: он принимает не «вот новое состояние», а имя
 * состоявшегося действия. Шаги «клиенты», «расписание» и «запись»
 * вычисляются из данных практики, и отметить их снаружи нельзя ни отсюда, ни
 * откуда бы то ни было ещё — их можно только сделать.
 *
 * Ресурс не хранит ничего, кроме двух отметок времени, каждая из которых
 * меняет то, что человек видит на экране. Аналитика состоявшегося
 * «поделиться» отправляется общим ядром (Задача 25 §7) — тем же самым, что и
 * в вебе, чтобы «поделился с телефона» и «поделился в браузере» не считались
 * по разным правилам.
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
            return NextResponse.json(await recordBookingLinkShared(auth.userId, 'android'));
        }

        await dismissPracticeOnboarding(auth.userId);
        return NextResponse.json(await getPracticeOnboarding(auth.userId));
    } catch (error) {
        console.error('[mobile/onboarding POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
