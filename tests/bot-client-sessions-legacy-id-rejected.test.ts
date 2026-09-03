// Task 3 (PRAKTIKA MVP, item A — founder review of 229d99e): the sessions
// route was fixed to reject raw ?clientId= and ?telegramChatId=, but still
// resolved ?c= via resolvePersonalClientToken(), which honors the legacy
// unsigned-raw-clientId compatibility window until 2026-11-15. That reopened
// the exact same IDOR one parameter name over: ?c=<victim's clientId>
// resolved exactly as if it were a real signed token.
//
// This test uses the REAL src/lib/client-workflow (not mocked) so the actual
// resolveSignedPersonalClientToken logic runs — only @/lib/db is mocked.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
    diaryClient: { findFirst: vi.fn() },
    telegramClient: { findUnique: vi.fn() },
    diarySession: { findMany: vi.fn() },
}));
vi.mock('@/lib/db', () => ({ db }));

async function req(qs: string) {
    const { NextRequest } = await import('next/server');
    return new NextRequest(`https://cmpas.ru/api/user/diary/bot/client/sessions${qs}`);
}

describe('GET /api/user/diary/bot/client/sessions — ?c= никогда не принимает сырой (legacy) clientId', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        db.diarySession.findMany.mockResolvedValue([]);
    });

    it('?c=<чужой raw clientId> (формат старой нессылки, до подписи) — отклоняется, пустые корзины', async () => {
        const { GET } = await import('../src/app/api/user/diary/bot/client/sessions/route');
        // Реалистичный формат cuid чужого DiaryClient — то, что раньше принял
        // бы resolvePersonalClientToken() как "legacy" и вернул as-is.
        const res = await GET(await req('?c=clzk8f2p90001qw3h5x9k2m4v'));
        expect(await res.json()).toEqual({ upcoming: [], past: [] });
        expect(db.diarySession.findMany).not.toHaveBeenCalled();
    });

    it('?c=<настоящий подписанный токен> — по-прежнему работает', async () => {
        const { personalClientToken } = await import('../src/lib/client-workflow');
        const token = personalClientToken('client-1');

        const { GET } = await import('../src/app/api/user/diary/bot/client/sessions/route');
        await GET(await req(`?c=${encodeURIComponent(token)}`));

        expect(db.diarySession.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ clientId: 'client-1' }),
        }));
    });
});
