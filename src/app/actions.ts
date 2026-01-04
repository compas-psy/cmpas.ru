'use server';

export async function submitOrder(data: { name: string; phone: string; method: string }) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.error('Telegram config missing');
        return { success: false, message: 'Configuration error on server: missing tokens.' };
    }

    // Translate method key to readable label if needed, or just send as is
    const methodLabels: Record<string, string> = {
        'telegram': 'Telegram',
        'whatsapp': 'WhatsApp',
        'call': 'Звонок'
    };
    const readableMethod = methodLabels[data.method] || data.method;

    const text = `Поступил заказ:
Имя: ${data.name}
Номер телефона: ${data.phone}
Способ связи: ${readableMethod}`;

    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Telegram API Error:', errorData);
            return { success: false, message: 'Failed to send message to Telegram.' };
        }

        return { success: true, message: 'Order sent successfully!' };
    } catch (error) {
        console.error('Network Error:', error);
        return { success: false, message: 'Network error occurred.' };
    }
}
