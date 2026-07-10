import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { settlePastSessionsForAllPsychologists, settlePastSessionsForPsychologist } from '@/lib/session-maintenance';

export async function POST(req: Request) {
    const session = await auth();
    const cronSecret = process.env.CRON_SECRET;
    const providedSecret = req.headers.get('x-cron-secret');
    // @ts-expect-error role is added in auth session callback
    const isAdmin = Boolean(session?.user?.id && session.user.role === 'ADMIN');
    const isCron = Boolean(cronSecret && providedSecret === cronSecret);

    if (!isAdmin && !isCron) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const url = new URL(req.url);
        const psychologistId = url.searchParams.get('psychologistId');
        const result = psychologistId
            ? await settlePastSessionsForPsychologist(psychologistId)
            : await settlePastSessionsForAllPsychologists();
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error('[admin/sessions/settle POST]', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
