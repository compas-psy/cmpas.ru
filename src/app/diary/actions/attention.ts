'use server';

import { auth } from '@/auth';
import { getPracticeAttention, type PracticeAttentionItem } from '@/lib/practice/attention';

/**
 * Тонкая обёртка вокруг общего Action Center (Задача 17): единственное её
 * дело — узнать, КТО спрашивает, и передать это в getPracticeAttention.
 * Идентификатор специалиста берётся из сессии и никогда из аргументов, так
 * что вызвать её «за другого» нельзя.
 */
export async function getDashboardAttention(): Promise<PracticeAttentionItem[]> {
    const session = await auth();
    if (!session?.user?.id) return [];
    return getPracticeAttention(session.user.id);
}
