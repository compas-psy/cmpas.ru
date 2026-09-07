// Значение флага telegram_vpn_proxy, когда его никто не трогал.
//
// Тоннель настраивается секретами выкладки, а не в интерфейсе. Заводя
// HYSTERIA_*, человек уже сказал «ходи через тоннель». Если флаг при этом
// молчаливо остаётся выключенным, получается худшее из состояний: тоннель
// поднят, проверен, работает — и не используется. Снаружи это выглядит
// как «бот молчит», и ни одна строка журнала не называет причину; ровно
// так мы и потеряли Telegram.
//
// Обратная сторона: выключатель должен выключать. Явная строка в базе —
// в любую сторону — главнее значения по умолчанию, иначе флаг перестаёт
// быть флагом.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const findUnique = vi.fn();
const findMany = vi.fn();

vi.mock('@/lib/db', () => ({
    db: {
        systemConfig: {
            findUnique: (...args: unknown[]) => findUnique(...args),
            findMany: (...args: unknown[]) => findMany(...args),
        },
    },
}));
vi.mock('@/auth', () => ({ auth: vi.fn() }));

const ORIGINAL_PROXY = process.env.TELEGRAM_PROXY;

describe('флаг «Telegram через VPN» без явной настройки', () => {
    beforeEach(() => {
        vi.resetModules();
        findUnique.mockReset();
        findMany.mockReset();
        findMany.mockResolvedValue([]);
    });

    afterEach(() => {
        if (ORIGINAL_PROXY === undefined) delete process.env.TELEGRAM_PROXY;
        else process.env.TELEGRAM_PROXY = ORIGINAL_PROXY;
    });

    it('тоннель настроен, строки в базе нет — идём через тоннель', async () => {
        process.env.TELEGRAM_PROXY = 'http://singbox:1080';
        findUnique.mockResolvedValue(null);

        const { isFeatureEnabled } = await import('@/app/admin/actions/features');

        expect(await isFeatureEnabled('telegram_vpn_proxy')).toBe(true);
    });

    it('тоннеля нет — флаг выключен, включать нечего', async () => {
        delete process.env.TELEGRAM_PROXY;
        findUnique.mockResolvedValue(null);

        const { isFeatureEnabled } = await import('@/app/admin/actions/features');

        expect(await isFeatureEnabled('telegram_vpn_proxy')).toBe(false);
    });

    it('выключили руками — остаётся выключенным, даже когда тоннель настроен', async () => {
        process.env.TELEGRAM_PROXY = 'http://singbox:1080';
        findUnique.mockResolvedValue({ key: 'telegram_vpn_proxy', value: 'false' });

        const { isFeatureEnabled } = await import('@/app/admin/actions/features');

        // «Строки нет» и «строка со значением false» — разные вещи. Спутать
        // их значит отобрать у человека выключатель.
        expect(await isFeatureEnabled('telegram_vpn_proxy')).toBe(false);
    });

    it('остальные функции сами не включаются', async () => {
        process.env.TELEGRAM_PROXY = 'http://singbox:1080';
        findUnique.mockResolvedValue(null);

        const { isFeatureEnabled } = await import('@/app/admin/actions/features');

        expect(await isFeatureEnabled('ai_summary')).toBe(false);
        expect(await isFeatureEnabled('voice_notes')).toBe(false);
    });

    it('панель показывает то же самое, а не «выключено» при работающем тоннеле', async () => {
        process.env.TELEGRAM_PROXY = 'http://singbox:1080';
        findMany.mockResolvedValue([]);

        const { getFeatureFlags } = await import('@/app/admin/actions/features');
        const flags = await getFeatureFlags();

        // Панель, расходящаяся с поведением, хуже отсутствия панели.
        expect(flags.telegram_vpn_proxy.enabled).toBe(true);
        expect(flags.ai_summary.enabled).toBe(false);
    });
});
