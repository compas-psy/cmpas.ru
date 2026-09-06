-- Task 5 (PRAKTIKA MVP): operator attestation + immutable marketing consent
-- history.
--
-- PracticeOperatorAttestation records the psychologist's one-time legal
-- attestation that they are the operator of their clients' personal data,
-- gating the NEXT client create/import/booking-activation (never existing
-- records — see requirePracticeOperatorAttestation call sites).
--
-- ConsentEvent replaces destructive LegalDocumentAcceptance.deleteMany for
-- marketing consent with an append-only grant/revoke history: nothing here
-- is ever UPDATEd or DELETEd, only inserted.

CREATE TABLE IF NOT EXISTS "PracticeOperatorAttestation" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "attestationCode" TEXT NOT NULL,
    "wordingVersion" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL DEFAULT 'practice',
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceEvent" TEXT,

    CONSTRAINT "PracticeOperatorAttestation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PracticeOperatorAttestation_psychologistId_attestationCode_wo_key"
    ON "PracticeOperatorAttestation"("psychologistId", "attestationCode", "wordingVersion");
CREATE INDEX IF NOT EXISTS "PracticeOperatorAttestation_psychologistId_idx"
    ON "PracticeOperatorAttestation"("psychologistId");

ALTER TABLE "PracticeOperatorAttestation"
    ADD CONSTRAINT "PracticeOperatorAttestation_psychologistId_fkey"
    FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ConsentEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'cmpas_own_services',
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "documentVersion" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceEvent" TEXT,

    CONSTRAINT "ConsentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ConsentEvent_userId_idx" ON "ConsentEvent"("userId");
CREATE INDEX IF NOT EXISTS "ConsentEvent_userId_channel_idx" ON "ConsentEvent"("userId", "channel");
CREATE INDEX IF NOT EXISTS "ConsentEvent_userId_consentType_occurredAt_idx" ON "ConsentEvent"("userId", "consentType", "occurredAt");

ALTER TABLE "ConsentEvent"
    ADD CONSTRAINT "ConsentEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
