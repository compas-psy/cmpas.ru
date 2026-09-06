// Task 5 (PRAKTIKA MVP): marketing consent is an append-only grant/revoke
// history. Revoking used to `deleteMany` the LegalDocumentAcceptance row —
// destroying the evidence that consent was ever given at all. It is now a
// ConsentEvent insert on every toggle; nothing is ever updated or deleted.
// Service (session) reminders are a separate concern entirely and must stay
// unaffected by marketing consent state in either direction.

import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ACCOUNT_REQUIRED_TYPES, PROFESSIONAL_REQUIRED_TYPES, PRACTICE_REQUIRED_TYPES } from '@/lib/legal-documents';

describe('does not require privacy acceptance', () => {
    it('PRIVACY is absent from every required-acceptance set the Task 5 gates could reference', () => {
        expect(ACCOUNT_REQUIRED_TYPES).not.toContain('PRIVACY');
        expect(PROFESSIONAL_REQUIRED_TYPES).not.toContain('PRIVACY');
        expect(PRACTICE_REQUIRED_TYPES).not.toContain('PRIVACY');
    });
});

const auth = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth }));

const db = vi.hoisted(() => ({
    legalDocument: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
    },
    legalDocumentAcceptance: {
        deleteMany: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
    },
    consentEvent: {
        create: vi.fn(),
        findFirst: vi.fn(),
    },
    $executeRaw: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ db }));

function adsDoc() {
    return {
        id: 'ads-doc-1',
        type: 'ADS',
        code: 'cmpas_marketing_consent',
        version: '2.0',
        url: '/legal/consent/marketing',
        isActive: true,
        publishedAt: new Date(),
    };
}

describe('toggleAdsConsent / getAdsConsentStatus — append-only ConsentEvent history', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        auth.mockResolvedValue({ user: { id: 'psy-1' } });
        db.legalDocument.findFirst.mockResolvedValue(adsDoc());
        db.legalDocument.findMany.mockResolvedValue([adsDoc()]);
    });

    it('revoke never deletes anything — it inserts a new ConsentEvent(status="revoked")', async () => {
        const { toggleAdsConsent } = await import('../src/app/legal/actions');

        const result = await toggleAdsConsent(false);

        expect(result.success).toBe(true);
        expect(db.legalDocumentAcceptance.deleteMany).not.toHaveBeenCalled();
        expect(db.consentEvent.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ userId: 'psy-1', status: 'revoked', consentType: 'marketing' }) }),
        );
    });

    it('revoke marketing keeps grant evidence — the earlier granted event is never removed', async () => {
        const { toggleAdsConsent } = await import('../src/app/legal/actions');

        await toggleAdsConsent(true);
        await toggleAdsConsent(false);

        expect(db.consentEvent.create).toHaveBeenCalledTimes(2);
        expect(db.legalDocumentAcceptance.deleteMany).not.toHaveBeenCalled();
        const statuses = db.consentEvent.create.mock.calls.map((c: any) => c[0].data.status);
        expect(statuses).toEqual(['granted', 'revoked']);
    });

    it('getAdsConsentStatus reflects the LATEST event, not just whether one was ever granted', async () => {
        const { getAdsConsentStatus } = await import('../src/app/legal/actions');

        db.consentEvent.findFirst.mockResolvedValue({ status: 'revoked' });
        const afterRevoke = await getAdsConsentStatus();
        expect(afterRevoke.isAccepted).toBe(false);
        expect(afterRevoke.hasAnswered).toBe(true);

        db.consentEvent.findFirst.mockResolvedValue({ status: 'granted' });
        const afterGrant = await getAdsConsentStatus();
        expect(afterGrant.isAccepted).toBe(true);
    });
});

describe('service reminder remains allowed after marketing revoke', () => {
    it('src/lib/cron/reminders.ts never consults marketing/ads consent state', () => {
        const source = readFileSync(
            path.join(process.cwd(), 'src/lib/cron/reminders.ts'),
            'utf8',
        );
        expect(source).not.toMatch(/consent/i);
        expect(source).not.toMatch(/marketing/i);
    });
});
