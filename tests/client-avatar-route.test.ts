// @vitest-environment node
//
// Маршрут аватарки целиком: от запроса до байтов.
//
// Модуль проверен отдельно, но между ним и человеком стоит маршрут —
// авторизация, отбор клиента, кэш, заголовки. Проверяется здесь именно эта
// склейка: она и решает, увидит специалист фотографию или пустой кружок.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirst = vi.fn();
const authFn = vi.fn();
const mobileAuth = vi.fn();

vi.mock('@/lib/db', () => ({ db: { diaryClient: { findFirst: (...a: unknown[]) => findFirst(...a) } } }));
vi.mock('@/auth', () => ({ auth: () => authFn() }));
vi.mock('@/lib/mobile-auth', () => ({ authenticateMobileRequest: (r: unknown) => mobileAuth(r) }));
vi.mock('@/lib/telegram-proxy', () => ({
    nodeFetch: () => globalThis.fetch,
    telegramSendAgent: async () => undefined,
}));

const png = () => ({
    ok: true,
    headers: new Headers({ 'content-type': 'image/png', 'content-length': '64' }),
    arrayBuffer: async () => new ArrayBuffer(64),
});
const json = (b: unknown) => ({ ok: true, headers: new Headers(), json: async () => b });

const request = (headers: Record<string, string> = {}) =>
    ({ headers: new Headers(headers) }) as never;

const call = async (clientId: string, headers?: Record<string, string>) => {
    const { GET } = await import('@/app/api/clients/[clientId]/avatar/route');
    return GET(request(headers), { params: Promise.resolve({ clientId }) });
};

describe('маршрут аватарки', () => {
    beforeEach(() => {
        vi.resetModules();
        findFirst.mockReset();
        authFn.mockReset();
        mobileAuth.mockReset().mockResolvedValue(null);
        process.env.TELEGRAM_BOT_TOKEN = 'ТОКЕН-БОТА';
        process.env.TELEGRAM_API_URL = 'https://api.telegram.org';
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            if (String(url).includes('getUserProfilePhotos')) return json({ result: { photos: [[{ file_id: 'f', width: 160 }]] } });
            if (String(url).includes('getFile')) return json({ result: { file_path: 'photos/file_1.jpg' } });
            return png();
        }));
    });

    it('специалисту отдаёт картинку своего клиента', async () => {
        authFn.mockResolvedValue({ user: { id: 'psy-1' } });
        findFirst.mockResolvedValue({ id: 'c1', telegramChatId: '12345', maxDialogId: null });
        const res = await call('c1');
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('image/png');
    });

    it('без входа — 401, а не картинка', async () => {
        authFn.mockResolvedValue(null);
        const res = await call('c1');
        expect(res.status).toBe(401);
        expect(findFirst).not.toHaveBeenCalled();
    });

    it('чужой клиент отвечает так же, как несуществующий', async () => {
        // Идентификатор в адресе — не разрешение (Task 1). По ответу нельзя
        // отличить «есть, но чужой» от «нет такого».
        authFn.mockResolvedValue({ user: { id: 'psy-1' } });
        findFirst.mockResolvedValue(null);
        const res = await call('чужой');
        expect(res.status).toBe(404);
        // Запрос обязан быть сужен по специалисту, а не отфильтрован после.
        expect(findFirst.mock.calls[0][0].where).toMatchObject({ psychologistId: 'psy-1' });
    });

    it('клиент без мессенджера — 404 и ни одного запроса наружу', async () => {
        authFn.mockResolvedValue({ user: { id: 'psy-1' } });
        findFirst.mockResolvedValue({ id: 'c1', telegramChatId: null, maxDialogId: null });
        const res = await call('c1');
        expect(res.status).toBe(404);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('приложение входит по Bearer, без сессии веба', async () => {
        mobileAuth.mockResolvedValue({ userId: 'psy-1', role: 'user' });
        authFn.mockResolvedValue(null);
        findFirst.mockResolvedValue({ id: 'c1', telegramChatId: '12345', maxDialogId: null });
        const res = await call('c1', { authorization: 'Bearer test-token' });
        expect(res.status).toBe(200);
    });

    it('второй запрос за тем же клиентом в мессенджер не ходит', async () => {
        authFn.mockResolvedValue({ user: { id: 'psy-1' } });
        findFirst.mockResolvedValue({ id: 'c1', telegramChatId: '12345', maxDialogId: null });
        await call('c1');
        const afterFirst = (fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
        await call('c1');
        expect((fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(afterFirst);
    });

    it('в журнал идёт причина, а не клиент', async () => {
        // 404 на экране одинаков для «не привязан», «нет фотографии» и
        // «мессенджер молчит» — причину надо назвать. Но журнал читают люди,
        // которым карточки этого клиента не показывают, поэтому в строке не
        // должно быть ни идентификатора клиента, ни идентификатора в
        // мессенджере.
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        authFn.mockResolvedValue({ user: { id: 'psy-1' } });
        findFirst.mockResolvedValue({ id: 'c-секрет', telegramChatId: '999888', maxDialogId: null });
        (fetch as unknown as { mockResolvedValue: (v: unknown) => void })
            .mockResolvedValue(json({ result: { photos: [] } }));

        const res = await call('c-секрет');
        expect(res.status).toBe(404);

        const lines = log.mock.calls.map(c => c.join(' ')).join('\n');
        expect(lines).toContain('[avatar] empty');
        expect(lines).not.toContain('c-секрет');
        expect(lines).not.toContain('999888');
        log.mockRestore();
    });

    it('токен бота в ответ не попадает', async () => {
        authFn.mockResolvedValue({ user: { id: 'psy-1' } });
        findFirst.mockResolvedValue({ id: 'c1', telegramChatId: '12345', maxDialogId: null });
        const res = await call('c1');
        const headers = JSON.stringify([...res.headers.entries()]);
        expect(headers).not.toContain('ТОКЕН-БОТА');
    });
});
