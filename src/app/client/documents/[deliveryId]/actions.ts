'use server';

import { redirect } from 'next/navigation';
import { acknowledgeDocumentDelivery } from '@/lib/client-workflow';
import { notifyDocumentDeliveryEvent } from '@/lib/document-delivery-notifications';

export async function acknowledgeSpecialistDocument(formData: FormData) {
    const deliveryId = String(formData.get('deliveryId') || '');
    const token = String(formData.get('token') || '');
    const accepted = formData.get('accepted') === 'yes';
    const base = '/client/documents/' + deliveryId + '?t=' + encodeURIComponent(token);

    if (!accepted) {
        redirect(base + '&error=accepted_required');
    }

    await acknowledgeDocumentDelivery(deliveryId, token);
    await notifyDocumentDeliveryEvent(deliveryId, 'acknowledged');
    redirect(base + '&accepted=1');
}
