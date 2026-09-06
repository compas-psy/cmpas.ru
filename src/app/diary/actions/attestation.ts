'use server';

import { auth } from '@/auth';
import { hasPracticeOperatorAttestation, recordPracticeOperatorAttestation } from '@/lib/practice/attestation';

async function getPsychologistId() {
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');
    return session.user.id;
}

export async function checkPracticeOperatorAttestation() {
    const psychologistId = await getPsychologistId();
    return { attested: await hasPracticeOperatorAttestation(psychologistId) };
}

/** Records the caller's own one-time operator attestation. Identity is always the session's — never a parameter. */
export async function attestPracticeOperator() {
    const psychologistId = await getPsychologistId();
    await recordPracticeOperatorAttestation(psychologistId, 'attestation_modal');
    return { success: true };
}
