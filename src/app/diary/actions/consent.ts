'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

export async function savePsychologistConsent(data: {
    pdnAccepted: boolean;
    adsAccepted: boolean;
    userAgent: string;
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    const dt = new Date();

    // Simplistic hash generation for demonstration purposes
    const generateHash = (type: string) => {
        return crypto
            .createHash('sha256')
            .update(`${session.user.id}-${type}-${dt.toISOString()}-${data.userAgent}`)
            .digest('hex');
    };

    const updateData: any = {};

    if (data.pdnAccepted) {
        updateData.pdnConsentVersion = 'v1.0';
        updateData.pdnConsentDate = dt;
        updateData.pdnConsentHash = generateHash('PDN');
    }

    if (data.adsAccepted) {
        updateData.adsConsentVersion = 'v1.0';
        updateData.adsConsentDate = dt;
        updateData.adsConsentHash = generateHash('ADS');
    }

    if (Object.keys(updateData).length === 0) {
        return { success: false, error: 'No consent provided' };
    }

    await db.user.update({
        where: { id: session.user.id },
        data: updateData
    });

    revalidatePath('/diary');
    return { success: true };
}
