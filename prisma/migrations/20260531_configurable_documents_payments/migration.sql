ALTER TABLE "PsychologistClientDocument"
    ADD COLUMN IF NOT EXISTS "fileName" TEXT,
    ADD COLUMN IF NOT EXISTS "fileMimeType" TEXT,
    ADD COLUMN IF NOT EXISTS "fileSizeBytes" INTEGER,
    ADD COLUMN IF NOT EXISTS "sendOnNewClient" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "sendOnFirstSession" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "requiresAcknowledgement" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "PsychologistClientDocument_sendOnNewClient_idx" ON "PsychologistClientDocument"("sendOnNewClient");
CREATE INDEX IF NOT EXISTS "PsychologistClientDocument_sendOnFirstSession_idx" ON "PsychologistClientDocument"("sendOnFirstSession");

CREATE TABLE IF NOT EXISTS "PsychologistPaymentSettings" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paymentText" TEXT,
    "paymentLink" TEXT,
    "paymentQrUrl" TEXT,
    "prepaymentRequired" BOOLEAN NOT NULL DEFAULT true,
    "paymentDueText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PsychologistPaymentSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PsychologistPaymentSettings_psychologistId_key" ON "PsychologistPaymentSettings"("psychologistId");

CREATE TABLE IF NOT EXISTS "SessionPaymentRequest" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "amount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "paymentTextSnapshot" TEXT,
    "paymentLinkSnapshot" TEXT,
    "paymentQrUrlSnapshot" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markedPaidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionPaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SessionPaymentRequest_sessionId_idx" ON "SessionPaymentRequest"("sessionId");
CREATE INDEX IF NOT EXISTS "SessionPaymentRequest_psychologistId_idx" ON "SessionPaymentRequest"("psychologistId");
CREATE INDEX IF NOT EXISTS "SessionPaymentRequest_clientId_idx" ON "SessionPaymentRequest"("clientId");
CREATE INDEX IF NOT EXISTS "SessionPaymentRequest_status_idx" ON "SessionPaymentRequest"("status");
