// Задача 24: после обязательных документов человек попадает в кабинет.
//
// Барьер был один лишний. Пока PsychologistSettings.onboardingCompleted стоял
// в false, DiaryLayout целиком подменял /diary визардом /onboarding: принял
// документы — и всё равно не увидел кабинета, пока не прошёл настройку.
// Задача 24 говорит обратное: настройка практики — помощь, а не пропуск, и
// живёт она чек-листом на дашборде, который можно закрыть.
//
// Проверяется именно порядок барьеров: документы блокируют по-прежнему,
// а незавершённая настройка — уже нет. И новым барьером по completed из
// чек-листа старый не подменён: чек-лист не барьер вовсе.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const world = vi.hoisted(() => ({
    onboardingCompleted: false,
    needsAcceptance: [] as string[],
    trialEndsAt: new Date('2099-01-01T00:00:00.000Z'),
    pathname: '/diary',
}));

class RedirectError extends Error {
    constructor(public readonly target: string) {
        super(`redirect:${target}`);
    }
}

vi.mock('next/navigation', () => ({
    redirect: (target: string) => { throw new RedirectError(target); },
}));

// Layout спрашивает у заголовков, куда человек шёл, чтобы вернуть его
// туда после входа. Вне запроса headers() бросает — здесь запроса нет,
// поэтому подменяем. Значение важно только для одной проверки ниже:
// адрес назначения должен попасть в ссылку на вход.
vi.mock('next/headers', () => ({
    headers: async () => new Headers({ 'x-pathname': world.pathname }),
}));

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));

vi.mock('@/lib/db', () => ({
    db: {
        user: {
            findUnique: vi.fn(async () => ({
                id: 'psy-1',
                email: 'psy@example.com',
                trialEndsAt: world.trialEndsAt,
                subscriptionEndsAt: null,
                psychologistSettings: { onboardingCompleted: world.onboardingCompleted },
            })),
        },
    },
}));

vi.mock('@/app/legal/actions', () => ({
    checkUserAcceptance: vi.fn(async () => ({ success: true, needsAcceptance: world.needsAcceptance })),
}));

// Клиентские части каркаса к барьерам отношения не имеют.
vi.mock('../sidebar-nav', () => ({ SidebarNav: () => null }));
vi.mock('../mobile-sidebar', () => ({ MobileSidebar: ({ children }: { children: unknown }) => children }));
vi.mock('../bottom-tab-bar', () => ({ BottomTabBar: () => null }));
vi.mock('@/components/legal/AdsConsentWrapper', () => ({ AdsConsentWrapper: () => null }));
vi.mock('@/components/psidairy/TrialBanner', () => ({ TrialBanner: () => null }));
vi.mock('sonner', () => ({ Toaster: () => null }));

const DiaryLayout = (await import('../layout')).default;

/** Куда увёл layout, или null — если пустил в кабинет. */
async function redirectedTo(): Promise<string | null> {
    try {
        await DiaryLayout({ children: null });
        return null;
    } catch (error) {
        if (error instanceof RedirectError) return error.target;
        throw error;
    }
}

beforeEach(() => {
    world.onboardingCompleted = false;
    world.needsAcceptance = [];
    world.trialEndsAt = new Date('2099-01-01T00:00:00.000Z');
    world.pathname = '/diary';
    authMock.mockResolvedValue({ user: { id: 'psy-1', name: 'Илья', email: 'psy@example.com' } });
});

describe('барьеры на входе в кабинет', () => {
    it('документы приняты, старая настройка не пройдена — кабинет открыт', async () => {
        world.onboardingCompleted = false;

        expect(await redirectedTo()).toBeNull();
    });

    it('документы не приняты — барьер по-прежнему держит', async () => {
        world.needsAcceptance = ['TERMS'];

        expect(await redirectedTo()).toBe('/legal-acceptance');
    });

    it('пройденная старая настройка ничего не меняет: кабинет и так открыт', async () => {
        world.onboardingCompleted = true;

        expect(await redirectedTo()).toBeNull();
    });

    it('незавершённый чек-лист кабинет не закрывает — он вообще не барьер', async () => {
        // У этого аккаунта нет ни клиентов, ни расписания, ни записей: все
        // четыре шага открыты. Layout об этом даже не спрашивает.
        world.onboardingCompleted = false;

        expect(await redirectedTo()).toBeNull();
    });

    it('на /onboarding больше не уводит никогда', async () => {
        for (const completed of [true, false]) {
            world.onboardingCompleted = completed;
            expect(await redirectedTo()).not.toBe('/onboarding');
        }
    });

    it('без сессии уводит на вход, запомнив, куда человек шёл', async () => {
        // Ссылка из бота ведёт на /diary/clients?attest=1, а открывают её
        // из мессенджера, где сессии нет. Потеряв адрес здесь, мы вернём
        // человека после входа на «Сегодня», и обещанное окно не
        // откроется — та же ложь, только на шаг позже.
        world.pathname = '/diary/clients?attest=1';
        authMock.mockResolvedValue(null);

        expect(await redirectedTo()).toBe('/auth?next=%2Fdiary%2Fclients%3Fattest%3D1');
    });

    it('шёл в сам кабинет — лишнего параметра в ссылке нет', async () => {
        world.pathname = '/diary';
        authMock.mockResolvedValue(null);

        expect(await redirectedTo()).toBe('/auth');
    });

    it('истёкшая подписка по-прежнему уводит в оплату', async () => {
        // Барьеры, которые были не про онбординг, на месте.
        world.trialEndsAt = new Date('2020-01-01T00:00:00.000Z');

        expect(await redirectedTo()).toBe('/billing');
    });
});
