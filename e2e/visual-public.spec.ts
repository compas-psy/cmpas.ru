import fs from 'node:fs';
import path from 'node:path';
import { test, expect, SEED } from './fixtures';

/**
 * Задача 27, часть C: клиентские поверхности.
 *
 * Отдельным прогоном, потому что у них другой зритель. Специалист простит
 * плотный экран — он тут работает. Человек, который впервые открыл ссылку
 * психолога, не простит ничего: он не знает продукта, не обязан разбираться
 * и уходит молча.
 */

const OUT = process.env.E2E_SHOTS_PUBLIC || 'artifacts/praktika-mvp/task27/public-booking';

test.describe('снимки клиентских поверхностей', () => {
    test('01-booking-landing', async ({ page }, testInfo) => {
        await page.goto(`/u/${SEED.slug}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(900);
        const dir = path.join(OUT, testInfo.project.name);
        fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, '01-booking-landing.png'), fullPage: true });

        // Сразу видно, к кому записываешься.
        await expect(page.locator('body')).toContainText('Мария');

        const overflow = await page.evaluate(() =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `страница шире экрана на ${overflow}px`).toBeLessThanOrEqual(1);
    });

    test('02-booking-no-technical-terms', async ({ page }) => {
        await page.goto(`/u/${SEED.slug}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(900);
        const text = (await page.locator('body').innerText()).toLowerCase();

        // Клиентский экран — не техническая форма.
        for (const term of ['slot', 'psychologistid', 'sessionid', 'clientid', 'prisma',
                            'undefined', 'null', 'error:', 'unauthorized', '_token']) {
            expect(text, `на клиентском экране встретилось «${term}»`).not.toContain(term);
        }
    });
});
