import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';

/**
 * Настройки автонапоминаний клиенту (Задача 20 §11).
 *
 * В приложении эти тумблеры жили в rememberSaveable: переключались, ничего
 * не меняли и забывались при переустановке. Настройка, которая никуда не
 * доходит, — не настройка, а обещание.
 *
 * Наружу отдаются ровно те два поля NotificationSettings, за которыми стоит
 * настоящая рассылка (src/lib/cron/reminders.ts): напоминание клиенту за
 * сутки и за час. Никакого «за 2 часа» на сервере нет и придумывать его
 * здесь нельзя.
 */
type RemindersPayload = {
    clientReminder25hEnabled: boolean;
    clientReminder1hEnabled: boolean;
};

async function readOrCreate(psychologistId: string): Promise<RemindersPayload> {
    const existing = await db.notificationSettings.findUnique({
        where: { psychologistId },
        select: { clientReminder25hEnabled: true, clientReminder1hEnabled: true },
    });
    if (existing) return existing;

    const created = await db.notificationSettings.create({
        data: { psychologistId },
        select: { clientReminder25hEnabled: true, clientReminder1hEnabled: true },
    });
    return created;
}

export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        return NextResponse.json(await readOrCreate(auth.userId));
    } catch (error) {
        console.error('[mobile/notification-settings GET]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    try {
        const body = await req.json().catch(() => null);
        // Принимается только то, чем действительно можно управлять: любое
        // другое поле настроек уведомлений через этот ресурс не проходит.
        const patch: Partial<RemindersPayload> = {};
        if (typeof (body as RemindersPayload | null)?.clientReminder25hEnabled === 'boolean') {
            patch.clientReminder25hEnabled = (body as RemindersPayload).clientReminder25hEnabled;
        }
        if (typeof (body as RemindersPayload | null)?.clientReminder1hEnabled === 'boolean') {
            patch.clientReminder1hEnabled = (body as RemindersPayload).clientReminder1hEnabled;
        }
        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ error: 'NOTHING_TO_UPDATE' }, { status: 400 });
        }

        const updated = await db.notificationSettings.upsert({
            where: { psychologistId: auth.userId },
            create: { psychologistId: auth.userId, ...patch },
            update: patch,
            select: { clientReminder25hEnabled: true, clientReminder1hEnabled: true },
        });
        return NextResponse.json(updated);
    } catch (error) {
        console.error('[mobile/notification-settings PATCH]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
