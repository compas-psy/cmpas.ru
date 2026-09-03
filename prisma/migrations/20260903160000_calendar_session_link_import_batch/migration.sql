-- Task 12 (PRAKTIKA MVP): CalendarSessionLink + durable import batch/items.
--
-- CalendarSessionLink is the durable link between one DiarySession and the
-- external calendar event it came from. The UNIQUE(integrationId,
-- externalEventId) constraint is the real idempotency guard for
-- commitPracticeImport — a second attempt to import the same external
-- event fails at the database, not at a best-effort (date, time, name)
-- heuristic (which preview used until now).
--
-- PracticeImportBatch/PracticeImportBatchItem are the durable record of one
-- commit attempt: what was submitted (the psychologist's resolution per
-- item) and what happened to each item afterward (outcomeStatus/Reason,
-- the created sessionId) — a queryable trail for a commit that fails,
-- partially fails, or fully rolls back.

CREATE TABLE IF NOT EXISTS "CalendarSessionLink" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "externalSeriesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarSessionLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CalendarSessionLink_sessionId_key" ON "CalendarSessionLink"("sessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarSessionLink_integrationId_externalEventId_key"
    ON "CalendarSessionLink"("integrationId", "externalEventId");
CREATE INDEX IF NOT EXISTS "CalendarSessionLink_psychologistId_idx" ON "CalendarSessionLink"("psychologistId");

ALTER TABLE "CalendarSessionLink"
    ADD CONSTRAINT "CalendarSessionLink_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "DiarySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalendarSessionLink"
    ADD CONSTRAINT "CalendarSessionLink_integrationId_fkey"
    FOREIGN KEY ("integrationId") REFERENCES "CalendarIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "PracticeImportBatch" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "imported" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),

    CONSTRAINT "PracticeImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PracticeImportBatch_psychologistId_idx" ON "PracticeImportBatch"("psychologistId");

ALTER TABLE "PracticeImportBatch"
    ADD CONSTRAINT "PracticeImportBatch_psychologistId_fkey"
    FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "PracticeImportBatchItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "externalSeriesId" TEXT,
    "summary" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT,
    "duration" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "addressId" TEXT,
    "resolvedClientId" TEXT,
    "newClientName" TEXT,
    "outcomeStatus" TEXT NOT NULL DEFAULT 'pending',
    "outcomeReason" TEXT,
    "sessionId" TEXT,

    CONSTRAINT "PracticeImportBatchItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PracticeImportBatchItem_batchId_idx" ON "PracticeImportBatchItem"("batchId");

ALTER TABLE "PracticeImportBatchItem"
    ADD CONSTRAINT "PracticeImportBatchItem_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "PracticeImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
