// Task 14 point 6 (founder correction): a known client whose phone field the
// UI now hides must still resolve to their EXISTING DiaryClient, never a
// duplicate — especially when that client has no phone on file at all, since
// the old phone-string heuristic had nothing to match against. Verified
// identity (HMAC-checked Telegram id, or a signed personal-link token) is
// checked FIRST, before the phone fallback that remains for genuinely
// unidentified visitors.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const verifyTelegramWebAppInitData = vi.fn();
vi.mock('@/lib/telegram-webapp', () => ({ verifyTelegramWebAppInitData: (...args: unknown[]) => verifyTelegramWebAppInitData(...args) }));

const fetchExternalBusyBlocks = vi.fn().mockResolvedValue([]);
vi.mock('@/lib/practice/booking/external-busy', () => ({ fetchExternalBusyBlocks: (...args: unknown[]) => fetchExternalBusyBlocks(...args) }));

interface FakeClient { id: string; psychologistId: string; name: string; phone: string | null; telegramChatId: string | null }
interface FakeSlot { id: string; psychologistId: string; dayOfWeek: number; startTime: string; endTime: string; duration: number; format: string; addressId: string | null; isActive: boolean; scheduleRuleId: string | null; scheduleRule: unknown }

function makeFakeDb() {
    let seq = 0;
    const nextId = (p: string) => `${p}-${++seq}`;
    const clients: FakeClient[] = [];
    const sessions: { id: string; psychologistId: string; clientId: string; date: Date; time: string; duration: number; status: string }[] = [];
    const slots: FakeSlot[] = [];

    const db: any = {
        $transaction: async (fn: any) => fn(db),
        $executeRaw: async () => 0,
        psychologistSettings: { findUnique: async () => ({ timezone: 'Europe/Moscow', bookingBufferHours: 0, bookingHorizonDays: 60, blockConflicts: false, sessionBreak: 15, maxSessionsPerDay: null }) },
        availabilitySlot: {
            findFirst: async ({ where }: any) => slots.find((s) => s.id === where.id && s.psychologistId === where.psychologistId && s.isActive) || null,
        },
        diaryBlock: { findMany: async () => [] },
        diarySession: {
            findMany: async ({ where }: any) => sessions.filter((s) => s.psychologistId === where.psychologistId),
            create: async ({ data }: any) => { const s = { id: nextId('session'), ...data }; sessions.push(s); return s; },
            count: async () => 0,
        },
        diaryClient: {
            findFirst: async ({ where }: any) => clients.find((c) => {
                if (where.id !== undefined && c.id !== where.id) return false;
                if (where.psychologistId !== undefined && c.psychologistId !== where.psychologistId) return false;
                if (where.telegramChatId !== undefined && c.telegramChatId !== where.telegramChatId) return false;
                if (where.OR) return where.OR.some((cond: any) => cond.phone !== undefined && cond.phone === c.phone);
                return true;
            }) || null,
            create: async ({ data }: any) => { const c: FakeClient = { id: nextId('client'), phone: null, telegramChatId: null, ...data }; clients.push(c); return c; },
            update: async ({ where, data }: any) => { const c = clients.find((x) => x.id === where.id)!; Object.assign(c, data); return c; },
        },
        telegramClient: { findUnique: async () => null, update: async () => ({}) },
        consentVersion: { findFirst: async () => null },
        user: { findUnique: async () => ({ psychologistSettings: {} }) },
    };

    return { db, clients, sessions, slots };
}

let fake: ReturnType<typeof makeFakeDb>;
vi.mock('@/lib/db', () => ({ get db() { return fake.db; } }));

const { createSelfPracticeBooking } = await import('../src/lib/practice/booking/booking');
const { slotToken } = await import('../src/lib/practice/booking/slot-token');
const { personalClientToken } = await import('../src/lib/client-workflow');

function mintToken(overrides: Record<string, unknown> = {}) {
    return slotToken({
        psychologistId: 'psy-1', dateStr: '2026-09-10', time: '18:00',
        availabilitySlotId: 'slot-1', scheduleRuleId: null, format: 'online', addressId: null, duration: 50,
        ...overrides,
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    fetchExternalBusyBlocks.mockResolvedValue([]);
    fake = makeFakeDb();
    fake.slots.push({ id: 'slot-1', psychologistId: 'psy-1', dayOfWeek: 3, startTime: '18:00', endTime: '19:00', duration: 50, format: 'online', addressId: null, isActive: true, scheduleRuleId: null, scheduleRule: null });
});

describe('createSelfPracticeBooking — known-client identity (Task 14 point 6)', () => {
    it('a known client with NO phone on file, identified via verified Telegram id, books onto the SAME client — no duplicate', async () => {
        const existing = await fake.db.diaryClient.create({ data: { psychologistId: 'psy-1', name: 'Аня', phone: null, telegramChatId: '555' } });
        verifyTelegramWebAppInitData.mockReturnValue({ id: 555 });

        const result = await createSelfPracticeBooking({
            psychologistId: 'psy-1', name: 'Аня', phone: '', slotToken: mintToken(), telegramInitData: 'raw-init-data',
        });

        expect(result.client.id).toBe(existing.id);
        expect(fake.clients).toHaveLength(1); // never a second client
    });

    it('a known client with NO phone, identified via a verified signed personal-link token, books onto the SAME client', async () => {
        const existing = await fake.db.diaryClient.create({ data: { psychologistId: 'psy-1', name: 'Аня', phone: null, telegramChatId: null } });
        const token = personalClientToken(existing.id);

        const result = await createSelfPracticeBooking({
            psychologistId: 'psy-1', name: 'Аня', phone: '', slotToken: mintToken(), telegramInitData: null, clientLinkToken: token,
        });

        expect(result.client.id).toBe(existing.id);
        expect(fake.clients).toHaveLength(1);
    });

    it('a forged/tampered clientLinkToken is never trusted — falls through instead of granting someone else\'s identity', async () => {
        const victim = await fake.db.diaryClient.create({ data: { psychologistId: 'psy-1', name: 'Жертва', phone: '+79990000001', telegramChatId: null } });

        const result = await createSelfPracticeBooking({
            psychologistId: 'psy-1', name: 'Атакующий', phone: '+79990000002', slotToken: mintToken(),
            telegramInitData: null, clientLinkToken: 'sc1_tamperedgarbage',
        });

        expect(result.client.id).not.toBe(victim.id);
        expect(fake.clients).toHaveLength(2); // a genuinely new client, not the victim
    });

    it('a clientLinkToken for a DIFFERENT psychologist\'s client is never matched (ownership-scoped)', async () => {
        const otherPsyClient = await fake.db.diaryClient.create({ data: { psychologistId: 'psy-OTHER', name: 'Чужой', phone: null, telegramChatId: null } });
        const token = personalClientToken(otherPsyClient.id);

        const result = await createSelfPracticeBooking({
            psychologistId: 'psy-1', name: 'Новый', phone: '+79990000003', slotToken: mintToken(), telegramInitData: null, clientLinkToken: token,
        });

        expect(result.client.id).not.toBe(otherPsyClient.id);
        expect(fake.clients.find((c) => c.id === result.client.id)?.psychologistId).toBe('psy-1');
    });

    it('a genuinely unidentified visitor still resolves/creates by phone as before', async () => {
        const existing = await fake.db.diaryClient.create({ data: { psychologistId: 'psy-1', name: 'Мария', phone: '+79161234567', telegramChatId: null } });

        const result = await createSelfPracticeBooking({
            psychologistId: 'psy-1', name: 'Мария', phone: '+79161234567', slotToken: mintToken(), telegramInitData: null,
        });

        expect(result.client.id).toBe(existing.id);
        expect(fake.clients).toHaveLength(1);
    });
});
