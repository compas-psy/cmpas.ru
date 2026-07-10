/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const REQUIRED_COLUMNS = {
    User: ['id', 'trialEndsAt', 'maxChatId', 'fcmToken'],
    DiaryClient: ['id', 'maxChatId'],
    DiarySession: [
        'id',
        'psychologistId',
        'clientId',
        'postSessionNudged',
        'clientMoodRating',
        'paymentStatus',
    ],
    LegalDocument: ['id', 'type', 'version', 'url', 'isActive'],
    LegalDocumentAcceptance: [
        'id',
        'userId',
        'documentId',
        'source',
        'documentType',
        'documentVersion',
    ],
    FeatureInterest: ['id', 'userId', 'feature', 'source', 'createdAt'],
    PracticeNotification: [
        'id',
        'psychologistId',
        'type',
        'title',
        'readAt',
        'createdAt',
    ],
};

async function readColumns() {
    return prisma.$queryRawUnsafe(`
        SELECT table_name AS "tableName", column_name AS "columnName"
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN (
            'User',
            'DiaryClient',
            'DiarySession',
            'LegalDocument',
            'LegalDocumentAcceptance',
            'FeatureInterest',
            'PracticeNotification'
          )
    `);
}

async function reportMigrationHistory() {
    try {
        const failed = await prisma.$queryRawUnsafe(`
            SELECT migration_name AS "migrationName",
                   started_at AS "startedAt",
                   finished_at AS "finishedAt",
                   rolled_back_at AS "rolledBackAt"
            FROM "_prisma_migrations"
            WHERE finished_at IS NULL
              AND rolled_back_at IS NULL
            ORDER BY started_at ASC
        `);

        if (failed.length > 0) {
            console.warn('[schema] Prisma migration history contains unfinished entries:');
            for (const migration of failed) {
                console.warn(`  - ${migration.migrationName} (started ${migration.startedAt?.toISOString?.() || migration.startedAt})`);
            }
            console.warn('[schema] Runtime schema is verified, but migration history still requires maintenance.');
        } else {
            console.log('[schema] Prisma migration history has no unfinished entries.');
        }
    } catch (error) {
        console.warn('[schema] Could not inspect _prisma_migrations:', error.message);
    }
}

async function main() {
    const rows = await readColumns();
    const actual = new Map();

    for (const row of rows) {
        if (!actual.has(row.tableName)) actual.set(row.tableName, new Set());
        actual.get(row.tableName).add(row.columnName);
    }

    const missing = [];
    for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
        const tableColumns = actual.get(table);
        if (!tableColumns) {
            missing.push(`${table} (table missing)`);
            continue;
        }
        for (const column of columns) {
            if (!tableColumns.has(column)) missing.push(`${table}.${column}`);
        }
    }

    if (missing.length > 0) {
        console.error('[schema] Required production schema is incomplete:');
        for (const item of missing) console.error(`  - ${item}`);
        process.exitCode = 1;
        return;
    }

    console.log('[schema] Required production tables and columns are present.');
    await reportMigrationHistory();
}

main()
    .catch((error) => {
        console.error('[schema] Verification failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
