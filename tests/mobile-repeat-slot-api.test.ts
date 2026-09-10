// «Тот же час» из приложения: /api/mobile/clients/[id]/repeat-slot.
//
// Ядро повтора проверяется отдельно (tests/repeat-client-slot.test.ts). Здесь
// — то, что добавляет именно маршрут и что легко потерять при правках:
//
//   • без токена ничего не происходит;
//   • чужой клиент — 404, а не «занято»;
//   • срок ограничен, и отказ приходит ДО того, как что-то записано;
//   • клиенту уходит ОДНО сообщение — про ближайшую встречу. Занять час на
//     квартал — решение специалиста о своём расписании; двенадцать
//     уведомлений об этом человеку в мессенджер слать нельзя.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const world = vi.hoisted(() => ({ authUserId: 'psy-1' as string | null, owned: true }));

vi.mock('@/lib/mobile-auth', () => ({
    authenticateMobileRequest: vi.fn(async () => (world.authUserId ? { userId: world.authUserId } : null)),
    unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));

class FakeOwnershipError extends Error {}
vi.mock('@/lib/practice/ownership', () => ({
    OwnershipError: FakeOwnershipError,
    requireOwnedClient: vi.fn(async () => {
        if (!world.owned) throw new FakeOwnershipError('not yours');
    }),
}));

const repeatClientSlot = vi.fn();
class FakeNoReference extends Error {}
vi.mock('@/lib/practice/booking/repeat-slot', () => ({
    repeatClientSlot: (...args: unknown[]) => repeatClientSlot(...args),
    NoReferenceSessionError: FakeNoReference,
    MAX_REPEAT_WEEKS: 12,
}));

const notifyClientAboutSession = vi.fn(async (_psychologistId: string, _sessionId: string, _isFirst: boolean) => ({ status: 'sent' as const }));
vi.mock('@/lib/practice/session-notice', () => ({
    notifyClientAboutSession: (psychologistId: string, sessionId: string, isFirst: boolean) =>
        notifyClientAboutSession(psychologistId, sessionId, isFirst),
}));

vi.mock('@/lib/calendar/auto-sync', () => ({ autoSyncSessionToCalendars: vi.fn(async () => undefined) }));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn(async () => undefined) }));
vi.mock('@/lib/db', () => ({
    db: {
        diarySession: {
            count: vi.fn(async () => 5),
            findFirst: vi.fn(async () => null),
            findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id, client: { name: 'Клиент' } })),
        },
        diaryClient: { update: vi.fn(async () => ({})) },
    },
}));

function request(body: unknown) {
    return new Request('http://localhost/api/mobile/clients/cl-1/repeat-slot', {
        method: 'POST',
        body: JSON.stringify(body),
    }) as never;
}
const params = Promise.resolve({ id: 'cl-1' });

beforeEach(() => {
    vi.clearAllMocks();
    world.authUserId = 'psy-1';
    world.owned = true;
    repeatClientSlot.mockResolvedValue({
        reference: { sessionId: 'ref-1', date: '2026-09-08', time: '14:00' },
        booked: [
            { date: '2026-09-15', time: '14:00', sessionId: 'new-1' },
            { date: '2026-09-22', time: '14:00', sessionId: 'new-2' },
        ],
        skipped: [],
    });
});

describe('POST /api/mobile/clients/[id]/repeat-slot', () => {
    it('без токена — 401 и ни одной записи', async () => {
        world.authUserId = null;
        const { POST } = await import('@/app/api/mobile/clients/[id]/repeat-slot/route');

        const res = await POST(request({ weeks: 1 }), { params });

        expect(res.status).toBe(401);
        expect(repeatClientSlot).not.toHaveBeenCalled();
    });

    it('чужой клиент — 404, и это не «время занято»', async () => {
        world.owned = false;
        const { POST } = await import('@/app/api/mobile/clients/[id]/repeat-slot/route');

        const res = await POST(request({ weeks: 4 }), { params });

        expect(res.status).toBe(404);
        expect(repeatClientSlot).not.toHaveBeenCalled();
    });

    it('срок вне границ отклоняется до записи', async () => {
        const { POST } = await import('@/app/api/mobile/clients/[id]/repeat-slot/route');

        for (const weeks of [0, 13, 'много', undefined]) {
            const res = await POST(request({ weeks }), { params });
            expect(res.status).toBe(400);
        }
        expect(repeatClientSlot).not.toHaveBeenCalled();
    });

    it('занято две недели — клиенту одно сообщение, про ближайшую', async () => {
        const { POST } = await import('@/app/api/mobile/clients/[id]/repeat-slot/route');

        const res = await POST(request({ weeks: 2 }), { params });

        expect(res.status).toBe(201);
        expect(notifyClientAboutSession).toHaveBeenCalledTimes(1);
        expect(notifyClientAboutSession).toHaveBeenCalledWith('psy-1', 'new-1', false);
    });

    it('ни одной записи — и сообщения тоже нет', async () => {
        repeatClientSlot.mockResolvedValue({
            reference: { sessionId: 'ref-1', date: '2026-09-08', time: '14:00' },
            booked: [],
            skipped: [{ date: '2026-09-15', time: '14:00', reason: 'Это время уже занято другой сессией.' }],
        });
        const { POST } = await import('@/app/api/mobile/clients/[id]/repeat-slot/route');

        const res = await POST(request({ weeks: 1 }), { params });
        const json = await res.json();

        expect(res.status).toBe(201);
        expect(notifyClientAboutSession).not.toHaveBeenCalled();
        expect(json.skipped).toHaveLength(1);
    });

    it('у клиента ещё не было встреч — 409 и человеческая причина', async () => {
        repeatClientSlot.mockRejectedValue(new FakeNoReference('У клиента ещё нет ни одной встречи — повторять нечего.'));
        const { POST } = await import('@/app/api/mobile/clients/[id]/repeat-slot/route');

        const res = await POST(request({ weeks: 1 }), { params });
        const json = await res.json();

        expect(res.status).toBe(409);
        expect(json.error).toContain('повторять нечего');
    });
});
