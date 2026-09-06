import fs from 'node:fs';
import path from 'node:path';
import { test, expect, signIn, SEED } from './fixtures';

/**
 * Задача 27, часть C: снимки всех MVP-поверхностей веба на трёх ширинах.
 *
 * Это не «проверено визуально» словами — это файлы, которые можно открыть и
 * посмотреть. Тест заодно ловит то, что на снимке не видно: горизонтальную
 * прокрутку страницы. Она означает, что содержимое не помещается по ширине,
 * и на телефоне это первое, обо что человек спотыкается.
 */

const OUT = process.env.E2E_SHOTS || 'artifacts/praktika-mvp/task27/web';

const SURFACES: Array<{ name: string; url: string; wait?: string }> = [
    { name: '01-dashboard', url: '/diary' },
    { name: '02-clients', url: '/diary/clients' },
    { name: '03-calendar', url: '/diary/calendar' },
    { name: '04-availability', url: '/diary/availability' },
    { name: '05-notes', url: '/diary/notes' },
    { name: '06-session-notes', url: `/diary/session/${SEED.sessionPastNoNote}/notes` },
    { name: '07-import-source', url: '/diary/clients/import' },
    { name: '08-import-calendar', url: '/diary/clients/import-calendar' },
    { name: '09-import-spreadsheet', url: '/diary/clients/import-spreadsheet' },
    { name: '10-integrations', url: '/diary/integrations' },
    { name: '11-settings', url: '/diary/settings' },
    { name: '12-documents', url: '/diary/documents' },
    { name: '13-notifications', url: '/diary/notifications' },
    { name: '14-profile', url: '/diary/profile' },
];

test.describe('снимки веб-поверхностей', () => {
    for (const surface of SURFACES) {
        test(`${surface.name}`, async ({ page }, testInfo) => {
            await signIn(page, SEED.sessionA);
            await page.goto(surface.url, { waitUntil: 'networkidle' });
            await page.waitForTimeout(600);

            const dir = path.join(OUT, testInfo.project.name);
            fs.mkdirSync(dir, { recursive: true });
            await page.screenshot({ path: path.join(dir, `${surface.name}.png`), fullPage: true });

            // Горизонтальной прокрутки быть не должно ни на одной ширине.
            const overflow = await page.evaluate(() =>
                document.documentElement.scrollWidth - document.documentElement.clientWidth);
            expect(overflow, `${surface.url}: страница шире экрана на ${overflow}px`).toBeLessThanOrEqual(1);
        });
    }
});
