export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const cron = await import('node-cron');
        const { processReminders } = await import('./lib/cron/reminders');
        const { processMorningDigest, processWeeklyDigest } = await import('./lib/cron/digest');
        const { processPostSessionNudge } = await import('./lib/cron/post-session');
        const { processNextBookingNudge, processWeeklyFollowup } = await import('./lib/cron/post-session-cascade');
        const { processScheduledMessages } = await import('./lib/cron/scheduled-messages');
        const { processPaymentReminders } = await import('./lib/cron/payment-reminders');
        const { flushResponseTimeWindow } = await import('./lib/cron/response-time');
        const { pruneOldAnalyticsEvents } = await import('./lib/cron/analytics-retention');
        const { rescueUndeliveredTelegramUpdates } = await import('./lib/telegram/webhook-watchdog');
        const { runExclusive } = await import('./lib/cron/run-exclusive');

        // Подстраховка доставки Telegram — каждые 5 минут.
        //
        // Вебхук остаётся главным: пока очередь у Telegram пуста, сторож
        // не делает ничего, кроме одного дешёвого вопроса. Запасной путь
        // включается, только когда Telegram сам жалуется, что не может к
        // нам достучаться, — и сразу возвращает вебхук обратно.
        //
        // Пять минут — это и предельная задержка в плохом случае. Без
        // сторожа она была 23 минуты и больше, и предела у неё не было
        // вовсе.
        cron.schedule('*/5 * * * *', runExclusive('telegram-webhook-watchdog', async () => {
            try {
                await rescueUndeliveredTelegramUpdates();
            } catch (error) {
                console.error('[CRON] Ошибка сторожа доставки Telegram:', error);
            }
        }));

        // Напоминания каждые 15 минут
        cron.schedule('*/15 * * * *', runExclusive('reminders', async () => {
            console.log('[CRON] Запуск рассылки уведомлений (каждые 15 минут)');
            try {
                await processReminders();
            } catch (error) {
                console.error('[CRON] Ошибка при рассылке уведомлений:', error);
            }
        }));

        // Утренний дайджест — КАЖДЫЙ ЧАС, а отбор по поясу практики внутри
        // (src/lib/cron/digest.ts). Раньше стояло 08:00 МСК на всех сразу:
        // специалисту в Калининграде список приходил в 07:00, а во
        // Владивостоке — в 15:00, когда встречи уже прошли.
        cron.schedule('0 * * * *', runExclusive('morning-digest', async () => {
            console.log('[CRON] Утренний дайджест');
            try {
                await processMorningDigest();
            } catch (error) {
                console.error('[CRON] Ошибка утреннего дайджеста:', error);
            }
        }));

        // Еженедельная сводка — тоже каждый час: понедельник и 10:00
        // считаются по поясу практики, а не по московскому. В понедельник
        // 10:00 во Владивостоке в Москве ещё воскресенье.
        cron.schedule('0 * * * *', runExclusive('weekly-digest', async () => {
            console.log('[CRON] Еженедельная сводка');
            try {
                await processWeeklyDigest();
            } catch (error) {
                console.error('[CRON] Ошибка еженедельной сводки:', error);
            }
        }));

        // Пост-сессионный nudge — каждые 30 минут
        cron.schedule('*/30 * * * *', runExclusive('post-session-nudge', async () => {
            try {
                await processPostSessionNudge();
            } catch (error) {
                console.error('[CRON] Ошибка пост-сессионного nudge:', error);
            }
        }));

        // O-260829 §5.4: пост-сессионный каскад — предложение ближайшего
        // времени через 2 часа после конца сессии. Тем же периодом, что
        // старый processPostSessionNudge (mood-check v1, выключен по
        // умолчанию и не связан с этим новым каскадом).
        cron.schedule('*/30 * * * *', runExclusive('next-booking-nudge', async () => {
            try {
                await processNextBookingNudge();
            } catch (error) {
                console.error('[CRON] Ошибка каскада "ближайшее время":', error);
            }
        }));

        // O-260829 §5.4: сообщение через неделю без новой записи — раз в
        // сутки, в тихое время (03:10 МСК = 00:10 UTC), рядом со сроком
        // хранения аналитики ниже.
        cron.schedule('10 0 * * *', runExclusive('weekly-followup', async () => {
            try {
                await processWeeklyFollowup();
            } catch (error) {
                console.error('[CRON] Ошибка недельного напоминания:', error);
            }
        }));

        // Напоминание об оплате перед встречей — каждые 15 минут, тем же
        // шагом, что и напоминания о самой встрече. Точнее не нужно:
        // интервал задаётся в часах, а четверть часа в напоминании об
        // оплате за сутки ничего не меняет. Тихие часы считаются по поясу
        // практики внутри задания, а не расписанием сервера.
        cron.schedule('*/15 * * * *', runExclusive('payment-reminders', async () => {
            try {
                await processPaymentReminders();
            } catch (error) {
                console.error('[CRON] Ошибка напоминаний об оплате:', error);
            }
        }));

        // Отложенные сообщения клиентам — каждые 5 минут
        cron.schedule('*/5 * * * *', runExclusive('scheduled-messages', async () => {
            try {
                await processScheduledMessages();
            } catch (error) {
                console.error('[CRON] Ошибка отложенных сообщений:', error);
            }
        }));

        // Снимок времени ответа приложения (q_tech_response_p95, ТЗ §5) —
        // каждые 5 минут, тем же периодом, что и отложенные сообщения выше.
        cron.schedule('*/5 * * * *', runExclusive('response-time-window', async () => {
            await flushResponseTimeWindow();
        }));

        // Срок хранения AnalyticsEvent — 180 дней (решение учредителя 6) —
        // раз в сутки, в 03:00 МСК (00:00 UTC), в тихое время.
        cron.schedule('0 0 * * *', runExclusive('analytics-retention', async () => {
            console.log('[CRON] Срок хранения аналитических событий (180 дней)');
            try {
                await pruneOldAnalyticsEvents();
            } catch (error) {
                console.error('[CRON] Ошибка удаления устаревших аналитических событий:', error);
            }
        }));

        console.log('[CRON] Инструментация: cron-задачи зарегистрированы');

        // Register MAX webhook after startup (10s delay for server to be ready).
        // MAX migrated its API domain to platform-api2.max.ru (19.07.2026).
        const MAX_TOKEN = process.env.MAX_BOT_TOKEN;
        if (MAX_TOKEN) {
            const APP_URL = process.env.AUTH_URL || 'https://cmpas.ru';
            const webhookUrl = `${APP_URL}/api/max/webhook`;
            setTimeout(async () => {
                try {
                    // Delete old subscription first — DELETE requires ?url=
                    // to identify which subscription to remove.
                    const deleteQs = new URLSearchParams({ url: webhookUrl }).toString();
                    await fetch(`https://platform-api2.max.ru/subscriptions?${deleteQs}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': MAX_TOKEN },
                    }).catch(() => {});

                    // Register webhook. This runs on every startup, so it's
                    // the path that must carry MAX_WEBHOOK_SECRET — omitting
                    // it here would silently re-register the subscription
                    // without a secret on every restart, even after a
                    // deploy/admin-route registration set one correctly
                    // (src/app/api/max/webhook/route.ts verifies it and now
                    // fails closed without it).
                    const res = await fetch('https://platform-api2.max.ru/subscriptions', {
                        method: 'POST',
                        headers: {
                            'Authorization': MAX_TOKEN,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            url: webhookUrl,
                            // Correct MAX API names: 'message_callback' not 'callback_button_pressed'
                            update_types: ['bot_started', 'message_created', 'message_callback'],
                            ...(process.env.MAX_WEBHOOK_SECRET ? { secret: process.env.MAX_WEBHOOK_SECRET } : {}),
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
