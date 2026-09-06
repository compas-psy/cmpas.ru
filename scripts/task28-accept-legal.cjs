/**
 * Задача 28: проставить синтетическим специалистам согласие со ВСЕМИ активными
 * обязательными документами.
 *
 * Зачем отдельный шаг, а не строчка в посеве: активные документы заводит само
 * приложение при первом обращении (ensureActiveLegalDocuments), то есть уже
 * ПОСЛЕ посева. Пока согласия нет, любой экран кабинета подменяется страницей
 * «Мы обновили правила» — и приёмочный обход упирается в неё вместо того,
 * чтобы проверять продукт.
 *
 * Скрипт идёт циклом: дёрнуть приложение, проставить согласия, пересчитать
 * оставшиеся. Разово это делать нельзя — документ может появиться между
 * проверкой и вставкой.
 *
 * Юридический барьер этим НЕ отключается: он проверяется отдельно, на своём
 * специалисте, в сценарии 25 (см. task28-release-acceptance.md).
 */
const { PrismaClient } = require('@prisma/client');

const BASE = process.env.TASK28_BASE_URL || 'http://localhost:3100';
const USERS = (process.env.TASK28_USERS || 't27-psy-a,t27-psy-b').split(',').map((s) => s.trim()).filter(Boolean);
const SESSION_COOKIE = process.env.TASK28_SESSION || 't27-session-a';

const db = new PrismaClient();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Обязательные — все активные, кроме рекламного согласия: оно добровольное. */
async function requiredActiveDocuments() {
    return db.legalDocument.findMany({
        where: { isActive: true, NOT: { type: 'MARKETING' } },
        select: { id: true, type: true, version: true, code: true },
    });
}

async function backfill() {
    const docs = await requiredActiveDocuments();
    let created = 0;
    for (const doc of docs) {
        for (const userId of USERS) {
            const exists = await db.legalDocumentAcceptance.findFirst({
                where: { userId, documentId: doc.id },
                select: { id: true },
            });
            if (exists) continue;
            await db.legalDocumentAcceptance.create({
                data: {
                    userId,
                    documentId: doc.id,
                    acceptedAt: new Date(),
                    source: 'task28-staging-seed',
                    documentType: doc.type,
                    documentVersion: doc.version,
                    documentCode: doc.code,
                },
            });
            created += 1;
        }
    }
    return { docs: docs.length, created };
}

async function stillMissing() {
    const docs = await requiredActiveDocuments();
    let missing = 0;
    for (const doc of docs) {
        for (const userId of USERS) {
            const exists = await db.legalDocumentAcceptance.findFirst({
                where: { userId, documentId: doc.id },
                select: { id: true },
            });
            if (!exists) missing += 1;
        }
    }
    return missing;
}

async function pokeApp() {
    try {
        await fetch(`${BASE}/diary`, { headers: { Cookie: `authjs.session-token=${SESSION_COOKIE}` } });
    } catch {
        /* приложение ещё поднимается — следующая попытка */
    }
}

(async () => {
    for (let attempt = 1; attempt <= 6; attempt += 1) {
        await pokeApp();
        await sleep(1500);
        const { docs, created } = await backfill();
        const missing = await stillMissing();
        console.log(`попытка ${attempt}: активных обязательных документов ${docs}, добавлено согласий ${created}, осталось без согласия ${missing}`);
        if (missing === 0) {
            await db.$disconnect();
            process.exit(0);
        }
    }
    console.error('НЕ УДАЛОСЬ: остались обязательные документы без согласия');
    await db.$disconnect();
    process.exit(1);
})();
