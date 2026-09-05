import { defineConfig, devices } from '@playwright/test';

/**
 * Задача 27: сквозные проверки выпуска ПРАКТИКИ.
 *
 * Тесты идут против ЗАПУЩЕННОГО приложения с настоящей базой — они проверяют
 * не то, что функция вызвалась, а то, что человек видит на экране после
 * действия. Поэтому здесь нет webServer: базу и сервер поднимает
 * e2e/README.md, и запускать это в обычном `npm test` нельзя.
 *
 * Базовый адрес и cookie сессий берутся из окружения, чтобы прогон не был
 * привязан к одной машине.
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    workers: 1,
    reporter: [['list']],
    timeout: 60_000,
    expect: { timeout: 10_000 },
    use: {
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:3100',
        locale: 'ru-RU',
        timezoneId: 'Europe/Moscow',
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        // Браузер в этом окружении лежит рядом с проектом, а не там, где его
        // ищет Playwright по умолчанию. Путь можно переопределить снаружи.
        launchOptions: process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {},
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
        { name: 'laptop', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } },
        { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
    ],
});
