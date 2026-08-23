export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const cron = await import('node-cron');
        const { processReminders } = await import('./lib/cron/reminders');
        const { processMorningDigest, processWeeklyDigest } = await import('./lib/cron/digest');
        const { processPostSessionNudge } = await import('./lib/cron/post-session');
        const { processScheduledMessages } = await import('./lib/cron/scheduled-messages');
        const { flushResponseTimeWindow } = await import('./lib/cron/response-time');

        // Напоминания каждые 15 минут
        cron.schedule('*/15 * * * *', async () => {
            console.log('[CRON] Запуск рассылки уведомлений (каждые 15 минут)');
            try {
                await processReminders();
            } catch (error) {
                console.error('[CRON] Ошибка при рассылке уведомлений:', error);
            }
        });

        // Утренний дайджест — 08:00 МСК (05:00 UTC)
        cron.schedule('0 5 * * *', async () => {
            console.log('[CRON] Утренний дайджест');
            try {
                await processMorningDigest();
            } catch (error) {
                console.error('[CRON] Ошибка утреннего дайджеста:', error);
            }
        });

        // Еженедельная сводка — понедельник 10:00 МСК (07:00 UTC)
        cron.schedule('0 7 * * 1', async () => {
            console.log('[CRON] Еженедельная сводка');
            try {
                await processWeeklyDigest();
            } catch (error) {
                console.error('[CRON] Ошибка еженедельной сводки:', error);
            }
        });

        // Пост-сессионный nudge — каждые 30 минут
        cron.schedule('*/30 * * * *', async () => {
            try {
                await processPostSessionNudge();
            } catch (error) {
                console.error('[CRON] Ошибка пост-сессионного nudge:', error);
            }
        });

        // Отложенные сообщения клиентам — каждые 5 минут
        cron.schedule('*/5 * * * *', async () => {
            try {
                await processScheduledMessages();
            } catch (error) {
                console.error('[CRON] Ошибка отложенных сообщений:', error);
            }
        });

        // Снимок времени ответа приложения (q_tech_response_p95, ТЗ §5) —
        // каждые 5 минут, тем же периодом, что и отложенные сообщения выше.
        cron.schedule('*/5 * * * *', async () => {
            await flushResponseTimeWindow();
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
