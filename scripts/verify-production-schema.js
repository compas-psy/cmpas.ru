/* eslint-disable no-console */
const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient();

// Список ниже — исторический якорь: колонки, которые ломались раньше.
// Он НЕ является проверкой достаточности: новые поля в него никто не дописывает,
// и именно поэтому 17.08.2026 выкладка с неприменившейся миграцией отрапортовала
// успех, а вход в кабинет упал. Настоящая проверка — schemaColumnsFromPrisma(),
// она сверяет с базой каждое поле, которое Prisma ожидает увидеть.

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

// Каждая скалярная колонка, которую ожидает сгенерированный Prisma-клиент.
// Берётся из самой схемы, а не из списка, который надо не забыть дописать.
function schemaColumnsFromPrisma() {
    const expected = {};
    for (const model of Prisma.dmmf.datamodel.models) {
        const table = model.dbName || model.name;
        const columns = [];
        for (const field of model.fields) {
            if (field.kind === 'object') continue; // связь, не колонка
            if (field.relationName) continue;
            columns.push(field.dbName || field.name);
        }
        expected[table] = columns;
    }
    return expected;
}

async function readColumns() {
    return prisma.$queryRawUnsafe(`
        SELECT table_name AS "tableName", column_name AS "columnName"
        FROM information_schema.columns
        WHERE table_schema = 'public'
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
    const expected = { ...schemaColumnsFromPrisma() };
    // исторический якорь поверх схемы — на случай, если поле убрали из схемы,
    // но продукт всё ещё на него рассчитывает
    for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
        expected[table] = Array.from(new Set([...(expected[table] || []), ...columns]));
    }

    for (const [table, columns] of Object.entries(expected)) {
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
        console.error('[schema] База не соответствует схеме, которую ожидает приложение.');
        console.error('[schema] Чаще всего это значит, что миграция не применилась, а выкладка пошла дальше.');
        for (const item of missing) console.error(`  - ${item}`);
        await reportMigrationHistory();
        process.exitCode = 1;
        return;
    }

    console.log(`[schema] Все ${Object.keys(expected).length} таблиц и их колонки на месте.`);
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
