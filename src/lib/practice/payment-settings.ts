import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { clampReminderHours, DEFAULT_REMINDER_HOURS } from '@/lib/messaging/payment-reminder-interval';

/**
 * Настройки оплаты клиентом — ядро без сессии.
 *
 * Читают и пишут их из двух мест: веб-кабинет (server action, специалист из
 * сессии) и приложение (маршрут, специалист из ключа устройства). Две копии
 * одной записи разошлись бы молча — и разошлись бы именно там, где это
 * дороже всего: в ссылке, по которой человек платит деньги.
 *
 * Таблица живёт только в миграциях, поэтому $queryRaw, а не Prisma-модель.
 */
export type PaymentSettings = {
    id: string;
    isEnabled: boolean;
    paymentText: string | null;
    paymentLink: string | null;
    paymentQrUrl: string | null;
    prepaymentRequired: boolean;
    paymentDueText: string | null;
    paymentReminderEnabled: boolean;
    paymentReminderHoursBefore: number;
};

export async function readPaymentSettings(psychologistId: string): Promise<PaymentSettings | null> {
    const rows = await db.$queryRaw<PaymentSettings[]>`
        SELECT id, "isEnabled", "paymentText", "paymentLink", "paymentQrUrl", "prepaymentRequired", "paymentDueText",
               "paymentReminderEnabled", "paymentReminderHoursBefore"
        FROM "PsychologistPaymentSettings"
        WHERE "psychologistId" = ${psychologistId}
        LIMIT 1
    `;
    return rows[0] || null;
}

export type PaymentSettingsInput = {
    isEnabled?: boolean;
    paymentText?: string | null;
    paymentLink?: string | null;
    paymentQrUrl?: string | null;
    prepaymentRequired?: boolean;
    paymentDueText?: string | null;
    paymentReminderEnabled?: boolean;
    paymentReminderHoursBefore?: number;
};

/**
 * Записать настройки.
 *
 * `patch: true` — правка отдельных полей (так пишет приложение: в нём
 * настроена ссылка и напоминание, а длинный текст инструкции правится в
 * веб-кабинете). Без него отсутствующее поле означает «пусто»: форма в вебе
 * присылает всё целиком, и молча сохранённое старое значение там выглядело
 * бы как «удалил, а оно вернулось».
 */
export async function writePaymentSettings(
    psychologistId: string,
    data: PaymentSettingsInput,
    options: { patch?: boolean } = {},
): Promise<PaymentSettings> {
    const existing = await readPaymentSettings(psychologistId);
    const now = new Date();
    const base: PaymentSettingsInput = options.patch && existing ? existing : {};
    const merged = { ...base, ...data };
    const reminderHours = clampReminderHours(
        merged.paymentReminderHoursBefore ?? existing?.paymentReminderHoursBefore ?? DEFAULT_REMINDER_HOURS,
    );

    if (existing?.id) {
        await db.$executeRaw`
            UPDATE "PsychologistPaymentSettings"
            SET "isEnabled" = ${!!merged.isEnabled},
                "paymentText" = ${merged.paymentText || null},
                "paymentLink" = ${merged.paymentLink || null},
                "paymentQrUrl" = ${merged.paymentQrUrl || null},
                "prepaymentRequired" = ${merged.prepaymentRequired !== false},
                "paymentDueText" = ${merged.paymentDueText || null},
                "paymentReminderEnabled" = ${!!merged.paymentReminderEnabled},
                "paymentReminderHoursBefore" = ${reminderHours},
                "updatedAt" = ${now}
            WHERE id = ${existing.id} AND "psychologistId" = ${psychologistId}
        `;
    } else {
        await db.$executeRaw`
            INSERT INTO "PsychologistPaymentSettings"
                (id, "psychologistId", "isEnabled", "paymentText", "paymentLink", "paymentQrUrl", "prepaymentRequired", "paymentDueText", "paymentReminderEnabled", "paymentReminderHoursBefore", "createdAt", "updatedAt")
            VALUES
                (${randomUUID()}, ${psychologistId}, ${!!merged.isEnabled}, ${merged.paymentText || null}, ${merged.paymentLink || null}, ${merged.paymentQrUrl || null}, ${merged.prepaymentRequired !== false}, ${merged.paymentDueText || null}, ${!!merged.paymentReminderEnabled}, ${reminderHours}, ${now}, ${now})
        `;
    }

    const saved = await readPaymentSettings(psychologistId);
    if (!saved) throw new Error('Настройки оплаты не сохранились');
    return saved;
}

/** Ссылка проверяется на разбираемость, а не на «правильность»: платёжных
 *  сервисов много, и запрет всего незнакомого сделал бы поле бесполезным
 *  ровно тому, у кого банк свой. */
export function isValidPaymentLink(link: string): boolean {
    return /^https?:\/\/\S+$/i.test(link);
}
