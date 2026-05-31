'use server';

import { redirect } from 'next/navigation';
import { acknowledgeDocumentDelivery } from '@/lib/client-workflow';

export async function acknowledgeSpecialistDocument(formData: FormData) {
    const deliveryId = String(formData.get('deliveryId') || '');
    const token = String(formData.get('token') || '');

    await acknowledgeDocumentDelivery(deliveryId, token);
    redirect(`/client/documents/${deliveryId}/done`);
}
