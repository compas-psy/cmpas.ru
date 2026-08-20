/**
 * Авторизация API-маршрутов панели (ТЗ §2, приёмка §9).
 *
 * Layout закрывает страницы, но route handler живёт вне дерева layout'ов.
 * Поэтому роль проверяется на КАЖДОМ запросе — и это проверяется здесь для
 * каждого маршрута, а не для одного показательного.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();

vi.mock('@/auth', () => ({ auth: () => authMock() }));
vi.mock('next/cache', () => ({
    revalidateTag: vi.fn(),
    unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

/**
 * Маршруты перечислены статически: динамический импорт по шаблону сборщик
 * разрешить не может, а пропущенный маршрут тихо выпал бы из проверки.
 */
const ROUTES = {
    morning: () => import('../../../app/api/admin/panel/morning/route'),
    money: () => import('../../../app/api/admin/panel/money/route'),
    funnel: () => import('../../../app/api/admin/panel/funnel/route'),
    retention: () => import('../../../app/api/admin/panel/retention/route'),
    tech: () => import('../../../app/api/admin/panel/tech/route'),
    quality: () => import('../../../app/api/admin/panel/quality/route'),
    products: () => import('../../../app/api/admin/panel/products/route'),
} as const;

const SCREENS = Object.keys(ROUTES) as (keyof typeof ROUTES)[];

function routeFor(screen: keyof typeof ROUTES) {
    return ROUTES[screen]();
}

function request(): Request {
    return new Request('https://cmpas.ru/api/admin/panel/x');
}

describe('доступ к API панели', () => {
    beforeEach(() => {
        authMock.mockReset();
    });

    it.each(SCREENS)('%s: без сессии — 401', async (screen) => {
        authMock.mockResolvedValue(null);
        const route = await routeFor(screen);

        const get = await route.GET(request());
        expect(get.status).toBe(401);

        const post = await route.POST();
        expect(post.status).toBe(401);
    });

    it.each(SCREENS)('%s: сессия без роли администратора — 403', async (screen) => {
        authMock.mockResolvedValue({ user: { email: 'user@example.com', role: 'USER' } });
        const route = await routeFor(screen);

        const get = await route.GET(request());
        expect(get.status).toBe(403);

        const post = await route.POST();
        expect(post.status).toBe(403);
    });

    it.each(SCREENS)('%s: сессия без роли вовсе — 403, а не молчаливый пропуск', async (screen) => {
        authMock.mockResolvedValue({ user: { email: 'user@example.com' } });
        const route = await routeFor(screen);
        expect((await route.GET(request())).status).toBe(403);
    });

    it.each(SCREENS)('%s: администратор проходит проверку доступа', async (screen) => {
        authMock.mockResolvedValue({ user: { email: 'admin@example.com', role: 'ADMIN' } });
        const route = await routeFor(screen);

        // Базы в тесте нет, поэтому сборка экрана падает — но падает уже ПОСЛЕ
        // проверки доступа: 401/403 здесь быть не должно.
        const response = await route.GET(request());
        expect([200, 500]).toContain(response.status);
    });

    it('сессия SUPERADMIN тоже проходит', async () => {
        authMock.mockResolvedValue({ user: { email: 'root@example.com', role: 'SUPERADMIN' } });
        const route = await routeFor('morning');
        const response = await route.GET(request());
        expect([200, 500]).toContain(response.status);
    });

    it('POST сбрасывает кеш только своего экрана', async () => {
        authMock.mockResolvedValue({ user: { email: 'admin@example.com', role: 'ADMIN' } });
        const { revalidateTag } = await import('next/cache');
        (revalidateTag as unknown as ReturnType<typeof vi.fn>).mockClear();

        const route = await routeFor('money');
        await route.POST();

        expect(revalidateTag).toHaveBeenCalledWith('panel:money', 'max');
        expect(revalidateTag).toHaveBeenCalledTimes(1);
    });
});

describe('покрытие маршрутов', () => {
    it('проверены все экраны, у которых есть API-маршрут', async () => {
        const { DATA_SCREENS } = await import('../screens');
        expect(new Set(SCREENS)).toEqual(new Set(DATA_SCREENS.map((s) => s.key)));
    });
});
