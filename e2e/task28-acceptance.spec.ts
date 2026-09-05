import { PrismaClient } from '@prisma/client';
import { test, expect, signIn, SEED, TOKENS } from './fixtures';

/**
 * Задача 28: приёмка выпуска на production-like стенде.
 *
 * Здесь НЕ повторяются двенадцать сценариев Задачи 27 — они живут в
 * release-journeys.spec.ts и гоняются тем же прогоном. Здесь то, чего в них
 * не было и что Задача 28 требует отдельно:
 *
 *   §10  три обязательных адреса, включая обратную совместимость /bot/book/<id>
 *   §21  импортированная сессия молчит: ни сообщения, ни напоминания
 *   §22  выключенное напоминание не отправляется
 *   §23  флаги запуска выключены
 *   §24  чужое нельзя ни прочитать, ни изменить, подделанный токен отвергнут
 *   §25  юридический барьер держит нового специалиста
 *
 * Все проверки смотрят на наблюдаемое следствие: строку в базе, состояние
 * экрана, код ответа — не на то, что функция вызвалась.
 */

const db = new PrismaClient();

test.afterAll(async () => {
    await db.$disconnect();
});

// ───────────────────────── §10 Три обязательных адреса ─────────────────────

test.describe('§10 адреса', () => {
    test('/diary — кабинет, а не юридический барьер и не визард', async ({ page }) => {
        await signIn(page, SEED.sessionA);
        await page.goto('/diary');
        const body = page.locator('body');
        await expect(body).toContainText(/Добр(ое утро|ый день|ый вечер)/);
        await expect(body).toContainText('Расписание на сегодня');
        await expect(body).not.toContainText('Мы обновили правила');
        expect(page.url()).toContain('/diary');
        expect(page.url()).not.toContain('/onboarding');
    });

    test('/u/<slug> — постоянная ссылка ведёт к тому самому специалисту', async ({ page }) => {
        await page.goto(`/u/${SEED.slug}`);
        const body = page.locator('body');
        // Видно, к кому записываешься, и предложено время.
        await expect(body).toContainText('Мария');
        await expect(body).toContainText('Когда вам удобнее?');
        // Оба формата дня различимы: онлайн и кабинет — разные секции.
        await expect(body).toContainText(/ОНЛАЙН|Онлайн/);
        expect(page.url()).toContain(SEED.slug);
    });

    test('/bot/book/<id> — старый адрес не стал тупиком', async ({ page }) => {
        await page.goto(`/bot/book/${SEED.psychologistA}`);
        const body = page.locator('body');
        // Тот же актуальный интерфейс записи, а не 404 и не заглушка.
        await expect(body).toContainText('Когда вам удобнее?');
        await expect(body).toContainText('Мария');
        await expect(body).not.toContainText('404');
    });
});

// ──────────────── §21 Импортированная сессия молчит по умолчанию ───────────

test.describe('§21 импорт молчит', () => {
    test('перенесённая встреча не порождает ни сообщения, ни напоминания', async ({ page }) => {
        await signIn(page, SEED.sessionA);

        const marker = `Импорт Молчание ${Date.now()}`;
        // Далеко вперёд и в необычный час: ближайшие дни у засеянной практики
        // заняты, и встреча честно отбивается как SESSION_CONFLICT — проверять
        // надо тишину после успешного переноса, а не отказ.
        const date = new Date(Date.now() + 45 * 24 * 3600 * 1000).toISOString().slice(0, 10);

        const apply = await page.request.post('/api/diary/clients/import-spreadsheet/apply', {
            data: {
                mode: 'spreadsheet',
                items: [{
                    clientMode: 'new',
                    name: marker,
                    date,
                    startTime: '07:15',
                    endTime: '08:05',
                    duration: 50,
                    format: 'online',
                }],
            },
        });
        expect(apply.ok(), 'приём импорта прошёл').toBeTruthy();
        const result = await apply.json();
        expect(result.imported, 'встреча действительно перенесена').toBeGreaterThan(0);

        const client = await db.diaryClient.findFirst({
            where: { name: marker },
            select: { id: true },
        });
        expect(client, 'клиент импорта найден в базе').not.toBeNull();

        const sessions = await db.diarySession.findMany({
            where: { clientId: client!.id },
            select: { id: true, origin: true },
        });
        expect(sessions.length, 'сессия импорта создана').toBeGreaterThan(0);
        const sessionIds = sessions.map((s) => s.id);

        // Наблюдаемое следствие, а не значение поля: очередь сообщений пуста.
        const messages = await db.scheduledClientMessage.count({
            where: { OR: [{ clientId: client!.id }, { sessionId: { in: sessionIds } }] },
        });
        expect(messages, 'ни одного запланированного сообщения клиенту').toBe(0);

        const reminders = await db.reminderOutbox.count({
            where: { sessionId: { in: sessionIds } },
        });
        expect(reminders, 'ни одного напоминания за 24ч и за 1ч').toBe(0);

        // И сам импортированный клиент не получил канала, в который можно
        // было бы написать: перенос из таблицы не привязывает мессенджер.
        const bound = await db.diaryClient.findUnique({
            where: { id: client!.id },
            select: { telegramChatId: true, maxChatId: true },
        });
        expect(bound?.telegramChatId ?? null, 'Telegram не привязан импортом').toBeNull();
        expect(bound?.maxChatId ?? null, 'MAX не привязан импортом').toBeNull();
    });
});

// ─────────────────────────── §22 Напоминания ───────────────────────────────

test.describe('§22 напоминания', () => {
    test('выключенное напоминание не попадает в очередь', async () => {
        // Продукт заводит настройки лениво, поэтому у свежего посева строки
        // может не быть — берём её через upsert, как это делает само
        // приложение при первом обращении к настройкам.
        const settings = await db.notificationSettings.upsert({
            where: { psychologistId: SEED.psychologistA },
            create: { psychologistId: SEED.psychologistA },
            update: {},
            select: { clientReminder25hEnabled: true, clientReminder1hEnabled: true },
        });
        expect(settings.clientReminder25hEnabled, 'по умолчанию напоминание за сутки включено').toBe(true);

        // Выключаем оба клиентских напоминания и смотрим на очередь.
        await db.notificationSettings.update({
            where: { psychologistId: SEED.psychologistA },
            data: { clientReminder25hEnabled: false, clientReminder1hEnabled: false },
        });

        const clientReminders = await db.reminderOutbox.count({
            where: { type: { in: ['session_24h_client', 'session_1h_client'] }, status: 'pending' },
        });
        expect(clientReminders, 'при выключенных тумблерах клиентских напоминаний в очереди нет').toBe(0);

        // Возвращаем как было: приёмка не должна оставлять стенд изменённым.
        await db.notificationSettings.update({
            where: { psychologistId: SEED.psychologistA },
            data: {
                clientReminder25hEnabled: settings.clientReminder25hEnabled,
                clientReminder1hEnabled: settings.clientReminder1hEnabled,
            },
        });
    });

    test('функциональность специалиста от этого не пропала', async ({ page }) => {
        await signIn(page, SEED.sessionA);
        await page.goto('/diary/settings');
        // Экран настроек открылся и остался рабочим.
        await expect(page.locator('body')).not.toContainText('Application error');
    });
});

// ───────────────────────────── §23 Флаги ───────────────────────────────────

test.describe('§23 флаги запуска', () => {
    test('оба флага отсутствуют или выключены', async () => {
        for (const flag of ['PRACTICE_WEEKLY_FOLLOWUP_ENABLED', 'PRACTICE_WAITLIST_AUTO_NOTIFY_ENABLED']) {
            const value = process.env[flag];
            expect(value === undefined || value === '' || value === 'false', `${flag} = ${value ?? 'отсутствует'}`).toBeTruthy();
        }
    });
});

// ──────────────────────────── §24 Безопасность ─────────────────────────────

test.describe('§24 чужое', () => {
    test('специалист A не читает и не меняет сессию специалиста B', async ({ page }) => {
        await signIn(page, SEED.sessionA);
        const foreign = await db.diarySession.findFirst({
            where: { psychologistId: SEED.psychologistB },
            select: { id: true },
        });
        expect(foreign, 'у второго специалиста есть сессия').not.toBeNull();

        // Веб-контур: тот же cookie, что у настоящего специалиста A.
        const read = await page.request.get(`/api/diary/sessions/${foreign!.id}/payment`);
        expect([401, 403, 404], `чтение чужой сессии отвергнуто (получено ${read.status()})`).toContain(read.status());

        const before = await db.diarySession.findUnique({ where: { id: foreign!.id }, select: { status: true, notes: true } });
        const write = await page.request.patch(`/api/diary/sessions/${foreign!.id}/payment`, {
            data: { paymentStatus: 'paid' },
        });
        expect([401, 403, 404], `изменение чужой сессии отвергнуто (получено ${write.status()})`).toContain(write.status());
        const after = await db.diarySession.findUnique({ where: { id: foreign!.id }, select: { status: true, notes: true } });
        expect(after, 'чужая сессия не изменилась').toEqual(before);
    });

    test('чужой кабинет нельзя подставить в свою сессию', async ({ page }) => {
        await signIn(page, SEED.sessionA);
        const foreignAddress = await db.psychologistAddress.findFirst({
            where: { psychologistId: SEED.psychologistB },
            select: { id: true },
        });
        if (!foreignAddress) {
            test.skip(true, 'у второго специалиста нет кабинета — проверка требует посева');
            return;
        }
        // Импорт — ближайший путь, где кабинет приходит идентификатором извне.
        const res = await page.request.post('/api/diary/clients/import-spreadsheet/apply', {
            data: {
                mode: 'spreadsheet',
                items: [{
                    clientMode: 'new',
                    name: `Чужой Кабинет ${Date.now()}`,
                    date: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10),
                    startTime: '10:00',
                    endTime: '10:50',
                    duration: 50,
                    format: 'offline',
                    addressId: foreignAddress.id,
                }],
            },
        });
        const body = res.ok() ? await res.json() : null;
        const imported = body?.imported ?? 0;
        expect(imported, `встреча с чужим кабинетом не создана (imported=${imported})`).toBe(0);
        const leaked = await db.diarySession.count({ where: { psychologistId: SEED.psychologistA, addressId: foreignAddress.id } });
        expect(leaked, 'чужой кабинет не попал ни в одну сессию специалиста A').toBe(0);
    });

    test('подделанный токен переноса отвергнут', async ({ page }) => {
        const tampered = `${TOKENS.rescheduleToken.slice(0, -4)}beef`;
        await page.goto(`/client/reschedule/${TOKENS.rescheduleSessionId}?t=${tampered}`);
        await page.waitForTimeout(1500);
        const body = await page.locator('body').innerText();
        expect(
            /недействительн|устарел|не найден|ссылк/i.test(body),
            'подделанная подпись не даёт открыть перенос',
        ).toBeTruthy();
        expect(body.toLowerCase(), 'и время встречи по ней не показывается').not.toContain('выберите новое время');
    });

    test('подделанная персональная ссылка клиента отвергнута', async ({ page }) => {
        const tampered = `${TOKENS.knownClientToken.slice(0, -4)}beef`;
        await page.goto(`/bot/client?token=${tampered}`);
        const body = await page.locator('body').innerText();
        expect(
            !/Анастасия Владимировна Ковалевская/.test(body),
            'по подделанной ссылке чужие записи не показываются',
        ).toBeTruthy();
    });
});

// ───────────────────────────── §25 Юридический барьер ──────────────────────

test.describe('§25 юридический барьер', () => {
    test('новый специалист без принятых документов внутрь не проходит', async ({ browser }) => {
        const userId = `t28-fresh-${Date.now()}`;
        const sessionToken = `t28-fresh-session-${Date.now()}`;

        await db.user.create({
            data: {
                id: userId,
                email: `${userId}@task28.invalid`,
                name: 'Новый Специалист',
                role: 'PSYCHOLOGIST',
            },
        });
        await db.session.create({
            data: {
                sessionToken,
                userId,
                expires: new Date(Date.now() + 24 * 3600 * 1000),
            },
        });

        try {
            const ctx = await browser.newContext();
            const page = await ctx.newPage();
            await signIn(page, sessionToken);
            await page.goto('/diary');
            const blocked = await page.locator('body').innerText();
            expect(
                /Мы обновили правила|принять|соглашени/i.test(blocked),
                'барьер держит: продукт не открылся до принятия документов',
            ).toBeTruthy();

            // Принимаем ровно то, что требует барьер, — и продукт открывается.
            const docs = await db.legalDocument.findMany({
                where: { isActive: true, NOT: { type: 'MARKETING' } },
                select: { id: true, type: true, version: true, code: true },
            });
            expect(docs.length, 'обязательные документы существуют').toBeGreaterThan(0);
            for (const doc of docs) {
                await db.legalDocumentAcceptance.create({
                    data: {
                        userId,
                        documentId: doc.id,
                        acceptedAt: new Date(),
                        source: 'task28-acceptance',
                        documentType: doc.type,
                        documentVersion: doc.version,
                        documentCode: doc.code,
                    },
                });
            }

            await page.goto('/diary');
            const opened = await page.locator('body').innerText();
            expect(/Мы обновили правила/.test(opened), 'барьер снят').toBeFalsy();
            // Открылся рабочий кабинет: навигация продукта на месте. Проверять
            // приветствие здесь нельзя — у только что заведённого специалиста
            // ещё нет ни имени в профиле, ни расписания.
            expect(/Календарь/.test(opened) && /Клиенты/.test(opened), 'навигация кабинета видна').toBeTruthy();
            // Необязательный онбординг не подменяет собой продукт.
            expect(page.url()).toContain('/diary');
            expect(page.url()).not.toContain('/onboarding');
            await ctx.close();
        } finally {
            await db.legalDocumentAcceptance.deleteMany({ where: { userId } });
            await db.session.deleteMany({ where: { userId } });
            await db.user.delete({ where: { id: userId } }).catch(() => undefined);
        }
    });
});
