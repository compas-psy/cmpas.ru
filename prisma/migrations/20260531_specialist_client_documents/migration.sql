CREATE TABLE IF NOT EXISTS "PsychologistClientDocument" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'custom',
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "fileUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PsychologistClientDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClientDocumentDelivery" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sessionId" TEXT,
    "documentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "deliveryChannel" TEXT NOT NULL DEFAULT 'manual',
    "recipientContact" TEXT,
    "documentTitle" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "documentContentHash" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientDocumentDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PsychologistClientDocument_psychologistId_idx" ON "PsychologistClientDocument"("psychologistId");
CREATE INDEX IF NOT EXISTS "PsychologistClientDocument_type_idx" ON "PsychologistClientDocument"("type");
CREATE INDEX IF NOT EXISTS "PsychologistClientDocument_isActive_idx" ON "PsychologistClientDocument"("isActive");

CREATE INDEX IF NOT EXISTS "ClientDocumentDelivery_psychologistId_idx" ON "ClientDocumentDelivery"("psychologistId");
CREATE INDEX IF NOT EXISTS "ClientDocumentDelivery_clientId_idx" ON "ClientDocumentDelivery"("clientId");
CREATE INDEX IF NOT EXISTS "ClientDocumentDelivery_sessionId_idx" ON "ClientDocumentDelivery"("sessionId");
CREATE INDEX IF NOT EXISTS "ClientDocumentDelivery_documentId_idx" ON "ClientDocumentDelivery"("documentId");
CREATE INDEX IF NOT EXISTS "ClientDocumentDelivery_status_idx" ON "ClientDocumentDelivery"("status");

ALTER TABLE "PsychologistClientDocument"
    ADD CONSTRAINT "PsychologistClientDocument_psychologistId_fkey"
    FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientDocumentDelivery"
    ADD CONSTRAINT "ClientDocumentDelivery_psychologistId_fkey"
    FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientDocumentDelivery"
    ADD CONSTRAINT "ClientDocumentDelivery_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "DiaryClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientDocumentDelivery"
    ADD CONSTRAINT "ClientDocumentDelivery_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "DiarySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClientDocumentDelivery"
    ADD CONSTRAINT "ClientDocumentDelivery_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "PsychologistClientDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
