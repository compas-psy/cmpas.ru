'use server';

import { randomUUID } from 'crypto';
import { auth } from '@/auth';
import { db } from '@/lib/db';

async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

export async function getPaymentSettings() {
    const psychologistId = await getPsychologistId();
    const rows = await db.$queryRaw<Array<{
        id: string;
        isEnabled: boolean;
        paymentText: string | null;
        paymentLink: string | null;
        paymentQrUrl: string | null;
        prepaymentRequired: boolean;
        paymentDueText: string | null;
    }>>`
        SELECT id, "isEnabled", "paymentText", "paymentLink", "paymentQrUrl", "prepaymentRequired", "paymentDueText"
        FROM "PsychologistPaymentSettings"
        WHERE "psychologistId" = ${psychologistId}
        LIMIT 1
    `;
    return rows[0] || null;
}

export async function savePaymentSettings(data: {
    isEnabled?: boolean;
    paymentText?: string | null;
    paymentLink?: string | null;
    paymentQrUrl?: string | null;
    prepaymentRequired?: boolean;
    paymentDueText?: string | null;
}) {
    const psychologistId = await getPsychologistId();
    const existing = await getPaymentSettings();
    const now = new Date();

    if (existing?.id) {
        await db.$executeRaw`
            UPDATE "PsychologistPaymentSettings"
            SET "isEnabled" = ${!!data.isEnabled},
                "paymentText" = ${data.paymentText || null},
                "paymentLink" = ${data.paymentLink || null},
                "paymentQrUrl" = ${data.paymentQrUrl || null},
                "prepaymentRequired" = ${data.prepaymentRequired !== false},
                "paymentDueText" = ${data.paymentDueText || null},
                "updatedAt" = ${now}
            WHERE id = ${existing.id} AND "psychologistId" = ${psychologistId}
        `;
        return { success: true, id: existing.id };
    }

    const id = randomUUID();
    await db.$executeRaw`
        INSERT INTO "PsychologistPaymentSettings"
            (id, "psychologistId", "isEnabled", "paymentText", "paymentLink", "paymentQrUrl", "prepaymentRequired", "paymentDueText", "createdAt", "updatedAt")
        VALUES
            (${id}, ${psychologistId}, ${!!data.isEnabled}, ${data.paymentText || null}, ${data.paymentLink || null}, ${data.paymentQrUrl || null}, ${data.prepaymentRequired !== false}, ${data.paymentDueText || null}, ${now}, ${now})
    `;
    return { success: true, id };
}
