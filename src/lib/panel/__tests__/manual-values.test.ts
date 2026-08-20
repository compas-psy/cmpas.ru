/**
 * Ручные значения (ТЗ §6.1, §6.3, §11).
 *
 * `SystemConfig` — единственная таблица, куда панель пишет. Значит, это
 * единственное место, где ошибка доступа или разбора имеет последствия,
 * и проверяется оно отдельно.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
const upsert = vi.fn();

vi.mock('@/auth', () => ({ auth: () => authMock() }));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/db', () => ({ db: { systemConfig: { upsert: (args: unknown) => upsert(args) } } }));

function form(values: Record<string, string>): FormData {
    const data = new FormData();
    for (const [k, v] of Object.entries(values)) data.append(k, v);
    return data;
}

const ADMIN = { user: { email: 'admin@example.com', role: 'ADMIN' } };

describe('ручные значения панели', () => {
    beforeEach(() => {
        authMock.mockReset();
        upsert.mockReset();
        upsert.mockResolvedValue({});
    });

    it('без сессии писать нельзя', async () => {
        authMock.mockResolvedValue(null);
        const { setBackupDrill, setInfraCost } = await import('../../../app/admin/panel/actions');

        await expect(setBackupDrill(form({ drillAt: '2026-08-19' }))).rejects.toThrow('Unauthorized');
        await expect(setInfraCost(form({ server: '6400' }))).rejects.toThrow('Unauthorized');
        expect(upsert).not.toHaveBeenCalled();
    });

    it('без роли администратора писать нельзя', async () => {
        authMock.mockResolvedValue({ user: { email: 'user@example.com', role: 'USER' } });
        const { setBackupDrill, setInfraCost } = await import('../../../app/admin/panel/actions');

        await expect(setBackupDrill(form({ drillAt: '2026-08-19' }))).rejects.toThrow('Forbidden');
        await expect(setInfraCost(form({ server: '6400' }))).rejects.toThrow('Forbidden');
        expect(upsert).not.toHaveBeenCalled();
    });

    it('дата восстановления сохраняется под своим ключом', async () => {
        authMock.mockResolvedValue(ADMIN);
        const { setBackupDrill } = await import('../../../app/admin/panel/actions');

        const result = await setBackupDrill(form({ drillAt: '2026-08-19' }));
        expect(result.ok).toBe(true);

        const args = upsert.mock.calls[0][0] as { where: { key: string }; update: { value: string } };
        expect(args.where.key).toBe('backup_restore_drill_at');
        expect(args.update.value).toContain('2026-08-19');
    });

    it('дата в будущем не принимается: отмечается уже проведённая проверка', async () => {
        authMock.mockResolvedValue(ADMIN);
        const { setBackupDrill } = await import('../../../app/admin/panel/actions');

        const future = new Date(Date.now() + 30 * 24 * 3600_000).toISOString().slice(0, 10);
        const result = await setBackupDrill(form({ drillAt: future }));

        expect(result.ok).toBe(false);
        expect(result.error).toContain('будущем');
        expect(upsert).not.toHaveBeenCalled();
    });

    it('мусор вместо даты не принимается', async () => {
        authMock.mockResolvedValue(ADMIN);
        const { setBackupDrill } = await import('../../../app/admin/panel/actions');

        expect((await setBackupDrill(form({ drillAt: 'позавчера' }))).ok).toBe(false);
        expect(upsert).not.toHaveBeenCalled();
    });

    it('пустое поле снимает отметку — карточка перестаёт быть зелёной', async () => {
        authMock.mockResolvedValue(ADMIN);
        const { setBackupDrill } = await import('../../../app/admin/panel/actions');

        const result = await setBackupDrill(form({ drillAt: '' }));
        expect(result.ok).toBe(true);

        const args = upsert.mock.calls[0][0] as { update: { value: string } };
        expect(args.update.value).toBe('');
    });

    it('стоимость сохраняется как JSON со временем обновления', async () => {
        authMock.mockResolvedValue(ADMIN);
        const { setInfraCost } = await import('../../../app/admin/panel/actions');

        const result = await setInfraCost(form({ server: '6400', storage: '1150', domains: '310' }));
        expect(result.ok).toBe(true);

        const args = upsert.mock.calls[0][0] as { where: { key: string }; update: { value: string } };
        expect(args.where.key).toBe('infra_cost_rub');

        const parsed = JSON.parse(args.update.value);
        expect(parsed).toMatchObject({ server: 6400, storage: 1150, domains: 310, source: 'manual' });
        expect(parsed.updatedAt).toBeTruthy();
    });

    it('незаполненная статья остаётся пустой, а не нулём', async () => {
        authMock.mockResolvedValue(ADMIN);
        const { setInfraCost } = await import('../../../app/admin/panel/actions');

        await setInfraCost(form({ server: '6400', storage: '', domains: '' }));
        const parsed = JSON.parse((upsert.mock.calls[0][0] as { update: { value: string } }).update.value);

        // Ноль означал бы «хранилище бесплатное», а не «сумму не вводили».
        expect(parsed.server).toBe(6400);
        expect(parsed.storage).toBeNull();
        expect(parsed.domains).toBeNull();
    });

    it('отрицательные и нечисловые суммы отбрасываются', async () => {
        authMock.mockResolvedValue(ADMIN);
        const { setInfraCost } = await import('../../../app/admin/panel/actions');

        expect((await setInfraCost(form({ server: '-100' }))).ok).toBe(false);
        expect((await setInfraCost(form({ server: 'дорого' }))).ok).toBe(false);
        expect((await setInfraCost(form({ server: '', storage: '', domains: '' }))).ok).toBe(false);
        expect(upsert).not.toHaveBeenCalled();
    });

    it('запятая как разделитель понимается', async () => {
        authMock.mockResolvedValue(ADMIN);
        const { setInfraCost } = await import('../../../app/admin/panel/actions');

        await setInfraCost(form({ server: '6400,50' }));
        const parsed = JSON.parse((upsert.mock.calls[0][0] as { update: { value: string } }).update.value);
        expect(parsed.server).toBe(6401);
    });

    it('панель пишет только в SystemConfig и больше никуда', async () => {
        const { readFileSync } = await import('fs');
        const path = await import('path');
        const src = readFileSync(path.resolve(__dirname, '../../../app/admin/panel/actions.ts'), 'utf8');

        const writes = [...src.matchAll(/db\.(\w+)\.(create|update|upsert|delete|createMany|updateMany|deleteMany)/g)];
        expect(writes.length).toBeGreaterThan(0);
        for (const [, model] of writes) {
            expect(model, `панель пишет в ${model} — разрешён только systemConfig`).toBe('systemConfig');
        }
    });
});

describe('регламент обновления стоимости инфраструктуры', () => {
    // Владелец: обновлять раз в две недели. Просроченное значение — `stale`
    // с причиной, а не `ok`: цифра месячной давности, выданная за свежую,
    // хуже отсутствующей.
    const findMany = vi.fn();
    const findFirst = vi.fn();

    beforeEach(() => {
        vi.resetModules();
        findMany.mockReset();
        findFirst.mockReset();
        findFirst.mockResolvedValue(null);
    });

    async function costWithAge(days: number | null) {
        vi.doMock('@/lib/db', () => ({
            db: {
                systemConfig: { findMany: () => findMany() },
                infraPulse: { findFirst: () => findFirst() },
            },
        }));
        findMany.mockResolvedValue([
            {
                key: 'infra_cost_rub',
                value: JSON.stringify({
                    server: 6400,
                    storage: 1150,
                    domains: 310,
                    updatedAt: days === null ? undefined : new Date(Date.now() - days * 86400_000).toISOString(),
                }),
            },
        ]);
        const { qInfraCost } = await import('../queries/tech');
        return qInfraCost();
    }

    it('свежее значение — ok', async () => {
        const block = await costWithAge(3);
        expect(block.state).toBe('ok');
        expect(block.data?.total).toBe(7860);
    });

    it('на границе двух недель ещё ok', async () => {
        expect((await costWithAge(13)).state).toBe('ok');
    });

    it('старше двух недель — stale с причиной, а не ok', async () => {
        const block = await costWithAge(20);
        expect(block.state).toBe('stale');
        expect(block.reason).toContain('регламенту раз в две недели');
        // Данные при этом сохраняются: устарело — не значит «нет».
        expect(block.data?.total).toBe(7860);
    });

    it('месяц без обновления — по-прежнему stale, данные не теряются', async () => {
        const block = await costWithAge(40);
        expect(block.state).toBe('stale');
        expect(block.data?.server).toBe(6400);
    });
});
