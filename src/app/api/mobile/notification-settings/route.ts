import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';

/**
 * Настройки уведомлений (Задача 20 §11).
 *
 * В приложении эти тумблеры жили в rememberSaveable: переключались, ничего
 * не меняли и забывались при переустановке. Настройка, которая никуда не
 * доходит, — не настройка, а обещание.
 *
 * ПОЧЕМУ ЗДЕСЬ ПЯТЬ ПОЛЕЙ, А В ТАБЛИЦЕ ИХ БОЛЬШЕ. Наружу отдаётся ровно то,
 * за чем стоит настоящая рассылка — и это проверено по коду отправки, а не
 * по названиям полей:
 *
 *   clientReminder25hEnabled, clientReminder1hEnabled  → src/lib/cron/reminders.ts
 *   morningDigestEnabled, weeklyDigestEnabled          → src/lib/cron/digest.ts
 *   clientMoodCheckEnabled                             → src/lib/cron/post-session.ts
 *
 * Остальные поля таблицы (newBookingEnabled, reminderEnabled,
 * clientRescheduleEnabled, clientCancelEnabled, clientPsyCancelEnabled) не
 * читает НИКТО: отправка идёт независимо от них. Показать их в приложении
 * значило бы завести пять тумблеров, которые ничего не выключают.
 */
type RemindersPayload = {
    clientReminder25hEnabled: boolean;
    clientReminder1hEnabled: boolean;
    morningDigestEnabled: boolean;
    weeklyDigestEnabled: boolean;
    clientMoodCheckEnabled: boolean;
};

/** Один список полей на чтение, запись и выборку — расходиться им нечем. */
const FIELDS = {
    clientReminder25hEnabled: true,
    clientReminder1hEnabled: true,
    morningDigestEnabled: true,
    weeklyDigestEnabled: true,
    clientMoodCheckEnabled: true,
} as const;

async function readOrCreate(psychologistId: string): Promise<RemindersPayload> {
    const existing = await db.notificationSettings.findUnique({
        where: { psychologistId },
        select: FIELDS,
    });
    if (existing) return existing;

    const created = await db.notificationSettings.create({
        data: { psychologistId },
        select: FIELDS,
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
        for (const key of Object.keys(FIELDS) as (keyof RemindersPayload)[]) {
            const value = (body as Partial<RemindersPayload> | null)?.[key];
            if (typeof value === 'boolean') patch[key] = value;
        }
        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ error: 'NOTHING_TO_UPDATE' }, { status: 400 });
        }

        const updated = await db.notificationSettings.upsert({
            where: { psychologistId: auth.userId },
            create: { psychologistId: auth.userId, ...patch },
            update: patch,
            select: FIELDS,
        });
        return NextResponse.json(updated);
    } catch (error) {
        console.error('[mobile/notification-settings PATCH]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
