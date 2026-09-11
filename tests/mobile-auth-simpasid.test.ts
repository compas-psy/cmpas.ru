// Обмен ключа доступа СИМПАС на токены ПРАКТИКИ.
//
// На телефоне браузер запрещён требованием СИМПАС (12_NATIVE_AUTH): нативный
// вход отдаёт приложению ключ доступа СИМПАС, а нашему API нужен наш
// собственный токен. Обменника между ними не существовало вовсе — это он.
//
// Проверяется то, что при ошибке стоит дорого: чужая практика, выданная по
// неподтверждённой почте, и вторая пустая практика из-за регистра адреса.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const world = vi.hoisted(() => ({
    issuer: 'https://auth.example.test' as string | null,
    account: null as Record<string, unknown> | null,
    status: 200,
    existingUser: null as { id: string; role: string; isBlocked: boolean } | null,
    linkedUser: null as { id: string; role: string; isBlocked: boolean } | null,
    created: [] as Record<string, unknown>[],
    updated: [] as Record<string, unknown>[],
}));

vi.mock('@/lib/auth/email-identity', () => ({
    findUserByEmailInsensitive: vi.fn(async () => world.existingUser),
    normalizeEmail: (email: string) => email.trim().toLowerCase(),
}));

vi.mock('@/lib/db', () => ({
    db: {
        user: {
            findUnique: vi.fn(async () => world.linkedUser),
            update: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
                world.updated.push({ ...where, ...data });
                return { ...(world.existingUser as object) };
            }),
            create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
                world.created.push(data);
                return { id: 'new-user', role: 'USER', isBlocked: false };
            }),
        },
    },
}));

vi.mock('@/lib/mobile-auth', () => ({
    createTokenPair: (userId: string) => ({ accessToken: `access-${userId}`, refreshToken: `refresh-${userId}`, expiresIn: 604800 }),
}));

function request(body: unknown) {
    return new Request('http://localhost/api/mobile/auth/simpasid', {
        method: 'POST',
        body: JSON.stringify(body),
    }) as never;
}

beforeEach(() => {
    vi.clearAllMocks();
    world.issuer = 'https://auth.example.test';
    world.status = 200;
    world.account = { id: 'sub-1', email: 'Ivan@Ya.ru', email_verified: true, display_name: 'Иван' };
    world.existingUser = null;
    world.linkedUser = null;
    world.created = [];
    world.updated = [];
    process.env.SIMPASID_ISSUER = world.issuer ?? '';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
        world.account === null ? 'не json' : JSON.stringify(world.account),
        { status: world.status, headers: { 'Content-Type': 'application/json' } },
    )));
});

describe('POST /api/mobile/auth/simpasid', () => {
    it('признанный ключ превращается в токены ПРАКТИКИ', async () => {
        world.existingUser = { id: 'psy-1', role: 'USER', isBlocked: false };
        const { POST } = await import('@/app/api/mobile/auth/simpasid/route');

        const res = await POST(request({ accessToken: 'simpas-key' }));
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.accessToken).toBe('access-psy-1');
        expect(world.created).toHaveLength(0);
    });

    it('ПЕРВОЕ связывание ищет по почте без учёта регистра и запоминает sub', async () => {
        const { findUserByEmailInsensitive } = await import('@/lib/auth/email-identity');
        world.existingUser = { id: 'psy-1', role: 'USER', isBlocked: false };
        const { POST } = await import('@/app/api/mobile/auth/simpasid/route');

        await POST(request({ accessToken: 'simpas-key' }));

        expect(findUserByEmailInsensitive).toHaveBeenCalledWith('Ivan@Ya.ru');
        expect(world.updated).toEqual([{ id: 'psy-1', simpasIdSub: 'sub-1' }]);
    });

    it('уже связанного ищем по sub, а почту не спрашиваем вовсе', async () => {
        // Почта в аккаунте СИМПАС меняется штатно. Поиск по ней после смены
        // завёл бы человеку вторую пустую практику рядом с настоящей.
        const { findUserByEmailInsensitive } = await import('@/lib/auth/email-identity');
        world.linkedUser = { id: 'psy-1', role: 'USER', isBlocked: false };
        world.account = { id: 'sub-1', email: 'novaya@ya.ru', email_verified: true };
        const { POST } = await import('@/app/api/mobile/auth/simpasid/route');

        const res = await POST(request({ accessToken: 'simpas-key' }));

        expect(res.status).toBe(200);
        expect(findUserByEmailInsensitive).not.toHaveBeenCalled();
        expect(world.created).toHaveLength(0);
        expect(world.updated).toHaveLength(0);
    });

    it('неподтверждённая почта — отказ, даже если СИМПАС её прислал', async () => {
        // Почта — ключ, по которому находится ЧУЖАЯ практика. Принять её на
        // слово значит отдать практику тому, кто завёл учётную запись на
        // чужой адрес.
        world.account = { id: 'sub-1', email: 'ivan@ya.ru', email_verified: false };
        const { POST } = await import('@/app/api/mobile/auth/simpasid/route');

        const res = await POST(request({ accessToken: 'simpas-key' }));

        expect(res.status).toBe(403);
        expect(world.created).toHaveLength(0);
    });

    it('незнакомый человек заводится с почтой в нижнем регистре и тридцатидневным сроком', async () => {
        const { POST } = await import('@/app/api/mobile/auth/simpasid/route');

        const res = await POST(request({ accessToken: 'simpas-key' }));

        expect(res.status).toBe(200);
        expect(world.created).toHaveLength(1);
        expect(world.created[0].email).toBe('ivan@ya.ru');
        expect(world.created[0].simpasIdSub).toBe('sub-1');
        expect(world.created[0].trialEndsAt).toBeInstanceOf(Date);
    });

    it('СИМПАС не признал ключ — 401, и это не наша поломка', async () => {
        world.status = 401;
        const { POST } = await import('@/app/api/mobile/auth/simpasid/route');

        expect((await POST(request({ accessToken: 'chuzhoy' }))).status).toBe(401);
    });

    it('СИМПАС недоступен — 503, чтобы приложение сказало «вход временно недоступен»', async () => {
        // 500 означал бы «сломались мы» и увёл бы разбор не туда.
        world.status = 502;
        const { POST } = await import('@/app/api/mobile/auth/simpasid/route');

        expect((await POST(request({ accessToken: 'simpas-key' }))).status).toBe(503);
    });

    it('без ключа и без настроенного входа маршрут ничего не делает', async () => {
        const { POST } = await import('@/app/api/mobile/auth/simpasid/route');
        expect((await POST(request({}))).status).toBe(400);

        process.env.SIMPASID_ISSUER = '';
        expect((await POST(request({ accessToken: 'x' }))).status).toBe(404);
    });

    it('заблокированному вход не выдаётся', async () => {
        world.linkedUser = { id: 'psy-1', role: 'USER', isBlocked: true };
        const { POST } = await import('@/app/api/mobile/auth/simpasid/route');

        expect((await POST(request({ accessToken: 'simpas-key' }))).status).toBe(403);
    });
});
