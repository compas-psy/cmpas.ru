export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const cron = await import('node-cron');
        const { processReminders } = await import('./lib/cron/reminders');

        // Задача запускается каждые 15 минут
        cron.schedule('*/15 * * * *', async () => {
            console.log('[CRON] Запуск рассылки уведомлений (каждые 15 минут)');
            try {
                await processReminders();
            } catch (error) {
                console.error('[CRON] Ошибка при рассылке уведомлений:', error);
            }
        });

        console.log('[CRON] Инструментация: cron-задачи зарегистрированы');

        // Register MAX webhook after startup (10s delay for server to be ready)
        const MAX_TOKEN = process.env.MAX_BOT_TOKEN;
        if (MAX_TOKEN) {
            const APP_URL = process.env.AUTH_URL || 'https://cmpas.ru';
            setTimeout(async () => {
                try {
                    // Delete old subscription first
                    await fetch('https://botapi.max.ru/subscriptions', {
                        method: 'DELETE',
                        headers: { 'Authorization': MAX_TOKEN },
                    }).catch(() => {});

                    // Register webhook
                    const res = await fetch('https://botapi.max.ru/subscriptions', {
                        method: 'POST',
                        headers: {
                            'Authorization': MAX_TOKEN,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            url: `${APP_URL}/api/max/webhook`,
                            // Correct MAX API names: 'message_callback' not 'callback_button_pressed'
                            update_types: ['bot_started', 'message_created', 'message_callback'],
                        }),
                    });
                    const result = await res.json();
                    console.log('[MAX] Webhook registration on startup:', JSON.stringify(result));
                } catch (e) {
                    console.error('[MAX] Webhook registration failed on startup:', e);
                }
            }, 10000);
        }
    }
}
