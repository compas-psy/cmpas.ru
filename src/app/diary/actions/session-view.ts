'use server';

import { auth } from '@/auth';
import { db } from '@/lib/db';

/**
 * Данные для страницы одной встречи в вебе (/diary/session/<id>).
 *
 * Страница по этому адресу СУЩЕСТВОВАЛА и до 10.09.2026 — но показывала
 * выдуманного «Алексея Смирнова», таймер 42:15 и анамнез «32 года, работает в
 * IT». Это была раскладка-заглушка, забытая под настоящим маршрутом. Попадал
 * туда живой специалист: пункт «оплата не отмечена» в «требует внимания» ведёт
 * ровно сюда (attentionHref, src/app/diary/page.tsx). То есть человек нажимал
 * на свою неоплаченную встречу и видел чужую придуманную жизнь.
 *
 * Отсюда этот загрузчик: страница читает настоящую встречу настоящего
 * специалиста или не показывает ничего.
 */
export async function getSessionCard(id: string) {
    const authSession = await auth();
    const psychologistId = authSession?.user?.id;
    if (!psychologistId) return null;

    const session = await db.diarySession.findFirst({
        where: { id, psychologistId },
        include: {
            client: { select: { id: true, name: true, telegramChatId: true } },
            psychologist: { include: { psychologistSettings: { select: { onlineSessionLink: true } } } },
        },
    });
    if (!session) return null;

    const anySession = session as unknown as Record<string, unknown>;
    const outcomeRecordedAt = anySession.outcomeRecordedAt as Date | null | undefined;

    return {
        id: session.id,
        clientId: session.clientId,
        clientName: session.client?.name ?? 'Клиент',
        date: session.date.toISOString(),
        time: session.time,
        endTime: session.endTime ?? null,
        status: session.status,
        format: session.format,
        paymentStatus: (anySession.paymentStatus as string | null) ?? 'not_required',
        outcomeRecordedAt: outcomeRecordedAt ? outcomeRecordedAt.toISOString() : null,
        onlineLink: session.format === 'online'
            ? session.psychologist?.psychologistSettings?.onlineSessionLink ?? null
            : null,
        hasMessenger: Boolean(session.client?.telegramChatId),
    };
}
