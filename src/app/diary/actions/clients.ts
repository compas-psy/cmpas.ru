'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

export async function getClients(search?: string) {
    const psychologistId = await getPsychologistId();
    return db.diaryClient.findMany({
        where: {
            psychologistId,
            ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
        },
        include: { questionnaire: true },
        orderBy: { updatedAt: 'desc' },
    });
}

export async function getClient(id: string) {
    const psychologistId = await getPsychologistId();
    return db.diaryClient.findFirst({
        where: { id, psychologistId },
        include: {
            questionnaire: true,
            sessions: { orderBy: { date: 'desc' } },
        },
    });
}

export async function createClient(data: {
    name: string;
    phone?: string;
    email?: string;
    dateOfBirth?: string;
    age?: number;
    gender?: string;
}) {
    const psychologistId = await getPsychologistId();
    const client = await db.diaryClient.create({
        data: {
            psychologistId,
            name: data.name,
            phone: data.phone || null,
            email: data.email || null,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
            age: data.age || null,
            gender: data.gender || null,
        },
    });
    revalidatePath('/diary');
    revalidatePath('/diary/clients');
    return client;
}

export async function updateClient(id: string, data: Record<string, unknown>) {
    const psychologistId = await getPsychologistId();
    const client = await db.diaryClient.update({
        where: { id },
        data: { ...data, psychologistId },
    });
    revalidatePath('/diary');
    revalidatePath('/diary/clients');
    return client;
}

export async function deleteClient(id: string) {
    await getPsychologistId();
    await db.diaryClient.delete({ where: { id } });
    revalidatePath('/diary');
    revalidatePath('/diary/clients');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveQuestionnaire(clientId: string, data: any) {
    await getPsychologistId();
    const result = await db.diaryQuestionnaire.upsert({
        where: { clientId },
        create: { clientId, data },
        update: { data },
    });
    revalidatePath('/diary/clients');
    return result;
}
