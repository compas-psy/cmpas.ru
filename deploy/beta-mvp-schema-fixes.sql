-- Beta MVP idempotent schema fixes for CMPAS.RU
-- Keep in sync with prisma/migrations/20260709_* before production deploy.

-- LegalDocumentAcceptance audit snapshots
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

-- FeatureInterest: interest list for honest `Скоро ✨` beta features
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
