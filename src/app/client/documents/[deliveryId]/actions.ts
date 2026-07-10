'use server';

import { redirect } from 'next/navigation';
import { acknowledgeDocumentDelivery } from '@/lib/client-workflow';

export async function acknowledgeSpecialistDocument(formData: FormData) {
    const deliveryId = String(formData.get('deliveryId') || '');
    const token = String(formData.get('token') || '');
    const agree = String(formData.get('agree') || '');

    // 152-ФЗ: согласие — только осознанное действие. Без отметки чекбокса
    // «Я ознакомлен(а)…» согласие не фиксируем, даже если форму отправили в обход UI.
    if (agree !== 'on') {
        redirect('/client/documents/' + deliveryId + '?t=' + encodeURIComponent(token) + '&needConsent=1');
    }

    await acknowledgeDocumentDelivery(deliveryId, token);
    redirect('/client/documents/' + deliveryId + '?t=' + encodeURIComponent(token) + '&accepted=1');
}
