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
        // Постоянная ссылка записи не показывается текстом — её копируют.
        // Чтобы прогон мог прочитать то, что действительно уходит клиенту,
        // буфер обмена разрешён заранее (Playwright требует это на уровне
        // контекста, выданное после перехода не действует).
        permissions: ['clipboard-read', 'clipboard-write'],
        timezoneId: 'Europe/Moscow',
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        // Браузер в этом окружении лежит рядом с проектом, а не там, где его
        // ищет Playwright по умолчанию. Путь можно переопределить снаружи.
        launchOptions: process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {},
    },
    projects: [
        // Двенадцать обязательных сценариев меняют состояние: принимают
        // документы, занимают часы, заводят клиентов. Прогонять их три раза
        // подряд по одной базе бессмысленно — второй проход видит мир,
        // изменённый первым, и падает не на дефекте, а на собственном следе.
        // Поэтому они идут ровно один раз и на самом тесном кадре (390×844):
        // что прошло там, пройдёт и шире.
        {
            name: 'journeys',
            testMatch: /(release-(journeys|paths)|task28-acceptance)\.spec\.ts/,
            use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } },
        },
        // Кадровые проверки только читают, поэтому их и гоняем на трёх ширинах.
        { name: 'desktop', testIgnore: /(release-(journeys|paths)|task28-acceptance)\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
        { name: 'laptop', testIgnore: /(release-(journeys|paths)|task28-acceptance)\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } },
        { name: 'mobile', testIgnore: /(release-(journeys|paths)|task28-acceptance)\.spec\.ts/, use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
    ],
});
