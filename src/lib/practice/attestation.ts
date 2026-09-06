import { db } from '@/lib/db';

// Task 5 (PRAKTIKA MVP): before a psychologist can create or import ANY
// client record, they must attest (once) that they are the operator of
// that client's personal data and have lawful grounds to process/share it
// with PRAKTIKA for processing on their behalf. This is a legal
// attestation, not a consent — it never applies retroactively to existing
// records, it only gates the NEXT create/import/booking-activation.
export const PRACTICE_CLIENT_DATA_OPERATOR_ATTESTATION = 'practice_client_data_operator';
// Bump this only when the attestation WORDING itself changes — bumping it
// re-asks every psychologist once, so it must not move for unrelated
// releases.
export const PRACTICE_CLIENT_DATA_OPERATOR_WORDING_VERSION = '2026-09-03';

export const PRACTICE_OPERATOR_ATTESTATION_TEXT =
    'Я подтверждаю, что являюсь оператором персональных данных своих клиентов и располагаю необходимыми правовыми основаниями для их обработки и передачи ПРАКТИКЕ для обработки по моему поручению.';

// Message is a stable machine-readable code, not free text: it crosses the
// server-action/API boundary (only Error.message survives serialization),
// so callers match on this exact string rather than an instance check or a
// custom error property.
export const ATTESTATION_REQUIRED_CODE = 'ATTESTATION_REQUIRED';

export class AttestationRequiredError extends Error {
    constructor() {
        super(ATTESTATION_REQUIRED_CODE);
        this.name = 'AttestationRequiredError';
    }
}

export async function hasPracticeOperatorAttestation(psychologistId: string): Promise<boolean> {
    const row = await db.practiceOperatorAttestation.findFirst({
        where: {
            psychologistId,
            attestationCode: PRACTICE_CLIENT_DATA_OPERATOR_ATTESTATION,
            wordingVersion: PRACTICE_CLIENT_DATA_OPERATOR_WORDING_VERSION,
        },
        select: { id: true },
    });
    return !!row;
}

/**
 * Gate for every psychologist-originated client create/import path and for
 * activating public self-booking. Existing clients/sessions are never
 * re-checked — only guard the NEXT write.
 */
export async function requirePracticeOperatorAttestation(psychologistId: string): Promise<void> {
    if (!(await hasPracticeOperatorAttestation(psychologistId))) {
        throw new AttestationRequiredError();
    }
}

export async function recordPracticeOperatorAttestation(psychologistId: string, sourceEvent: string): Promise<void> {
    await db.practiceOperatorAttestation.upsert({
        where: {
            psychologistId_attestationCode_wordingVersion: {
                psychologistId,
                attestationCode: PRACTICE_CLIENT_DATA_OPERATOR_ATTESTATION,
                wordingVersion: PRACTICE_CLIENT_DATA_OPERATOR_WORDING_VERSION,
            },
        },
        create: {
            psychologistId,
            attestationCode: PRACTICE_CLIENT_DATA_OPERATOR_ATTESTATION,
            wordingVersion: PRACTICE_CLIENT_DATA_OPERATOR_WORDING_VERSION,
            sourceEvent,
        },
        update: {}, // idempotent: re-confirming the same wording changes nothing
    });
}
