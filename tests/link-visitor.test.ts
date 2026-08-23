// B5: linkVisitorToAccount — чистая логика связки VisitorAnalytics с
// аккаунтом при входе. Клеевой код (src/auth.ts, чтение cookie) — тонкая
// обвязка поверх этой функции, тестируется отдельно вместе с identity_linked.

import { describe, it, expect, vi } from 'vitest';
import { linkVisitorToAccount } from '@/lib/analytics/link-visitor';

function makeDb(row: { accountId: string | null } | null) {
    const update = vi.fn(async () => ({}));
    const findUnique = vi.fn(async () => row);
    return { db: { visitorAnalytics: { findUnique, update } }, update, findUnique };
}

describe('linkVisitorToAccount (B5)', () => {
    it('нет visitorId вовсе — no_visitor_id, база не трогается', async () => {
        const { db, findUnique, update } = makeDb(null);
        const outcome = await linkVisitorToAccount(db, null, 'user_1');
        expect(outcome).toBe('no_visitor_id');
        expect(findUnique).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    it('visitorId есть, но такой записи VisitorAnalytics нет — not_found, ничего не пишем', async () => {
        const { db, update } = makeDb(null);
        const outcome = await linkVisitorToAccount(db, 'v1', 'user_1');
        expect(outcome).toBe('not_found');
        expect(update).not.toHaveBeenCalled();
    });

    it('запись есть, accountId ещё не проставлен — linked, пишем update', async () => {
        const { db, update } = makeDb({ accountId: null });
        const outcome = await linkVisitorToAccount(db, 'v1', 'user_1');
        expect(outcome).toBe('linked');
        expect(update).toHaveBeenCalledWith({ where: { visitorId: 'v1' }, data: { accountId: 'user_1' } });
    });

    it('уже связан с тем же аккаунтом — already_linked, update не вызывается (повторный вход — не новая связка)', async () => {
        const { db, update } = makeDb({ accountId: 'user_1' });
        const outcome = await linkVisitorToAccount(db, 'v1', 'user_1');
        expect(outcome).toBe('already_linked');
        expect(update).not.toHaveBeenCalled();
    });

    it('уже связан с ДРУГИМ аккаунтом — conflict, не перезаписываем (13_TRACKING_PLAN.md §2: задним числом не переписываем)', async () => {
        const { db, update } = makeDb({ accountId: 'someone_else' });
        const outcome = await linkVisitorToAccount(db, 'v1', 'user_1');
        expect(outcome).toBe('conflict');
        expect(update).not.toHaveBeenCalled();
    });
});
