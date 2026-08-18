import { describe, it, expect } from 'vitest';
import {
    renderConsentText,
    isConsentSatisfied,
    getConsentStatus,
    recordConsent,
    revokeConsent,
    attachPendingConsent,
    type Db,
} from '@/lib/booking/consent';

type FakeClient = {
    id: string;
    psychologistId: string;
    name: string;
    telegramChatId?: string | null;
    consentVersion?: string | null;
    consentHash?: string | null;
    consentDate?: Date | null;
    consentRevokedAt?: Date | null;
};

type FakeTelegramClient = {
    telegramUserId: string;
    diaryClientId?: string | null;
    consentGiven?: boolean;
    consentDate?: Date | null;
};

function makeDb(seed: { clients?: FakeClient[]; telegramClients?: FakeTelegramClient[]; activeVersion?: { version: string; text: string } | null } = {}) {
    const clients: FakeClient[] = seed.clients ?? [];
    const telegramClients: FakeTelegramClient[] = seed.telegramClients ?? [];
    const consentVersions = seed.activeVersion
        ? [{ id: 'v1', version: seed.activeVersion.version, text: seed.activeVersion.text, isActive: true, createdAt: new Date('2026-08-18') }]
        : [];

    const db = {
        consentVersion: {
            findFirst: (async ({ where }: { where?: { isActive?: boolean } }) => {
                const rows = consentVersions.filter(v => where?.isActive === undefined || v.isActive === where.isActive);
                return rows[0] ?? null;
            }) as Db['consentVersion']['findFirst'],
        },
        diaryClient: {
            findFirst: (async ({ where }: { where: { id?: string; psychologistId?: string; telegramChatId?: string } }) => {
                return clients.find(c =>
                    (where.id === undefined || c.id === where.id) &&
                    (where.psychologistId === undefined || c.psychologistId === where.psychologistId) &&
                    (where.telegramChatId === undefined || c.telegramChatId === where.telegramChatId)
                ) ?? null;
            }) as Db['diaryClient']['findFirst'],
            update: (async ({ where, data }: { where: { id: string }; data: Partial<FakeClient> }) => {
                const c = clients.find(c => c.id === where.id);
                if (!c) throw new Error('not found');
                Object.assign(c, data);
                return c;
            }) as Db['diaryClient']['update'],
        },
        telegramClient: {
            findUnique: (async ({ where, include }: { where: { telegramUserId: string }; include?: { diaryClient?: boolean } }) => {
                const t = telegramClients.find(t => t.telegramUserId === where.telegramUserId) ?? null;
                if (!t) return null;
                if (include?.diaryClient) {
                    return { ...t, diaryClient: clients.find(c => c.id === t.diaryClientId) ?? null };
                }
                return t;
            }) as Db['telegramClient']['findUnique'],
            upsert: (async ({ where, update, create }: { where: { telegramUserId: string }; update: Partial<FakeTelegramClient>; create: FakeTelegramClient }) => {
                const existing = telegramClients.find(t => t.telegramUserId === where.telegramUserId);
                if (existing) { Object.assign(existing, update); return existing; }
                const created: FakeTelegramClient = { ...create };
                telegramClients.push(created);
                return created;
            }) as Db['telegramClient']['upsert'],
        },
    } as Db;

    return { db, clients, telegramClients };
}

const TEMPLATE = 'Оператор — {psychologistName}. Согласие v1.';

describe('renderConsentText', () => {
    it('substitutes the psychologist name placeholder', () => {
        expect(renderConsentText(TEMPLATE, 'Иванова Анна')).toBe('Оператор — Иванова Анна. Согласие v1.');
    });

    it('falls back to a generic word when no name is set (unfilled profile, legal/CLIENT_CONSENT_BASIS.md §3)', () => {
        expect(renderConsentText(TEMPLATE, '')).toBe('Оператор — специалист. Согласие v1.');
    });
});

describe('isConsentSatisfied', () => {
    it('is false when no consent was ever given', () => {
        expect(isConsentSatisfied(null, 'v1')).toBe(false);
        expect(isConsentSatisfied({ consentVersion: null }, 'v1')).toBe(false);
    });

    it('is false when the stored version does not match the active one', () => {
        expect(isConsentSatisfied({ consentVersion: 'v0' }, 'v1')).toBe(false);
    });

    it('is true for a matching, non-revoked consent', () => {
        expect(isConsentSatisfied({ consentVersion: 'v1', consentDate: new Date('2026-08-01'), consentRevokedAt: null }, 'v1')).toBe(true);
    });

    it('is false once revoked, even if the version still matches', () => {
        expect(isConsentSatisfied({
            consentVersion: 'v1',
            consentDate: new Date('2026-08-01'),
            consentRevokedAt: new Date('2026-08-10'),
        }, 'v1')).toBe(false);
    });

    it('is true again after re-consenting past the revoke date (CJM_booking_v2.md §7 point 4)', () => {
        expect(isConsentSatisfied({
            consentVersion: 'v1',
            consentDate: new Date('2026-08-15'),
            consentRevokedAt: new Date('2026-08-10'),
        }, 'v1')).toBe(true);
    });
});

describe('getConsentStatus — channel-agnostic (O-260817-09 point 1)', () => {
    it('reports no requirement and empty text when there is no active consent version at all', async () => {
        const { db } = makeDb();
        const status = await getConsentStatus(db, 'psy_1', {}, 'Иванова Анна');
        expect(status).toEqual({ required: false, text: '', version: '' });
    });

    it('regression: an anonymous browser/MAX visitor (no clientId, no telegramUserId) sees the real consent text, not a blank modal', async () => {
        const { db } = makeDb({ activeVersion: { version: 'v1', text: TEMPLATE } });
        const status = await getConsentStatus(db, 'psy_1', {}, 'Иванова Анна');
        expect(status.required).toBe(true);
        expect(status.text).toBe('Оператор — Иванова Анна. Согласие v1.');
        expect(status.version).toBe('v1');
    });

    it('is not required for a browser client identified only by clientId who already consented', async () => {
        const { db } = makeDb({
            activeVersion: { version: 'v1', text: TEMPLATE },
            clients: [{ id: 'c1', psychologistId: 'psy_1', name: 'Клиент', consentVersion: 'v1', consentDate: new Date('2026-08-01') }],
        });
        const status = await getConsentStatus(db, 'psy_1', { clientId: 'c1' }, 'Иванова Анна');
        expect(status.required).toBe(false);
    });

    it('is required again after that same client revoked consent', async () => {
        const { db } = makeDb({
            activeVersion: { version: 'v1', text: TEMPLATE },
            clients: [{ id: 'c1', psychologistId: 'psy_1', name: 'Клиент', consentVersion: 'v1', consentDate: new Date('2026-08-01'), consentRevokedAt: new Date('2026-08-10') }],
        });
        const status = await getConsentStatus(db, 'psy_1', { clientId: 'c1' }, 'Иванова Анна');
        expect(status.required).toBe(true);
    });

    it('is not required for a Telegram client whose consent was given before any DiaryClient existed', async () => {
        const { db } = makeDb({
            activeVersion: { version: 'v1', text: TEMPLATE },
            telegramClients: [{ telegramUserId: 'tg_1', consentGiven: true, consentDate: new Date('2026-08-01') }],
        });
        const status = await getConsentStatus(db, 'psy_1', { telegramUserId: 'tg_1' }, 'Иванова Анна');
        expect(status.required).toBe(false);
    });

    it('does not let a Telegram link to a different psychologist satisfy this psychologist\'s consent (privacy fix)', async () => {
        const { db } = makeDb({
            activeVersion: { version: 'v1', text: TEMPLATE },
            clients: [{ id: 'c1', psychologistId: 'psy_other', name: 'Клиент', consentVersion: 'v1', consentDate: new Date('2026-08-01') }],
            telegramClients: [{ telegramUserId: 'tg_1', diaryClientId: 'c1', consentGiven: false }],
        });
        const status = await getConsentStatus(db, 'psy_1', { telegramUserId: 'tg_1' }, 'Иванова Анна');
        expect(status.required).toBe(true);
    });
});

describe('recordConsent', () => {
    it('writes onto the DiaryClient when a clientId is known', async () => {
        const { db, clients } = makeDb({ clients: [{ id: 'c1', psychologistId: 'psy_1', name: 'Клиент' }] });
        const result = await recordConsent(db, 'psy_1', { clientId: 'c1' }, 'v1');
        expect(result.pending).toBe(false);
        expect(clients[0].consentVersion).toBe('v1');
        expect(clients[0].consentDate).toBeInstanceOf(Date);
    });

    it('writes onto TelegramClient when only a telegramUserId is known, even with no DiaryClient yet', async () => {
        const { db, telegramClients } = makeDb();
        const result = await recordConsent(db, 'psy_1', { telegramUserId: 'tg_1' }, 'v1');
        expect(result.pending).toBe(false);
        expect(telegramClients.find(t => t.telegramUserId === 'tg_1')?.consentGiven).toBe(true);
    });

    it('is pending — writes nothing — for a brand-new anonymous visitor (neither clientId nor telegramUserId)', async () => {
        const { db, clients, telegramClients } = makeDb();
        const result = await recordConsent(db, 'psy_1', {}, 'v1');
        expect(result.pending).toBe(true);
        expect(clients).toHaveLength(0);
        expect(telegramClients).toHaveLength(0);
    });
});

describe('attachPendingConsent — closes the pending gap once bookSession() resolves the client by phone', () => {
    it('records consent on the now-known client', async () => {
        const { db, clients } = makeDb({ clients: [{ id: 'c1', psychologistId: 'psy_1', name: 'Клиент' }] });
        await attachPendingConsent(db, 'c1', 'v1');
        expect(clients[0].consentVersion).toBe('v1');
        expect(clients[0].consentHash).toBeTruthy();
    });
});

describe('revokeConsent — point 4 of O-260817-09', () => {
    it('sets consentRevokedAt without touching the consent history fields', async () => {
        const { db, clients } = makeDb({
            clients: [{ id: 'c1', psychologistId: 'psy_1', name: 'Клиент', consentVersion: 'v1', consentHash: 'abc', consentDate: new Date('2026-08-01') }],
        });
        await revokeConsent(db, 'c1', new Date('2026-08-18'));
        expect(clients[0].consentVersion).toBe('v1');
        expect(clients[0].consentHash).toBe('abc');
        expect(clients[0].consentDate).toEqual(new Date('2026-08-01'));
        expect(clients[0].consentRevokedAt).toEqual(new Date('2026-08-18'));
    });
});
