// Reminders card (O-260817-12, feeds off the ReminderOutbox table from
// O-260817-16). Raw SQL, not the generated Prisma model — ReminderOutbox
// may not exist yet on whichever branch/deploy this runs against depending
// on merge order, and this table-existence check keeps the two orders from
// being coupled to each other.

import type { PrismaClient } from '@prisma/client';

type Db = Pick<PrismaClient, '$queryRaw'>;

export interface ReminderCounters {
    due: number;
    sent: number;
    sentTwice: number;
}

export async function reminderOutboxExists(db: Db): Promise<boolean> {
    const rows = await db.$queryRaw<{ exists: boolean }[]>`SELECT to_regclass('public."ReminderOutbox"') IS NOT NULL AS exists`;
    return rows[0]?.exists ?? false;
}

export async function collectReminderCounters(db: Db, now: Date = new Date()): Promise<ReminderCounters | null> {
    if (!(await reminderOutboxExists(db))) return null;
    const rows = await db.$queryRaw<{ due: bigint; sent: bigint; sent_twice: bigint }[]>`
        SELECT
            count(*) FILTER (WHERE "dueAt" <= ${now}) AS due,
            count(*) FILTER (WHERE status = 'sent') AS sent,
            count(*) FILTER (WHERE "sendCount" > 1) AS sent_twice
        FROM "ReminderOutbox"
    `;
    const row = rows[0];
    if (!row) return { due: 0, sent: 0, sentTwice: 0 };
    return { due: Number(row.due), sent: Number(row.sent), sentTwice: Number(row.sent_twice) };
}
