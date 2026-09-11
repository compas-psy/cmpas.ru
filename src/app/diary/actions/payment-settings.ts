'use server';

import { auth } from '@/auth';
import {
    readPaymentSettings,
    writePaymentSettings,
    type PaymentSettingsInput,
} from '@/lib/practice/payment-settings';

/**
 * Настройки оплаты в веб-кабинете.
 *
 * Тонкая обёртка над общим ядром (src/lib/practice/payment-settings.ts): то
 * же самое пишет приложение через /api/mobile/payment-settings, и две копии
 * одной записи разошлись бы в ссылке, по которой человек платит деньги.
 */
async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

export async function getPaymentSettings() {
    return readPaymentSettings(await getPsychologistId());
}

export async function savePaymentSettings(data: PaymentSettingsInput) {
    const psychologistId = await getPsychologistId();
    // Форма присылает всё целиком, поэтому без patch: пустое поле означает
    // «удалил», а не «оставь как было».
    const saved = await writePaymentSettings(psychologistId, data);
    return { success: true, id: saved.id };
}
