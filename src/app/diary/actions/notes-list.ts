'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { normalizeStructuredNotes } from '@/lib/smart-notes/config';

async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

export type NoteListItem = {
    id: string;
    clientId: string;
    clientName: string;
    clientInitials: string;
    sessionNumber: number;
    date: string;
    time: string;
    duration: number;
    format: string;
    status: string;
    notes: string | null;
    structuredNotes: any;
    privateNotes: any;
    clientSummary: string | null;
    hasBlocks: boolean;
    blockCount: number;
    preview: string;
};

export async function getAllNotes(opts?: { search?: string; clientId?: string }) {
    const psychologistId = await getPsychologistId();

    const where: any = {
        psychologistId,
        OR: [
            { notes: { not: null } },
            { structuredNotes: { not: null } },
            { privateNotes: { not: null } },
        ],
    };

    if (opts?.clientId) {
        where.clientId = opts.clientId;
    }

    const sessions = await db.diarySession.findMany({
        where,
        include: {
            client: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
    });

    // Filter by search if needed
    let results = sessions.map((s: any) => {
        // Tolerate the bare-array shape written by Android before NOTES-1's fix.
        const sn = normalizeStructuredNotes(s.structuredNotes);
        const blocks = sn?.blocks || [];
        const blockTexts = blocks.map((b: any) =>
            Object.values(b.values || {}).filter(Boolean).join(' ')
        );
        const allText = [s.notes || '', ...blockTexts, s.clientSummary || ''].join(' ');
        const preview = s.notes
            ? s.notes.slice(0, 120)
            : blockTexts[0]?.slice(0, 120) || s.clientSummary?.slice(0, 120) || '';

        // Session number
        const client = s.client;

        return {
            id: s.id,
            clientId: s.clientId,
            clientName: client.name,
            clientInitials: (client.name || '?').slice(0, 2).toUpperCase(),
            sessionNumber: 0, // will be calculated
            date: s.date.toISOString(),
            time: s.time,
            duration: s.duration,
            format: s.format,
            status: s.status,
            notes: s.notes,
            structuredNotes: sn,
            privateNotes: s.privateNotes,
            clientSummary: s.clientSummary,
            hasBlocks: blocks.length > 0,
            blockCount: blocks.length,
            preview,
            _allText: allText.toLowerCase(),
        };
    });

    // Search filter
    if (opts?.search) {
        const q = opts.search.toLowerCase();
        results = results.filter((r: any) => r._allText.includes(q) || r.clientName.toLowerCase().includes(q));
    }

    // Calculate session numbers per client
    const clientSessions: Record<string, number> = {};
    // Sort by date asc for numbering, then reverse
    const sortedForNumbering = [...results].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (const r of sortedForNumbering) {
        clientSessions[r.clientId] = (clientSessions[r.clientId] || 0) + 1;
        r.sessionNumber = clientSessions[r.clientId];
    }

    // Remove internal field and return in desc order
    return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(({ _allText, ...r }: any) => r as NoteListItem);
}

export async function getClientsForNotesFilter() {
    const psychologistId = await getPsychologistId();
    const clients = await db.diaryClient.findMany({
        where: { psychologistId, status: 'active' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
    });
    return clients;
}

export async function getSessionsWithoutNotes() {
    const psychologistId = await getPsychologistId();
    const sessions = await db.diarySession.findMany({
        where: {
            psychologistId,
            notes: null,
            structuredNotes: null,
            privateNotes: null,
            status: { in: ['completed', 'confirmed'] },
        },
        include: {
            client: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
    });
    return sessions.map((s: any) => ({
        id: s.id,
        clientId: s.clientId,
        clientName: s.client.name,
        date: s.date.toISOString(),
        time: s.time,
        duration: s.duration,
    }));
}

