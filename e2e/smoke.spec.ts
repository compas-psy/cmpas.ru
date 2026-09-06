import { test, expect, signIn, SEED } from './fixtures';

test('кабинет открывается со своей практикой', async ({ page }) => {
    await signIn(page, SEED.sessionA);
    await page.goto('/diary');
    await expect(page.locator('body')).toContainText('Мария');
});
