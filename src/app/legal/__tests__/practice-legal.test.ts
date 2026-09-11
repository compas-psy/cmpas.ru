// Task 4 (PRAKTIKA MVP): Professional Agreement and Practice Terms are their
// own, separately-required legal documents — never folded into TERMS — and
// Privacy Policy is informational only, never an acceptance requirement.
// This also regression-tests the founder-review fix that every action in
// src/app/legal/actions.ts derives identity from the session and never
// accepts a userId argument (a "use server" export is a public endpoint —
// a caller-supplied userId there would not be a trusted identity).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    LEGAL_CODES,
    ACCOUNT_REQUIRED_TYPES,
    PROFESSIONAL_REQUIRED_TYPES,
    PRACTICE_REQUIRED_TYPES,
    INFORMATIONAL_ONLY_TYPES,
} from '@/lib/legal-documents';

describe('canonical legal document codes and required sets', () => {
    it('PRIVACY is informational only — never required for account, professional, or practice', () => {
        expect(ACCOUNT_REQUIRED_TYPES).not.toContain('PRIVACY');
        expect(PROFESSIONAL_REQUIRED_TYPES).not.toContain('PRIVACY');
        expect(PRACTICE_REQUIRED_TYPES).not.toContain('PRIVACY');
        expect(INFORMATIONAL_ONLY_TYPES).toContain('PRIVACY');
    });

    it('продукт не собирает акцепт центральных документов — их принимают в СИМПАС', () => {
        // До 11.09.2026 здесь стояло ['TERMS'], и это было верно ТОГДА:
        // своего единого входа не было, принять Соглашение человеку было
        // больше негде. Сейчас оно принимается в СИМПАС кнопкой входа, а
        // наш барьер собирал ВТОРУЮ запись о том же факте — с другим
        // временем, другим источником и без отпечатка текста, потому что
        // нашей страницы нет в реестре документов Экосистемы.
        //
        // Проверка переставлена намеренно и с причиной, а не ослаблена:
        // непустой список здесь снова означал бы акцепт, которого продукту
        // иметь нельзя (14_LEGAL_PRODUCTS_UNIFIED.md §1, §2.1).
        expect(ACCOUNT_REQUIRED_TYPES).toEqual([]);

        // А эти два — документы о САМОМ сервисе и о роли, и принимаются
        // они по-прежнему: первый при подключении ПРАКТИКИ, второй при
        // активации профессионального профиля.
        expect(PROFESSIONAL_REQUIRED_TYPES).toEqual(['PROFESSIONAL']);
        expect(PRACTICE_REQUIRED_TYPES).toEqual(['PRACTICE']);
    });

    it('every legal type maps to a distinct canonical code', () => {
        const codes = Object.values(LEGAL_CODES);
        expect(new Set(codes).size).toBe(codes.length);
        expect(LEGAL_CODES.TERMS).toBe('cmpas_terms');
        expect(LEGAL_CODES.PRIVACY).toBe('cmpas_privacy');
        expect(LEGAL_CODES.PROFESSIONAL).toBe('cmpas_professional');
        expect(LEGAL_CODES.PRACTICE).toBe('cmpas_practice_terms');
        expect(LEGAL_CODES.ADS).toBe('cmpas_marketing_consent');
    });
});

const db = vi.hoisted(() => ({
    legalDocument: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
    },
    legalDocumentAcceptance: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        deleteMany: vi.fn(),
    },
    $executeRaw: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ db }));

const auth = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth }));

function activeDoc(overrides: Record<string, unknown> = {}) {
    return {
        id: 'doc-1',
        type: 'PROFESSIONAL',
        code: 'cmpas_professional',
        version: '1.0',
        url: '/legal/pro',
        isActive: true,
        publishedAt: new Date(),
        ...overrides,
    };
}

describe('src/app/legal/actions.ts — identity always comes from the session', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('checkUserAcceptance fails closed when there is no session — it never trusts a caller-supplied id', async () => {
        auth.mockResolvedValue(null);
        const { checkUserAcceptance } = await import('../actions');

        const result = await checkUserAcceptance(['TERMS']);

        expect(result.success).toBe(false);
        expect(db.legalDocumentAcceptance.findMany).not.toHaveBeenCalled();
    });

    it('toggleAdsConsent fails closed with no session', async () => {
        auth.mockResolvedValue(null);
        const { toggleAdsConsent } = await import('../actions');

        const result = await toggleAdsConsent(true);

        expect(result.success).toBe(false);
        expect(db.$executeRaw).not.toHaveBeenCalled();
    });

    it('checkUserAcceptance for PROFESSIONAL/PRACTICE with no active document is a safe no-op — no fabricated content required', async () => {
        auth.mockResolvedValue({ user: { id: 'psy-1' } });
        db.legalDocument.findFirst.mockResolvedValue(null); // no active PROFESSIONAL doc configured yet
        db.legalDocument.findMany.mockResolvedValue([]); // getActiveLegalDocuments finds nothing active
        const { checkUserAcceptance } = await import('../actions');

        const result = await checkUserAcceptance(['PROFESSIONAL']);

        expect(result.success).toBe(true);
        expect(result.needsAcceptance).toEqual([]);
    });

    it('checkUserAcceptance scopes the acceptance lookup to the session user, ignoring any other id', async () => {
        auth.mockResolvedValue({ user: { id: 'psy-real' } });
        db.legalDocument.findFirst.mockResolvedValue(activeDoc());
        db.legalDocument.findMany.mockResolvedValue([activeDoc()]);
        db.legalDocumentAcceptance.findMany.mockResolvedValue([]);
        const { checkUserAcceptance } = await import('../actions');

        await checkUserAcceptance(['PROFESSIONAL']);

        expect(db.legalDocumentAcceptance.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ userId: 'psy-real' }) }),
        );
    });

    it('acceptDocumentsByIds snapshots the canonical code alongside type/version as evidence', async () => {
        auth.mockResolvedValue({ user: { id: 'psy-1' } });
        const doc = activeDoc();
        db.legalDocument.findFirst.mockResolvedValue(doc);
        db.legalDocument.findMany.mockResolvedValue([doc]);
        const { acceptDocumentsByIds } = await import('../actions');

        await acceptDocumentsByIds([doc.id]);

        expect(db.$executeRaw).toHaveBeenCalled();
        const [sqlParts, ...values] = db.$executeRaw.mock.calls[0];
        // Tagged-template call: the doc's code must be among the interpolated values.
        expect(values).toContain(doc.code);
    });
});
