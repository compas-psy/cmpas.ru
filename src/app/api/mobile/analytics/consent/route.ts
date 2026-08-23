import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMobileRequest, unauthorizedResponse } from '@/lib/mobile-auth';
import { processIngestEvent } from '@/lib/analytics/ingest';

/**
 * Согласие как обычный аутентифицированный ресурс, не событие (решение
 * учредителя 2). GET отдаёт состояние, PUT меняет его и применяет
 * немедленно — никакого "кармана", никакого исключения в гейте согласия
 * приёмника (src/lib/analytics/ingest.ts не трогаем).
 *
 * PUT сам пишет событие consent_updated в журнал через существующий
 * processIngestEvent, ровно тем же кодовым путём, что и POST /ingest —
 * никакой отдельной логики записи согласия здесь не заводим.
 *
 * granted:false (решение учредителя 6, "отзыв согласия УДАЛЯЕТ события
 * этого человека") удаляет AnalyticsEvent этого accountId в ОДНОЙ
 * транзакции со снятием согласия. Порядок внутри транзакции важен: сперва
 * удаляем прежние поведенческие события, ПОТОМ пишем сам consent_updated —
 * иначе только что созданная журнальная запись об отзыве немедленно
 * стирала бы сама себя.
 */

const CONSENT_EVENT_SCHEMA_VERSION = 1;

export async function GET(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    const user = await db.user.findUnique({ where: { id: auth.userId }, select: { analyticsConsentAt: true } });
    const consentAt = user?.analyticsConsentAt ?? null;

    return NextResponse.json({
        granted: consentAt !== null,
        since: consentAt ? consentAt.toISOString() : null,
    });
}

export async function PUT(req: NextRequest) {
    const auth = await authenticateMobileRequest(req);
    if (!auth) return unauthorizedResponse();

    const body = await req.json().catch(() => null);
    if (!body || typeof body.granted !== 'boolean') {
        return NextResponse.json({ error: 'granted must be a boolean' }, { status: 400 });
    }
    const granted = body.granted as boolean;
    const now = new Date();

    // Согласие — РЕСУРС, и его запись обязана быть авторитетной, а не побочным
    // эффектом записи события.
    //
    // Раньше отметку analyticsConsentAt ставил сам processIngestEvent по пути.
    // Но он возвращает отказ ЗНАЧЕНИЕМ, а не исключением: при срабатывании
    // ограничения частоты (счётчик общий с обычной отправкой событий, 600 за
    // 60 секунд на аккаунт) транзакция не откатывалась — и получалось худшее
    // из возможного: события уже удалены, согласие НЕ снято, журнальной записи
    // нет, а клиенту отвечено «отозвано». Приложение кэшировало «согласия
    // нет» и чистило очередь, сервер продолжал принимать события, а текст
    // тумблера («сбор прекращается») становился ложью.
    //
    // Теперь отметка ставится здесь и явно, в той же транзакции, что и
    // удаление событий. Журнальная запись — вторична: её отказ логируется, но
    // не отменяет решения человека.
    const applied = await db.$transaction(async (tx) => {
        if (!granted) {
            await tx.analyticsEvent.deleteMany({ where: { accountId: auth.userId, product: 'practice' } });
        }
        const user = await tx.user.update({
            where: { id: auth.userId },
            data: { analyticsConsentAt: granted ? now : null },
            select: { analyticsConsentAt: true },
        });

        // Порядок внутри транзакции: удаление прежних событий → отметка →
        // журнальная запись. Запиши её раньше удаления, и она стёрла бы сама
        // себя; поставь отметку позже журнала, и журнал зависел бы от того,
        // что ещё не решено.
        const journal = await processIngestEvent(tx, {
            event: 'consent_updated',
            ts: now.toISOString(),
            product: 'practice',
            account_id: auth.userId,
            device_id: null,
            schema_version: CONSENT_EVENT_SCHEMA_VERSION,
            props: { granted },
        }, now);

        return { consentAt: user.analyticsConsentAt, journal };
    });

    if (!applied.journal.accepted) {
        console.error('[mobile/analytics/consent] consent_updated не записан в журнал:', applied.journal.reason);
    }

    // Отвечаем ФАКТИЧЕСКИМ состоянием, а не тем, что попросил клиент: иначе
    // следующий же GET противоречил бы этому ответу.
    return NextResponse.json({
        granted: applied.consentAt !== null,
        since: applied.consentAt ? applied.consentAt.toISOString() : null,
    });
}
