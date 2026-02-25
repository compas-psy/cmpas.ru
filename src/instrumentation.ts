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
    }
}
