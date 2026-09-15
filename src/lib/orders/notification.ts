import { escapeHtml } from '@/lib/messaging/format';

/**
 * ТЕКСТ УВЕДОМЛЕНИЯ О ЗАКАЗЕ ЕЖЕДНЕВНИКА.
 *
 * Отдельным модулем, а не рядом с приёмом заказа, по двум причинам. Первая
 * техническая: в файле с «use server» каждый экспорт обязан быть
 * асинхронной функцией, и сборка это проверяет. Вторая по существу: текст,
 * который читает человек, должен проверяться тестом без базы, сети и
 * Telegram — а приём заказа тянет всё три.
 */

const METHOD_LABELS: Record<string, string> = {
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
    max: 'Max',
    call: 'Звонок',
};

/** Текст уведомления о заказе. */
export function orderNotificationText(order: {
    name: string;
    phone: string;
    method: string;
    message?: string | null;
    city?: string | null;
    country?: string | null;
}): string {
    // Разметка здесь по умолчанию HTML (так настроена общая отправка), а имя
    // и сообщение пишет человек: амперсанд в тексте отменил бы уведомление
    // целиком — ровно то же, что чинилось в массовой рассылке (У3).
    const lines = [
        '<b>Новый заказ ежедневника</b>',
        '',
        `Имя: ${escapeHtml(order.name)}`,
        `Телефон: ${escapeHtml(order.phone)}`,
        `Способ связи: ${escapeHtml(METHOD_LABELS[order.method] || order.method)}`,
    ];
    if (order.city && order.country) {
        lines.push(`Откуда: ${escapeHtml(order.city)}, ${escapeHtml(order.country)}`);
    }
    const message = (order.message || '').trim();
    if (message) {
        // Сообщение — последним и отдельным абзацем: это то, ради чего
        // человек открыл форму, и читать его должны не между полями.
        lines.push('', 'Сообщение:', escapeHtml(message));
    }
    return lines.join('\n');
}
