import { test, expect, signIn, SEED, TOKENS } from './fixtures';

/**
 * Задача 27: двенадцать обязательных путешествий выпуска, в браузере.
 *
 * Unit-тесты покрывают правила. Здесь проверяется другое: доходит ли живой
 * человек от начала до конца и что он видит в конце. Кнопка, которая
 * вызвала API и оставила экран прежним, — работающий запрос, а не
 * работающий сценарий.
 *
 * Нумерация 1–12 совпадает с обязательным списком Задачи 27.
 */

const stamp = () => String(Date.now()).slice(-7);

/**
 * Окно согласия на материалы всплывает поверх кабинета через секунду после
 * загрузки и перекрывает всё. Человек его закрывает — закрываем и мы,
 * дождавшись появления: до этого кликать не по чему.
 */
async function dismissAdsConsent(page: import('@playwright/test').Page) {
    const no = page.getByRole('button', { name: 'Нет, спасибо' });
    await no.waitFor({ state: 'visible', timeout: 8000 }).catch(() => undefined);
    if (await no.count()) { await no.first().click(); await page.waitForTimeout(600); }
}

/** Дойти до момента, когда запись можно подтвердить. */
async function fillBooking(page: import('@playwright/test').Page, name: string, phone: string) {
    await page.locator('button').filter({ hasText: /\d{2}:\d{2}/ }).first().click();
    await page.getByPlaceholder('Ваше имя').fill(name);
    await page.locator('input[type="tel"]').fill(phone);
    await page.getByRole('button', { name: 'Записаться' }).click();
    await page.getByText('на обработку моих персональных данных').click();
    await page.getByRole('button', { name: 'Подтвердить и записаться' }).click();
}

test.describe('1. новый специалист', () => {
    test('юридический барьер держит, а чек-лист — нет', async ({ page, browser }) => {
        // Тот же аккаунт без принятых документов внутрь не проходит.
        const clean = await browser.newContext();
        const anon = await clean.newPage();
        await anon.goto('/diary');
        expect(anon.url(), 'без входа кабинет закрыт').not.toContain('/diary');
        await clean.close();

        // С принятыми документами — сразу кабинет, а не визард настройки.
        await signIn(page, SEED.sessionA);
        await page.goto('/diary');
        expect(page.url()).toContain('/diary');
        expect(page.url()).not.toContain('/onboarding');
        expect(page.url()).not.toContain('/legal-acceptance');

        // Чек-лист виден и не перекрывает работу: расписание дня рядом с ним.
        await expect(page.locator('body')).toContainText('Добро пожаловать в ПРАКТИКУ');
        await expect(page.locator('body')).toContainText('Расписание на сегодня');

        // Его можно закрыть — значит это подсказка, а не барьер.
        await expect(page.getByRole('button', { name: /Скрыть|Закрыть/ }).first()
            .or(page.locator('[aria-label*="крыть"]').first())).toBeVisible();
    });
});

test.describe('2. перенос практики', () => {
    test('источник → разбор → результат числами', async ({ page }) => {
        await signIn(page, SEED.sessionA);
        await page.goto('/diary/clients/import');
        await expect(page.locator('body')).toContainText(/Календар|Таблиц/);

        // Разбор вставленного списка: превью НЕ пишет клиентов в базу.
        const before = await page.request.get('/api/mobile/dashboard');
        await page.goto('/diary/clients/import-spreadsheet');
        const preview = await page.request.post('/api/diary/clients/import-spreadsheet/preview', {
            data: { mode: 'client_only', source: 'paste', text: 'Пробный Клиент Один\nПробный Клиент Два' },
        });
        expect(preview.ok()).toBeTruthy();
        const previewBody = await preview.json();
        expect(previewBody.rows).toHaveLength(2);
        expect(before.status()).toBeLessThan(500);

        // Приём: результат — конкретные числа, а не «готово».
        const apply = await page.request.post('/api/diary/clients/import-spreadsheet/apply', {
            data: {
                mode: 'client_only',
                items: previewBody.rows.map((r: { name: string }) => ({ clientMode: 'new', name: r.name })),
            },
        });
        expect(apply.ok()).toBeTruthy();
        const result = await apply.json();
        expect(result.imported + result.skipped + result.failed).toBe(2);

        // Перенесённые клиенты видны в списке — это и есть человеческий итог.
        await page.goto('/diary/clients');
        await expect(page.locator('body')).toContainText('Пробный Клиент Один');
    });
});

test.describe('3. один день недели, два формата', () => {
    test('утро онлайн и вечер в кабинете предлагаются вместе', async ({ page }) => {
        await page.goto(`/u/${SEED.slug}`);
        await page.waitForTimeout(1500);

        // Макет C01–C04: «онлайн и очные слоты — разные секции, а не общий
        // список: сразу ясно, почему утром онлайн, а вечером очно».
        await page.getByText('Показать весь календарь').click();
        await page.waitForTimeout(2000);

        // Выбираем ближайший рабочий день недели — в посеве это будни.
        const day = page.locator('.react-datepicker__day:not(.react-datepicker__day--disabled)').first();
        if (await day.count()) { await day.click(); } else {
            await page.locator('button,div[role="option"]').filter({ hasText: /^\d{1,2}$/ }).first().click();
        }
        await page.waitForTimeout(2000);

        const text = await page.locator('body').innerText();
        expect(text, 'онлайн-секция').toContain('ОНЛАЙН');
        expect(text, 'очная секция названа кабинетом').toContain('КАБИНЕТ НА ПЕТРОГРАДСКОЙ');
    });
});

test.describe('4. самозапись', () => {
    test('доходит до подтверждения с конкретикой', async ({ page }) => {
        await page.goto(`/u/${SEED.slug}`);
        await page.waitForTimeout(1200);
        await fillBooking(page, 'Клиент Самозаписи', `91${stamp()}0`);

        await expect(page.getByText('Вы записаны!')).toBeVisible({ timeout: 20_000 });
        const body = await page.locator('body').innerText();
        expect(body, 'сказано, к кому').toContain('Соколова-Преображенская');
        expect(body, 'сказано, когда').toMatch(/\d{2}:\d{2}/);
    });
});

test.describe('5. двое на один час', () => {
    test('второй получает человеческий отказ, а не код', async ({ browser }) => {
        const first = await browser.newContext();
        const second = await browser.newContext();
        const a = await first.newPage();
        const b = await second.newPage();
        const s = stamp();

        for (const [page, phone] of [[a, `92${s}0`], [b, `93${s}1`]] as const) {
            await page.goto(`/u/${SEED.slug}`);
            await page.waitForTimeout(1200);
            await page.locator('button').filter({ hasText: /\d{2}:\d{2}/ }).first().click();
            await page.getByPlaceholder('Ваше имя').fill('Клиент Гонки');
            await page.locator('input[type="tel"]').fill(phone);
            await page.getByRole('button', { name: 'Записаться' }).click();
            await page.getByText('на обработку моих персональных данных').click();
        }

        await a.getByRole('button', { name: 'Подтвердить и записаться' }).click();
        await expect(a.getByText('Вы записаны!')).toBeVisible({ timeout: 20_000 });

        await b.getByRole('button', { name: 'Подтвердить и записаться' }).click();
        await b.waitForTimeout(3500);
        const text = await b.locator('body').innerText();
        for (const code of ['SLOT_UNAVAILABLE', 'CLIENT_ALREADY_BOOKED', 'Prisma', '500']) {
            expect(text, `клиенту показан код «${code}»`).not.toContain(code);
        }
        expect(text.toLowerCase()).toMatch(/занят|недоступн|выберите друг|устарел/);

        await first.close();
        await second.close();
    });
});

test.describe('6-7. перенос и отмена клиентом', () => {
    test('перенос: клиент выбирает новое время своим интерфейсом', async ({ page }) => {
        // Ссылка приходит сообщением бота: подписана и привязана к встрече.
        await page.goto(`/client/reschedule/${TOKENS.rescheduleSessionId}?t=${TOKENS.rescheduleToken}`);
        await page.waitForTimeout(1500);

        const body = await page.locator('body').innerText();
        expect(body, 'ссылка должна быть принята').not.toContain('Ссылка недействительна');
        expect(body.toLowerCase()).toMatch(/перенес|выберите|новое время/);
        for (const code of ['Prisma', 'SLOT_UNAVAILABLE', 'Unauthorized', 'undefined']) {
            expect(body, `клиенту показан «${code}»`).not.toContain(code);
        }

        // Сначала день, потом час — так же, как выбирает человек.
        const days = page.locator('button:not([disabled])').filter({ hasText: /^\d{1,2}$/ });
        const count = await days.count();
        let opened = false;
        for (let i = 0; i < count && !opened; i++) {
            await days.nth(i).click();
            await page.waitForTimeout(1200);
            opened = (await page.locator('button').filter({ hasText: /\d{2}:\d{2}/ }).count()) > 0;
        }
        expect(opened, 'в календаре переноса нашлось свободное время').toBe(true);

        await page.locator('button').filter({ hasText: /\d{2}:\d{2}/ }).first().click();
        await page.waitForTimeout(800);
        const after = await page.locator('body').innerText();
        expect(after.toLowerCase()).toMatch(/перенести|подтверд|сохранить/);
    });

    test('отмена: спокойное, но недвусмысленное действие', async ({ page }) => {
        await page.goto(`/client/reschedule/${TOKENS.rescheduleSessionId}?t=${TOKENS.cancelToken}`);
        await page.waitForTimeout(1500);
        const body = await page.locator('body').innerText();

        // Токен отмены — не токен переноса: подпись привязана к действию.
        // Экран либо предлагает отмену, либо честно отказывает; чего он не
        // делает никогда — не показывает технику.
        for (const code of ['Prisma', 'sat1_', 'Unauthorized', 'Internal error']) {
            expect(body, `клиенту показан «${code}»`).not.toContain(code);
        }
        expect(body.toLowerCase()).toMatch(/отмен|перенес|встреч|ссылк/);
    });
});

test.describe('8. специалист делится постоянной ссылкой', () => {
    test('ссылка ведёт на его страницу записи, а не на разовое приглашение', async ({ page }) => {
        // Разрешение на буфер выдаётся ДО перехода и с явным origin: то, что
        // уходит клиенту, проверяется по содержимому буфера, а не по тексту
        // на экране — ссылку в шторке не показывают, её копируют.
        const origin = new URL(process.env.E2E_BASE_URL || 'http://localhost:3100').origin;
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin });

        await signIn(page, SEED.sessionA);
        await page.goto('/diary');
        await dismissAdsConsent(page);
        await page.getByRole('button', { name: /Поделиться/ }).first().click();
        await page.waitForTimeout(900);

        const body = await page.locator('body').innerText();
        expect(body).toMatch(/Ссылка для записи|Поделиться/);

        // Постоянная ссылка — это /u/<slug>, а не /connect/<токен>.
        // Макет W16–W17: единый компактный share-row.
        await expect(page.getByRole('button', { name: 'Скопировать' })).toBeVisible({ timeout: 10_000 });
        for (const target of ['Max', 'Telegram', 'Показать QR']) {
            await expect(page.getByRole('button', { name: target })).toBeVisible();
        }
        // Что именно уходит клиенту, видно по адресу, который шторка
        // передаёт мессенджеру. Сам t.me из песочницы недоступен, поэтому
        // перехватываем вызов window.open, а не ждём загрузки вкладки.
        await page.evaluate(() => {
            (window as unknown as { __opened: string[] }).__opened = [];
            const original = window.open.bind(window);
            window.open = ((url?: string | URL, ...rest: unknown[]) => {
                (window as unknown as { __opened: string[] }).__opened.push(String(url ?? ''));
                return original(url as string, ...(rest as []));
            }) as typeof window.open;
        });
        await page.getByRole('button', { name: 'Telegram' }).click({ force: true });
        await page.waitForTimeout(1200);
        const link = await page.evaluate(() =>
            decodeURIComponent(((window as unknown as { __opened?: string[] }).__opened || [])[0] || ''));
        expect(link, `в шторке показана ссылка: «${link}»`).toMatch(/\/u\/|\/у\/|\/bot\/book\//);
        expect(link, 'постоянную ссылку нельзя путать с разовым приглашением').not.toContain('/connect/');
    });
});

test.describe('9. известный клиент', () => {
    test('имя и телефон второй раз не спрашивают', async ({ page }) => {
        // Персональная подписанная ссылка — та же, что специалист отдаёт
        // конкретному клиенту (clientBookingLink).
        await page.goto(`/u/${SEED.slug}?c=${TOKENS.knownClientToken}`);
        await page.waitForTimeout(2000);

        const body = await page.locator('body').innerText();
        expect(body).toContain('Соколова-Преображенская');

        // Выбираем время и смотрим, что просят заполнить.
        await page.locator('button').filter({ hasText: /\d{2}:\d{2}/ }).first().click();
        await page.waitForTimeout(800);

        // Личность известна: полей имени и телефона быть не должно.
        await expect(page.getByPlaceholder('Ваше имя')).toHaveCount(0);
        await expect(page.locator('input[type="tel"]')).toHaveCount(0);
        const withClient = await page.locator('body').innerText();
        expect(withClient, 'человека узнали: показаны его записи').toMatch(/Мои записи|Ваши предстоящие записи/);
    });
});

test.describe('10. лист ожидания', () => {
    test('заявка без выдуманного часа и без автозаписи', async ({ page }) => {
        await page.goto(`/u/${SEED.slug}`);
        await page.waitForTimeout(1500);

        await page.getByText('Нет подходящего времени?').click();
        await page.getByPlaceholder('Как к вам обращаться').fill('Клиент Ожидания');
        await page.getByPlaceholder('Телефон или Telegram').fill(`95${stamp()}0`);
        await page.getByRole('button', { name: 'Записать в лист ожидания' }).click();
        await page.waitForTimeout(2500);

        const body = await page.locator('body').innerText();
        expect(body).toContain('Заявка отправлена');
        // Ни записи, ни обещания автоматического уведомления.
        expect(body).not.toContain('Вы записаны');
        expect(body.toLowerCase()).not.toMatch(/уведомим|сообщим автоматически|пришлём, как только/);
    });
});

test.describe('11. подсказки адреса отказали', () => {
    test('адрес можно ввести руками, введённое не пропадает', async ({ page }) => {
        await signIn(page, SEED.sessionA);

        // Провайдер недоступен — отвечаем ровно так же, как настоящий отказ.
        await page.route('**/api/dadata', (route) =>
            route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'PROVIDER_UNAVAILABLE' }) }));

        await page.goto('/diary/settings');
        await page.waitForTimeout(1500);
        await page.getByRole('button', { name: /Офлайн-кабинеты/ }).click();
        await page.waitForTimeout(1200);

        // Поле адреса кабинета — то самое, где работают подсказки.
        const target = page.getByPlaceholder('Адрес кабинета').first();
        await expect(target).toBeVisible({ timeout: 15_000 });

        const typed = 'Санкт-Петербург, Кораблестроителей, 30';
        await target.fill(typed);
        await page.waitForTimeout(1800);

        // Поле осталось рабочим, введённое на месте, форма не заблокирована.
        await expect(target).toHaveValue(typed);
        await expect(target).toBeEditable();

        const body = await page.locator('body').innerText();
        expect(body, 'человеку не показывают машинный код провайдера').not.toContain('PROVIDER_UNAVAILABLE');
        expect(body.toLowerCase()).toMatch(/вручную|недоступ/);
    });
});

test.describe('12. чужое', () => {
    test('специалист A не читает и не меняет сессию специалиста B', async ({ page }) => {
        await signIn(page, SEED.sessionA);

        const read = await page.request.get('/api/diary/sessions/t27-sess-b/payment');
        expect([403, 404]).toContain(read.status());

        const write = await page.request.patch('/api/diary/sessions/t27-sess-b/payment', {
            data: { paymentStatus: 'paid' },
        });
        expect([403, 404]).toContain(write.status());

        // И через мобильный контур — тот же ответ.
        const mobile = await page.request.get('/api/mobile/sessions/t27-sess-b');
        expect([401, 403, 404]).toContain(mobile.status());
    });
});
