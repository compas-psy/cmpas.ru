'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';

async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

export async function getSessionForNotes(sessionId: string) {
    const psychologistId = await getPsychologistId();
    const session = await db.diarySession.findFirst({
        where: { id: sessionId, psychologistId },
        include: {
            client: { select: { id: true, name: true } },
        },
    });
    if (!session) return null;

    // Count previous sessions with this client
    const sessionNumber = await db.diarySession.count({
        where: {
            psychologistId,
            clientId: session.clientId,
            date: { lte: session.date },
        },
    });

    return {
        id: session.id,
        clientId: session.clientId,
        clientName: session.client.name,
        sessionNumber,
        date: session.date.toISOString(),
        time: session.time,
        endTime: session.endTime,
        duration: session.duration,
        format: session.format,
        status: session.status,
        notes: session.notes,
        structuredNotes: session.structuredNotes as any,
        privateNotes: session.privateNotes as any,
        clientSummary: session.clientSummary,
    };
}

export async function saveSessionNotes(sessionId: string, data: {
    notes?: string;
    structuredNotes?: any;
    privateNotes?: any;
    clientSummary?: string;
}) {
    const psychologistId = await getPsychologistId();
    const updatePayload: any = {};
    if (data.notes !== undefined) updatePayload.notes = data.notes;
    if (data.structuredNotes !== undefined) updatePayload.structuredNotes = data.structuredNotes;
    if (data.privateNotes !== undefined) updatePayload.privateNotes = data.privateNotes;
    if (data.clientSummary !== undefined) updatePayload.clientSummary = data.clientSummary;

    await db.diarySession.update({
        where: { id: sessionId, psychologistId },
        data: updatePayload,
    });
    return { success: true };
}
