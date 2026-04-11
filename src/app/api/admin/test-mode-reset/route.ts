import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
    const session = await auth();
    const userRole = (session?.user as { role?: string })?.role;

    if (!session?.user || (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { userId } = await request.json();
    if (!userId) {
        return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const errors: string[] = [];

    // Delete in dependency order, tolerating missing records
    const steps: { name: string; fn: () => Promise<any> }[] = [
        { name: 'diarySession', fn: () => db.diarySession.deleteMany({ where: { psychologistId: userId } }) },
        { name: 'diaryClient', fn: () => db.diaryClient.deleteMany({ where: { psychologistId: userId } }) },
        { name: 'availabilitySlot', fn: () => db.availabilitySlot.deleteMany({ where: { psychologistId: userId } }) },
        { name: 'diaryBlock', fn: () => db.diaryBlock.deleteMany({ where: { psychologistId: userId } }) },
        { name: 'timeBlock', fn: () => db.timeBlock.deleteMany({ where: { psychologistId: userId } }) },
        { name: 'calendarIntegration', fn: () => db.calendarIntegration.deleteMany({ where: { psychologistId: userId } }) },
        { name: 'notificationSettings', fn: () => db.notificationSettings.deleteMany({ where: { psychologistId: userId } }) },
        { name: 'psychologistSettings', fn: () => db.psychologistSettings.deleteMany({ where: { psychologistId: userId } }) },
    ];

    for (const step of steps) {
        try {
            await step.fn();
        } catch (e: any) {
            errors.push(`${step.name}: ${e.message}`);
            console.error(`[testModeReset] Failed at ${step.name}:`, e);
        }
    }

    if (errors.length > 0 && errors.length === steps.length) {
        // All steps failed — likely auth or DB issue
        return NextResponse.json({ error: errors.join('; ') }, { status: 500 });
    }

    revalidatePath('/admin/users');
    return NextResponse.json({ success: true, errors: errors.length > 0 ? errors : undefined });
}
