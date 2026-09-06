// Task 5 (PRAKTIKA MVP): the psychologist must attest, once, that they are
// the operator of their clients' personal data before creating/importing
// any client or activating public booking. This never applies to existing
// records — only the NEXT write.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
    practiceOperatorAttestation: {
        findFirst: vi.fn(),
        upsert: vi.fn(),
    },
}));
vi.mock('@/lib/db', () => ({ db }));

import {
    requirePracticeOperatorAttestation,
    hasPracticeOperatorAttestation,
    recordPracticeOperatorAttestation,
    AttestationRequiredError,
    ATTESTATION_REQUIRED_CODE,
    PRACTICE_CLIENT_DATA_OPERATOR_ATTESTATION,
    PRACTICE_CLIENT_DATA_OPERATOR_WORDING_VERSION,
} from '../attestation';

describe('requirePracticeOperatorAttestation', () => {
    beforeEach(() => vi.clearAllMocks());

    it('rejects with a stable, machine-readable message when nothing was ever recorded', async () => {
        db.practiceOperatorAttestation.findFirst.mockResolvedValue(null);
        await expect(requirePracticeOperatorAttestation('psy-1')).rejects.toThrow(ATTESTATION_REQUIRED_CODE);
        await expect(requirePracticeOperatorAttestation('psy-1')).rejects.toBeInstanceOf(AttestationRequiredError);
    });

    it('scopes the check to the given psychologist, current attestation code and wording version', async () => {
        db.practiceOperatorAttestation.findFirst.mockResolvedValue(null);
        await requirePracticeOperatorAttestation('psy-1').catch(() => {});
        expect(db.practiceOperatorAttestation.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    psychologistId: 'psy-1',
                    attestationCode: PRACTICE_CLIENT_DATA_OPERATOR_ATTESTATION,
                    wordingVersion: PRACTICE_CLIENT_DATA_OPERATOR_WORDING_VERSION,
                },
            }),
        );
    });

    it('passes once an attestation row exists', async () => {
        db.practiceOperatorAttestation.findFirst.mockResolvedValue({ id: 'a1' });
        await expect(requirePracticeOperatorAttestation('psy-1')).resolves.toBeUndefined();
    });

    it('hasPracticeOperatorAttestation reports false/true consistently with the gate', async () => {
        db.practiceOperatorAttestation.findFirst.mockResolvedValue(null);
        expect(await hasPracticeOperatorAttestation('psy-1')).toBe(false);

        db.practiceOperatorAttestation.findFirst.mockResolvedValue({ id: 'a1' });
        expect(await hasPracticeOperatorAttestation('psy-1')).toBe(true);
    });

    it('one psychologist attesting never satisfies the gate for another', async () => {
        db.practiceOperatorAttestation.findFirst.mockImplementation(({ where }: any) =>
            Promise.resolve(where.psychologistId === 'psy-attested' ? { id: 'a1' } : null),
        );
        await expect(requirePracticeOperatorAttestation('psy-attested')).resolves.toBeUndefined();
        await expect(requirePracticeOperatorAttestation('psy-other')).rejects.toThrow(ATTESTATION_REQUIRED_CODE);
    });

    it('recordPracticeOperatorAttestation is idempotent — upserts on the same composite key, never creates duplicates', async () => {
        db.practiceOperatorAttestation.upsert.mockResolvedValue({ id: 'a1' });
        await recordPracticeOperatorAttestation('psy-1', 'test_source');
        expect(db.practiceOperatorAttestation.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    psychologistId_attestationCode_wordingVersion: {
                        psychologistId: 'psy-1',
                        attestationCode: PRACTICE_CLIENT_DATA_OPERATOR_ATTESTATION,
                        wordingVersion: PRACTICE_CLIENT_DATA_OPERATOR_WORDING_VERSION,
                    },
                },
            }),
        );
    });
});
