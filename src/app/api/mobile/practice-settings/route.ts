import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';

/**
 * Настройки практики, которые правятся с телефона.
 *
 * Пока здесь одно поле — ссылка для онлайн-сессий. Её не было в приложении
 * вовсе: она уходит клиенту в подтверждении записи и в напоминаниях, но
 * поменять её можно было только в веб-кабинете. Специалист, у которого
 * сменился Телемост или Zoom, узнаёт об этом ровно тогда, когда клиент уже
 * ждёт по старому адресу, — и телефон в этот момент у него в руках, а
 * ноутбук нет.
 *
 * Пустая строка означает «ссылки нет» и записывается как null: пустая
 * строка в шаблоне сообщения выглядела бы как потерянная ссылка.
 */
type PracticeSettingsPayload = {
    onlineSessionLink: string | null;
    timezone: string;
};

const SELECT = { onlineSessionLink: true, timezone: true } as const;

async function readOrCreate(psychologistId: string): Promise<PracticeSettingsPayload> {
    const existing = await db.psychologistSettings.findUnique({
        where: { psychologistId },
        select: SELECT,
    });
    if (existing) return existing;
    return db.psychologistSettings.create({ data: { psychologistId }, select: SELECT });
}

export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();
    try {
        return NextResponse.json(await readOrCreate(auth.userId));
    } catch (error) {
        console.error('[mobile/practice-settings GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const body = await req.json().catch(() => null) as { onlineSessionLink?: unknown } | null;
        if (typeof body?.onlineSessionLink !== 'string') {
            return NextResponse.json({ error: 'NOTHING_TO_UPDATE' }, { status: 400 });
        }

        const raw = body.onlineSessionLink.trim();
        if (raw.length > 500) {
            return NextResponse.json({ error: 'LINK_TOO_LONG' }, { status: 400 });
        }
        // Адрес проверяется на разбираемость, а не на «правильность»: сервисов
        // видеосвязи много, и запрет всего, кроме знакомых, сделал бы поле
        // бесполезным ровно тому, у кого сервис свой.
        if (raw && !/^https?:\/\/\S+$/i.test(raw)) {
            return NextResponse.json({ error: 'LINK_INVALID' }, { status: 400 });
        }

        const onlineSessionLink = raw || null;
        const updated = await db.psychologistSettings.upsert({
            where: { psychologistId: auth.userId },
            create: { psychologistId: auth.userId, onlineSessionLink },
            update: { onlineSessionLink },
            select: SELECT,
        });
        return NextResponse.json(updated);
    } catch (error) {
        console.error('[mobile/practice-settings PATCH]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
