import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { hasSessionNotes } from '@/lib/session-maintenance';

/**
 * Action Center (Задача 17) — ОДИН источник правды о том, что в практике
 * требует решения. До него веб и мобайл считали «требует внимания» каждый
 * по-своему: веб — локально из уже загруженных сессий, мобайл — тремя
 * отдельными счётчиками в своём эндпоинте.
 *
 * Два свойства этого модуля важнее остальных:
 *
 * 1. Это ВЫЧИСЛЯЕМОЕ состояние, а не журнал. Пункт существует, пока
 *    существует проблема: появилась заметка — пункт исчезает на следующем
 *    обновлении. Поэтому здесь нет ни read-state, ни dismiss, ни отдельной
 *    таблицы, и не может быть рассинхрона между «сделано» и «показано».
 *
 * 2. Идентификаторы объектов рождаются ЗДЕСЬ, под текущим специалистом.
 *    Функция принимает psychologistId и сама фильтрует по нему каждый
 *    запрос; клиент не может передать чужой sessionId/clientId/batchId и
 *    получить чужой объект.
 */

export type PracticeAttentionType =
    | 'session_without_notes'
    | 'client_without_consent'
    | 'session_unpaid'
    | 'import_review';

export type PracticeAttentionItem = {
    /** Стабильный ключ пункта: тип + объект. Не хранится, вычисляется. */
    id: string;
    type: PracticeAttentionType;
    /** Одна строка целиком — «Анна · нет заметки по сессии 3 сентября». */
    label: string;
    /** Кто/что: имя клиента или источник импорта. */
    title: string;
    /** Что именно не решено, с датой, если она есть. */
    detail: string;
    sessionId?: string;
    clientId?: string;
    batchId?: string;
    /**
     * Только для import_review: разбор календарного импорта и импорта
     * таблицы живут на разных экранах, и по одному batchId адаптер не может
     * выбрать нужный. Это тот же факт из БД (PracticeImportBatch.sourceType),
     * а не выдумка представления.
     */
    importSource?: 'calendar' | 'spreadsheet';
};

/**
 * Заметку пишут по свежим следам. Сессия годичной давности без заметки —
 * это уже не задача на сегодня, а история, и в списке дел ей не место.
 * Тот же горизонт веб-дашборд использовал и до общего бэкенда.
 */
const NOTES_WINDOW_DAYS = 14;

/** Потолок на тип: список дел, а не выгрузка базы. */
const PER_TYPE_LIMIT = 25;

function humanDate(date: Date) {
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function compose(title: string, detail: string) {
    return `${title} · ${detail}`;
}

async function sessionsWithoutNotes(psychologistId: string, now: Date): Promise<PracticeAttentionItem[]> {
    const since = new Date(now);
    since.setDate(since.getDate() - NOTES_WINDOW_DAYS);

    const rows = await db.diarySession.findMany({
        where: { psychologistId, status: 'completed', date: { gte: since, lte: now } },
        select: {
            id: true, clientId: true, date: true, notes: true, clientSummary: true, structuredNotes: true,
            client: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
        take: 200,
    });

    return rows
        .filter(row => !hasSessionNotes(row))
        .slice(0, PER_TYPE_LIMIT)
        .map(row => {
            const title = row.client?.name || 'Клиент';
            const detail = `нет заметки по сессии ${humanDate(row.date)}`;
            return {
                id: `session_without_notes:${row.id}`,
                type: 'session_without_notes' as const,
                label: compose(title, detail),
                title,
                detail,
                sessionId: row.id,
                clientId: row.clientId,
            };
        });
}

async function clientsWithoutConsent(psychologistId: string): Promise<PracticeAttentionItem[]> {
    const rows = await db.diaryClient.findMany({
        where: { psychologistId, consentDate: null, status: 'active' },
        select: { id: true, name: true },
        orderBy: { createdAt: 'desc' },
        take: PER_TYPE_LIMIT,
    });

    return rows.map(row => {
        const title = row.name || 'Клиент';
        const detail = 'нет согласия на обработку данных';
        return {
            id: `client_without_consent:${row.id}`,
            type: 'client_without_consent' as const,
            label: compose(title, detail),
            title,
            detail,
            clientId: row.id,
        };
    });
}

/**
 * Настоящий paymentStatus, а не status='pending': это разные вещи. Колонка
 * живёт вне схемы Prisma (миграция 20260705183000), поэтому читается сырым
 * запросом — с тем же psychologistId в WHERE.
 */
async function unpaidSessions(psychologistId: string, now: Date): Promise<PracticeAttentionItem[]> {
    const rows = await db.$queryRaw<Array<{ id: string; clientId: string; date: Date; name: string | null }>>(Prisma.sql`
        SELECT s.id, s."clientId", s.date, c.name
        FROM "DiarySession" s
        LEFT JOIN "DiaryClient" c ON c.id = s."clientId"
        WHERE s."psychologistId" = ${psychologistId}
          AND s.status = 'completed'
          AND s."paymentStatus" = 'unpaid'
          AND s.date <= ${now}
        ORDER BY s.date DESC
        LIMIT ${PER_TYPE_LIMIT}
    `).catch(() => []);

    return rows.map(row => {
        const title = row.name || 'Клиент';
        const detail = `не отмечена оплата ${humanDate(new Date(row.date))}`;
        return {
            id: `session_unpaid:${row.id}`,
            type: 'session_unpaid' as const,
            label: compose(title, detail),
            title,
            detail,
            sessionId: row.id,
            clientId: row.clientId,
        };
    });
}

/**
 * Импорт, в котором остались неразрешённые элементы: либо начатый и
 * незавершённый разбор (batch в preview/failed с items в 'pending'), либо
 * завершённый импорт, где часть строк упала в 'error' — их title
 * сознательно сохраняется именно для разбора (см. commit.ts, пункт 7).
 * Разрешили — элемент уходит из выборки, пункт исчезает сам.
 */
async function importsNeedingReview(psychologistId: string): Promise<PracticeAttentionItem[]> {
    const batches = await db.practiceImportBatch.findMany({
        where: {
            psychologistId,
            status: { notIn: ['rolled_back'] },
            items: { some: { status: { in: ['pending', 'error'] } } },
        },
        select: {
            id: true,
            sourceType: true,
            createdAt: true,
            _count: { select: { items: { where: { status: { in: ['pending', 'error'] } } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: PER_TYPE_LIMIT,
    }).catch(() => []);

    return batches.map(batch => {
        const title = batch.sourceType === 'calendar' ? 'Импорт календаря' : 'Импорт таблицы';
        const pending = batch._count.items;
        const detail = `требуется проверка: ${pending}`;
        return {
            id: `import_review:${batch.id}`,
            type: 'import_review' as const,
            label: compose(title, detail),
            title,
            detail,
            batchId: batch.id,
            importSource: batch.sourceType === 'calendar' ? 'calendar' as const : 'spreadsheet' as const,
        };
    });
}

/**
 * Всё, что требует решения, конкретными объектами и в порядке важности:
 * согласие (правовая обязанность) → заметки → оплата → незакрытый импорт.
 */
export async function getPracticeAttention(psychologistId: string, now = new Date()): Promise<PracticeAttentionItem[]> {
    const [consent, notes, unpaid, imports] = await Promise.all([
        clientsWithoutConsent(psychologistId),
        sessionsWithoutNotes(psychologistId, now),
        unpaidSessions(psychologistId, now),
        importsNeedingReview(psychologistId),
    ]);

    return [...consent, ...notes, ...unpaid, ...imports];
}
