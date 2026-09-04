-- Task 12 (PRAKTIKA MVP, founder correction round 3): CalendarSessionLink +
-- durable import batch/item.
--
-- CalendarSessionLink is the durable link between one DiarySession and one
-- external calendar event on one connected integration. NOT globally unique
-- per session: the same session can be imported from integration A
-- (sourceRole='imported') and separately synced out to integration B
-- (sourceRole='synced'), needing two rows. What IS unique per session is
-- its pairing with a given integration — @@unique(integrationId, sessionId).
-- @@unique(integrationId, externalEventId) is the real idempotency guard for
-- commitPracticeImport: a second attempt to import the same external event
-- fails at the database, not at a best-effort heuristic. integration is
-- ON DELETE RESTRICT — disconnecting a calendar must not silently vanish
-- the import/sync audit trail.
--
-- PracticeImportBatch/PracticeImportItem are the durable record of one
-- commit attempt: what was submitted (the psychologist's resolution per
-- item, as JSON) and what happened afterward (status/errorCode, and the
-- proven-created createdClientId/createdSessionId/calendarSessionLinkId a
-- rollback needs to safely undo only what THIS batch actually created).

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

CREATE UNIQUE INDEX IF NOT EXISTS "CalendarSessionLink_integrationId_externalEventId_key"
    ON "CalendarSessionLink"("integrationId", "externalEventId");
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarSessionLink_integrationId_sessionId_key"
    ON "CalendarSessionLink"("integrationId", "sessionId");
CREATE INDEX IF NOT EXISTS "CalendarSessionLink_psychologistId_idx" ON "CalendarSessionLink"("psychologistId");
CREATE INDEX IF NOT EXISTS "CalendarSessionLink_sessionId_idx" ON "CalendarSessionLink"("sessionId");

ALTER TABLE "CalendarSessionLink"
    ADD CONSTRAINT "CalendarSessionLink_psychologistId_fkey"
    FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalendarSessionLink"
    ADD CONSTRAINT "CalendarSessionLink_integrationId_fkey"
    FOREIGN KEY ("integrationId") REFERENCES "CalendarIntegration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CalendarSessionLink"
    ADD CONSTRAINT "CalendarSessionLink_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "DiarySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

ALTER TABLE "PracticeImportBatch"
    ADD CONSTRAINT "PracticeImportBatch_psychologistId_fkey"
    FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

CREATE INDEX IF NOT EXISTS "PracticeImportItem_batchId_idx" ON "PracticeImportItem"("batchId");

ALTER TABLE "PracticeImportItem"
    ADD CONSTRAINT "PracticeImportItem_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "PracticeImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
