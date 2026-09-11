import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createTokenPair } from '@/lib/mobile-auth';
import { findUserByEmailInsensitive, normalizeEmail } from '@/lib/auth/email-identity';
import { fetchSimpasIdAccount, simpasIdIssuer } from '@/lib/auth/simpasid-account';

/**
 * POST /api/mobile/auth/simpasid — вход в ПРАКТИКУ по ключу доступа СИМПАС.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ МАРШРУТ. В вебе личность приходит обычным OIDC, и
 * next-auth разбирает её сам. На телефоне браузер запрещён
 * (docs/spec/12_NATIVE_AUTH.md у СИМПАС): нативный вход отдаёт приложению
 * ключ доступа СИМПАС — но нашему API нужен наш собственный токен, а
 * обменника между ними не существовало. Это и есть обменник.
 *
 * Вопрос к СИМПАС ровно один и ровно при входе. Дальше живёт своя сессия
 * ПРАКТИКИ, поэтому недоступность единого входа не выкидывает из
 * приложения никого (docs/integration/checklist.md).
 *
 * ПО ПОЧТЕ — ТОЛЬКО ПРИ ПЕРВОМ СВЯЗЫВАНИИ. Дальше человек ищется по `sub`,
 * постоянному идентификатору в СИМПАС. Причина не в красоте: смена почты в
 * аккаунте СИМПАС — штатное действие, и поиск по почте после неё завёл бы
 * человеку ВТОРУЮ пустую практику рядом с настоящей. `sub` не меняется
 * никогда (сообщено стороной СИМПАС 11.09.2026, issue #172).
 *
 * А ПЕРВЫЙ ПОИСК — БЕЗ УЧЁТА РЕГИСТРА. `Ivan@ya.ru` у нас и `ivan@ya.ru`
 * из СИМПАС — один человек. Точный поиск завёл бы ему ту же вторую пустую
 * практику; это уже случалось однажды (src/lib/auth/email-identity.ts).
 *
 * В журнал не уходит ни ключ, ни почта: первое равносильно паролю, второе
 * персональные данные.
 */
export async function POST(req: NextRequest) {
    if (!simpasIdIssuer()) {
        // Вход СИМПАС не настроен — это не ошибка человека, и маршрута для
        // него как бы нет.
        return NextResponse.json({ error: 'SimpasID is not configured' }, { status: 404 });
    }

    let accessToken = '';
    try {
        const body = await req.json();
        accessToken = typeof body?.accessToken === 'string' ? body.accessToken.trim() : '';
    } catch {
        accessToken = '';
    }
    if (!accessToken) {
        return NextResponse.json({ error: 'accessToken required' }, { status: 400 });
    }

    const lookup = await fetchSimpasIdAccount(accessToken);

    if (!lookup.ok) {
        if (lookup.reason === 'rejected') {
            return NextResponse.json({ error: 'SimpasID rejected the token' }, { status: 401 });
        }
        console.error('[mobile/auth/simpasid] единый вход недоступен или ответил непонятным');
        // 503, а не 500: поломка не у нас, и приложению нужно показать
        // «Вход временно недоступен», а не «что-то пошло не так».
        return NextResponse.json({ error: 'SimpasID unavailable' }, { status: 503 });
    }

    const { account } = lookup;

    // Единый вход неподтверждённую почту не выдаёт — но полагаться на чужую
    // дисциплину нельзя: почта это ключ, по которому находится ЧУЖАЯ
    // практика (docs/integration/checklist.md, пункт 4).
    if (!account.emailVerified) {
        console.warn('[mobile/auth/simpasid] вход отклонён — почта не подтверждена');
        return NextResponse.json({ error: 'Email is not verified' }, { status: 403 });
    }

    // 1. Связан ли уже? Тогда почта не спрашивается вовсе — она могла
    //    смениться, и это законно.
    const linked = await db.user.findUnique({
        where: { simpasIdSub: account.id },
        select: { id: true, role: true, isBlocked: true },
    });

    let user = linked;

    if (!user) {
        // 2. Первое связывание — ищем по почте, без учёта регистра.
        const byEmail = await findUserByEmailInsensitive(account.email);
        if (byEmail) {
            const bound = await db.user.update({
                where: { id: byEmail.id },
                data: { simpasIdSub: account.id },
                select: { id: true, role: true, isBlocked: true },
            });
            user = bound;
        }
    }

    if (!user) {
        // 3. Человека у нас нет — заводим, сразу со связкой.
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 30);
        user = await db.user.create({
            data: {
                email: normalizeEmail(account.email),
                emailVerified: new Date(),
                name: account.displayName,
                simpasIdSub: account.id,
                trialEndsAt: trialEnd,
            },
            select: { id: true, role: true, isBlocked: true },
        });
    }

    if (user.isBlocked) {
        return NextResponse.json({ error: 'Account is blocked' }, { status: 403 });
    }

    const tokens = createTokenPair(user.id, user.role || 'PSYCHOLOGIST');
    return NextResponse.json(tokens);
}
