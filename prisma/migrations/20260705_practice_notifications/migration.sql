-- Persistent notification feed for the psychologist (replaces the ad-hoc
-- 7-day rolling window computed on every dashboard request).
CREATE TABLE IF NOT EXISTS "PracticeNotification" (
    "id"             TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "type"           TEXT NOT NULL,
    "title"          TEXT NOT NULL,
    "subtitle"       TEXT,
    "sessionId"      TEXT,
    "clientId"       TEXT,
    "readAt"         TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeNotification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PracticeNotification_psychologistId_createdAt_idx" ON "PracticeNotification"("psychologistId", "createdAt");
CREATE INDEX IF NOT EXISTS "PracticeNotification_psychologistId_readAt_idx" ON "PracticeNotification"("psychologistId", "readAt");
