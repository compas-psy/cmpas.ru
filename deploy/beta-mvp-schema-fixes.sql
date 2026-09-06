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

-- Task 12/13: CalendarSessionLink + PracticeImportBatch/PracticeImportItem
-- (incl. sourceFingerprint). This is the real recovery path when
-- `prisma migrate deploy` fails on the pre-existing out-of-order migration
-- bug (20260118_add_orders references a table a later migration creates)
-- and deploy falls back to this safety-net SQL: without these tables/
-- columns here, scripts/verify-production-schema.js correctly fails closed,
-- since it checks every scalar field of every Prisma model, not just the
-- historical anchor list above. Mirrors prisma/migrations/20260903160000_
-- calendar_session_link_import_batch and .../20260904090000_
-- practice_import_source_fingerprint exactly — keep in sync with those, not
-- the other way around: those migration files are the source of truth and
-- are NOT rewritten here.
CREATE TABLE IF NOT EXISTS "CalendarSessionLink" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "externalSeriesId" TEXT,
    "sourceRole" TEXT NOT NULL DEFAULT 'imported',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CalendarSessionLink_pkey" PRIMARY KEY ("id")
);

-- Compound UNIQUE, not a plain index: commitPracticeImport's idempotency
-- guard (calendarSessionLink.findUnique on integrationId+externalEventId)
-- and the one-link-per-integration-per-session rule both depend on a real
-- Postgres constraint here, not just application-level checking.
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarSessionLink_integrationId_externalEventId_key"
    ON "CalendarSessionLink"("integrationId", "externalEventId");
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarSessionLink_integrationId_sessionId_key"
    ON "CalendarSessionLink"("integrationId", "sessionId");
CREATE INDEX IF NOT EXISTS "CalendarSessionLink_psychologistId_idx" ON "CalendarSessionLink"("psychologistId");
CREATE INDEX IF NOT EXISTS "CalendarSessionLink_sessionId_idx" ON "CalendarSessionLink"("sessionId");

CREATE TABLE IF NOT EXISTS "PracticeImportBatch" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "integrationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'preview',
    "rangeStart" TIMESTAMP(3),
    "rangeEnd" TIMESTAMP(3),
    "summary" JSONB,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "committedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    CONSTRAINT "PracticeImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PracticeImportBatch_psychologistId_idx" ON "PracticeImportBatch"("psychologistId");

CREATE TABLE IF NOT EXISTS "PracticeImportItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "integrationId" TEXT,
    "provider" TEXT,
    "externalEventId" TEXT,
    "externalSeriesId" TEXT,
    "sourceSummary" TEXT,
    "classification" TEXT NOT NULL,
    "resolution" JSONB,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorCode" TEXT,
    "createdClientId" TEXT,
    "createdSessionId" TEXT,
    "calendarSessionLinkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PracticeImportItem_pkey" PRIMARY KEY ("id")
);

-- Task 13: added separately with IF NOT EXISTS in case the table above
-- already existed (Task 12's migration applied) but this later migration
-- did not — the two migrations are separate transactions in
-- `prisma migrate deploy`, so a partial-failure state where one applied and
-- the other didn't is possible, not just all-or-nothing.
ALTER TABLE "PracticeImportItem" ADD COLUMN IF NOT EXISTS "sourceFingerprint" TEXT;

CREATE INDEX IF NOT EXISTS "PracticeImportItem_batchId_idx" ON "PracticeImportItem"("batchId");
CREATE INDEX IF NOT EXISTS "PracticeImportItem_sourceFingerprint_idx" ON "PracticeImportItem"("sourceFingerprint");

-- Foreign keys — guarded via pg_constraint since Postgres has no
-- ADD CONSTRAINT IF NOT EXISTS (same pattern as deploy/schema-fixes.sql).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarSessionLink_psychologistId_fkey') THEN
    ALTER TABLE "CalendarSessionLink" ADD CONSTRAINT "CalendarSessionLink_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarSessionLink_integrationId_fkey') THEN
    ALTER TABLE "CalendarSessionLink" ADD CONSTRAINT "CalendarSessionLink_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "CalendarIntegration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarSessionLink_sessionId_fkey') THEN
    ALTER TABLE "CalendarSessionLink" ADD CONSTRAINT "CalendarSessionLink_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiarySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PracticeImportBatch_psychologistId_fkey') THEN
    ALTER TABLE "PracticeImportBatch" ADD CONSTRAINT "PracticeImportBatch_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PracticeImportItem_batchId_fkey') THEN
    ALTER TABLE "PracticeImportItem" ADD CONSTRAINT "PracticeImportItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PracticeImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
