// B5/B4: linkVisitorAndTrackIdentity — комбинация связки VisitorAnalytics
// с аккаунтом и события identity_linked. Единственное, что не проверено
// этим тестом — чтение самой cookie внутри src/auth.ts (next/headers внутри
// колбэка NextAuth v5); эта функция принимает уже прочитанный visitorId как
// обычный параметр и не знает про cookies()/NextAuth вовсе.

import { describe, it, expect, vi } from 'vitest';
import { linkVisitorAndTrackIdentity } from '@/lib/analytics/link-visitor';

function makeDb(row: { accountId: string | null } | null) {
    const update = vi.fn(async () => ({}));
    const findUnique = vi.fn(async () => row);
    return { visitorAnalytics: { findUnique, update } } as any;
}

describe('linkVisitorAndTrackIdentity (B4+B5)', () => {
    it('первая связка (accountId был null) — identity_linked отправляется с account_id и device_id=visitorId', async () => {
        const db = makeDb({ accountId: null });
        const track = vi.fn(async () => undefined);

        const outcome = await linkVisitorAndTrackIdentity(db, track, 'visitor_1', 'user_1');

        expect(outcome).toBe('linked');
        expect(track).toHaveBeenCalledTimes(1);
        expect(track).toHaveBeenCalledWith(db, {
            event: 'identity_linked',
            product: 'practice',
            accountId: 'user_1',
            deviceId: 'visitor_1',
        });
    });

    it('повторный вход тем же устройством (уже связан с этим же аккаунтом) — identity_linked НЕ отправляется повторно', async () => {
        const db = makeDb({ accountId: 'user_1' });
        const track = vi.fn(async () => undefined);

        const outcome = await linkVisitorAndTrackIdentity(db, track, 'visitor_1', 'user_1');

        expect(outcome).toBe('already_linked');
        expect(track).not.toHaveBeenCalled();
    });

    it('нет куки с visitorId — не бросает, событие не отправляется', async () => {
        const db = makeDb(null);
        const track = vi.fn(async () => undefined);

        const outcome = await linkVisitorAndTrackIdentity(db, track, null, 'user_1');

        expect(outcome).toBe('no_visitor_id');
        expect(track).not.toHaveBeenCalled();
    });

    it('устройство уже связано с другим аккаунтом — не перезаписывает и не шлёт событие', async () => {
        const db = makeDb({ accountId: 'someone_else' });
        const track = vi.fn(async () => undefined);

        const outcome = await linkVisitorAndTrackIdentity(db, track, 'visitor_1', 'user_1');

        expect(outcome).toBe('conflict');
        expect(track).not.toHaveBeenCalled();
        expect(db.visitorAnalytics.update).not.toHaveBeenCalled();
    });
});
