'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { recordClientConsent } from '@/lib/client-workflow';

export async function acceptClientConsent(formData: FormData) {
    const clientId = String(formData.get('clientId') || '');
    const psychologistId = String(formData.get('psychologistId') || '');
    const token = String(formData.get('token') || '');

    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || headersList.get('x-real-ip') || null;

    await recordClientConsent({ clientId, psychologistId, token, ipAddress });
    redirect(`/client/consent/${clientId}/done`);
}
