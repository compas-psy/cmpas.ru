import { test, expect, signIn, SEED } from './fixtures';

/**
 * Задача 27, часть A.2: критические сценарии выпуска.
 *
 * Проверяется не «ручка ответила 200», а то, что человек видит на экране
 * после действия. Кнопка, которая вызвала API и оставила экран прежним, —
 * это не работающий сценарий, а работающий запрос.
 */

test.describe('специалист', () => {
    test('кабинет открыт, а чек-лист настройки — подсказка, а не барьер', async ({ page }) => {
        await signIn(page, SEED.sessionA);
        await page.goto('/diary');

        // Кабинет, а не визард: сегодняшние встречи видны сразу.
        await expect(page.locator('body')).toContainText('Расписание на сегодня');
        await expect(page.locator('body')).toContainText(SEED.clientLongName);
        // К человеку обращаются по имени, а не по фамилии (Задача 27).
        await expect(page.locator('body')).toContainText('Добрый день, Мария');

        // Чек-лист присутствует и не перекрывает работу.
        await expect(page.locator('body')).toContainText('Добро пожаловать в ПРАКТИКУ');
        expect(page.url()).toContain('/diary');
        expect(page.url()).not.toContain('/onboarding');
    });

    test('«Требует внимания» ведёт к проблеме, а не «куда-нибудь»', async ({ page }) => {
        await signIn(page, SEED.sessionA);
        await page.goto('/diary');
        const body = page.locator('body');
        await expect(body).toContainText('Требует внимания');
        await expect(body).toContainText('нет согласия на обработку данных');
        // Пункт называет проблему словами, а не кодом.
        await expect(body).not.toContainText('session_without_notes');
        await expect(body).not.toContainText('client_without_consent');
    });

    test('заметка по сессии сохраняется и закрывает пункт внимания', async ({ page }) => {
        await signIn(page, SEED.sessionA);
        await page.goto(`/diary/session/${SEED.sessionPastNoNote}/notes`);
        await page.getByPlaceholder('Что было самым важным в этой сессии?').fill('Проверка выпуска: заметка сохранена.');
        await page.getByRole('button', { name: 'Сохранить' }).first().click();
        await page.waitForTimeout(1500);

        await page.goto('/diary');
        await expect(page.locator('body')).not.toContainText('нет заметки по сессии');
    });
});

test.describe('клиент записывается сам', () => {
    test('сразу видно, к кому записываешься, и оба формата дня доступны', async ({ page }) => {
        await page.goto(`/u/${SEED.slug}`);
        // Имя специалиста видно сразу. Порядок слов берётся из профиля
        // («Фамилия и Имя»), поэтому проверяется наличие, а не порядок.
        await expect(page.locator('body')).toContainText('Соколова-Преображенская');
        await expect(page.locator('body')).toContainText('Мария');

        // Задача 6: в один и тот же день недели работают онлайн-утро и очный
        // вечер. Предложения показывают утро, полный календарь — весь день.
        await expect(page.locator('body')).toContainText('Онлайн');
        await page.getByText('Показать весь календарь').click();
        await page.waitForTimeout(1500);
        // Календарь открылся: появились дни месяца.
        await expect(page.locator('body')).toContainText(/сентябр|октябр/);
    });

    test('запись доходит до подтверждения и не обещает мессенджер без канала', async ({ page }) => {
        await page.goto(`/u/${SEED.slug}`);
        await page.waitForTimeout(1200);

        await page.locator('button').filter({ hasText: /\d{2}:\d{2}/ }).first().click();
        // Каждый прогон — новый человек: иначе вторая запись того же клиента
        // на тот же день упрётся в правило «одна встреча в день» и тест начнёт
        // падать на своём же следе, а не на продукте.
        const suffix = String(Date.now()).slice(-7);
        await page.getByPlaceholder('Ваше имя').fill('Клиент Проверки');
        await page.locator('input[type="tel"]').fill(suffix.padStart(10, '9'));
        await page.getByRole('button', { name: 'Записаться' }).click();

        // Согласие на обработку данных спрашивают отдельно и до записи —
        // молча за человека его не проставляют.
        const consent = page.getByText('Согласие на обработку ПДн');
        await expect(consent).toBeVisible({ timeout: 10_000 });
        await expect(page.getByRole('button', { name: 'Подтвердить и записаться' })).toBeDisabled();
        await page.getByText('на обработку моих персональных данных').click();
        await page.getByRole('button', { name: 'Подтвердить и записаться' }).click();

        await expect(page.getByText('Вы записаны!')).toBeVisible({ timeout: 20_000 });
        const body = await page.locator('body').innerText();
        expect(body, 'без привязанного канала мессенджер обещать нельзя').not.toContain('Уведомление придёт в Max');
        expect(body).toContain('Соколова-Преображенская');
    });
});

test.describe('чужое трогать нельзя', () => {
    test('специалист A не видит и не меняет сессию специалиста B', async ({ page }) => {
        await signIn(page, SEED.sessionA);

        const read = await page.request.get('/api/diary/sessions/t27-sess-b/payment');
        expect([403, 404]).toContain(read.status());

        const write = await page.request.patch('/api/diary/sessions/t27-sess-b/payment', {
            data: { paymentStatus: 'paid' },
        });
        expect([403, 404]).toContain(write.status());
    });
});

test.describe('двое на один час', () => {
    test('второй получает человеческий отказ, а не код ошибки', async ({ browser }) => {
        // Оба открыли страницу до того, как кто-то записался: у обоих на
        // экране один и тот же свободный час.
        const first = await browser.newContext();
        const second = await browser.newContext();
        const a = await first.newPage();
        const b = await second.newPage();

        const openAndFill = async (page: typeof a, phone: string) => {
            await page.goto(`/u/${SEED.slug}`);
            await page.waitForTimeout(1200);
            await page.locator('button').filter({ hasText: /\d{2}:\d{2}/ }).first().click();
            await page.getByPlaceholder('Ваше имя').fill('Клиент Гонки');
            await page.locator('input[type="tel"]').fill(phone);
            await page.getByRole('button', { name: 'Записаться' }).click();
            await page.getByText('на обработку моих персональных данных').click();
        };

        const stamp = String(Date.now()).slice(-6);
        await openAndFill(a, `98${stamp}00`);
        await openAndFill(b, `97${stamp}11`);

        await a.getByRole('button', { name: 'Подтвердить и записаться' }).click();
        await expect(a.getByText('Вы записаны!')).toBeVisible({ timeout: 20_000 });

        await b.getByRole('button', { name: 'Подтвердить и записаться' }).click();
        await b.waitForTimeout(4000);

        const text = await b.locator('body').innerText();
        // Час занят — это нормальная жизнь, а не сбой. Человеку об этом
        // говорят словами.
        expect(text, 'клиенту нельзя показывать машинный код').not.toContain('SLOT_UNAVAILABLE');
        expect(text).not.toContain('CLIENT_ALREADY_BOOKED');
        expect(text).not.toContain('500');
        expect(text).not.toContain('Prisma');
        expect(text.toLowerCase()).toMatch(/занят|выберите (другое )?врем|устарел|недоступн/);

        await first.close();
        await second.close();
    });
});
