-- Beta MVP idempotent schema fixes for CMPAS.RU
-- Applied before the production Next.js process starts.
-- Keep in sync with the corresponding Prisma migrations.

-- Mobile communication fields required by Android/MAX/FCM flows.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "maxChatId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "fcmToken" TEXT;
ALTER TABLE "DiaryClient" ADD COLUMN IF NOT EXISTS "maxChatId" TEXT;

-- LegalDocumentAcceptance audit snapshots.
ALTER TABLE "LegalDocumentAcceptance" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'web';
ALTER TABLE "LegalDocumentAcceptance" ADD COLUMN IF NOT EXISTS "documentType" TEXT;
ALTER TABLE "LegalDocumentAcceptance" ADD COLUMN IF NOT EXISTS "documentVersion" TEXT;

UPDATE "LegalDocumentAcceptance" a
SET "documentType" = COALESCE(a."documentType", d.type),
    "documentVersion" = COALESCE(a."documentVersion", d.version)
FROM "LegalDocument" d
WHERE d.id = a."documentId";

CREATE INDEX IF NOT EXISTS "LegalDocumentAcceptance_userId_source_idx" ON "LegalDocumentAcceptance"("userId", "source");
CREATE INDEX IF NOT EXISTS "LegalDocumentAcceptance_documentType_idx" ON "LegalDocumentAcceptance"("documentType");

-- DiarySession fields used by beta API/dashboard maintenance.
ALTER TABLE "DiarySession" ADD COLUMN IF NOT EXISTS "postSessionNudged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DiarySession" ADD COLUMN IF NOT EXISTS "clientMoodRating" INTEGER;
ALTER TABLE "DiarySession" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'not_required';
CREATE INDEX IF NOT EXISTS "DiarySession_paymentStatus_idx" ON "DiarySession"("paymentStatus");

-- FeatureInterest: interest list for honest `Скоро ✨` beta features.
CREATE TABLE IF NOT EXISTS "FeatureInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'android',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeatureInterest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FeatureInterest_userId_feature_key" ON "FeatureInterest"("userId", "feature");
CREATE INDEX IF NOT EXISTS "FeatureInterest_feature_idx" ON "FeatureInterest"("feature");
CREATE INDEX IF NOT EXISTS "FeatureInterest_createdAt_idx" ON "FeatureInterest"("createdAt");

-- Persistent notification feed used by Android and web dashboard.
CREATE TABLE IF NOT EXISTS "PracticeNotification" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "sessionId" TEXT,
    "clientId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PracticeNotification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PracticeNotification" ADD COLUMN IF NOT EXISTS "subtitle" TEXT;
ALTER TABLE "PracticeNotification" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;
ALTER TABLE "PracticeNotification" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE "PracticeNotification" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);
ALTER TABLE "PracticeNotification" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "PracticeNotification_psychologistId_createdAt_idx"
    ON "PracticeNotification"("psychologistId", "createdAt");
CREATE INDEX IF NOT EXISTS "PracticeNotification_psychologistId_readAt_idx"
    ON "PracticeNotification"("psychologistId", "readAt");
