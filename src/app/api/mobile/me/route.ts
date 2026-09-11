import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';

/**
 * GET /api/mobile/me
 * Returns current user profile.
 */
export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const user = await db.user.findUnique({
            where: { id: auth.userId },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true,
                analyticsConsentAt: true,
                // Задача 20 §8: экран профиля показывал «Telegram · Подключён»
                // жёстко, независимо от реальности. Состояние подключения —
                // факт из БД, а не украшение.
                telegramChatId: true,
                maxChatId: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: (user.role || 'PSYCHOLOGIST').toUpperCase(),
            avatarUrl: user.image,
            analyticsConsentAt: user.analyticsConsentAt ? user.analyticsConsentAt.toISOString() : null,
            telegramConnected: Boolean(user.telegramChatId),
            maxConnected: Boolean(user.maxChatId),
        });
    } catch (error) {
        console.error('[mobile/me]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * PATCH /api/mobile/me — правка имени специалиста.
 *
 * Кнопка «Редактировать» в профиле приложения открывала справку и ничего не
 * меняла. Имя видно клиенту в каждом уведомлении («сессия с …»), и
 * опечатка в нём исправлялась только через веб-кабинет.
 *
 * ЧТО ПРАВИТСЯ ЗДЕСЬ, А ЧТО НЕТ. Здесь — имя в ПРАКТИКЕ. Почта, способ
 * входа и сама учётная запись живут в Экосистеме СИМПАС, и менять их отсюда
 * нельзя: продукт не хранит эти сведения, он их получает.
 */
export async function PATCH(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const body = await req.json().catch(() => null) as { name?: unknown } | null;
        if (typeof body?.name !== 'string') {
            return NextResponse.json({ error: 'NOTHING_TO_UPDATE' }, { status: 400 });
        }
        const name = body.name.trim();
        // Пустое имя не сохраняется: клиент получил бы уведомление «сессия
        // с » — с пустотой на месте человека.
        if (!name) return NextResponse.json({ error: 'NAME_REQUIRED' }, { status: 400 });
        if (name.length > 120) return NextResponse.json({ error: 'NAME_TOO_LONG' }, { status: 400 });

        const user = await db.user.update({
            where: { id: auth.userId },
            data: { name },
            select: { id: true, name: true, email: true, image: true, role: true },
        });
        return NextResponse.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: (user.role || 'PSYCHOLOGIST').toUpperCase(),
            avatarUrl: user.image,
        });
    } catch (error) {
        console.error('[mobile/me PATCH]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
