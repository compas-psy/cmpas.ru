-- Outbox for session reminders (O-260817-16). Only an additive migration:
-- one new table, no existing column touched. DiarySession.notified24h/
-- notified1h are left in place (not read anymore by the new sender, not
-- dropped — removing them is a later step once the old in-process cron path
-- is confirmed gone from every deployed copy of the app).

-- CreateTable
CREATE TABLE "ReminderOutbox" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sendCount" INTEGER NOT NULL DEFAULT 0,
    "late" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReminderOutbox_status_dueAt_idx" ON "ReminderOutbox"("status", "dueAt");

-- CreateIndex
CREATE INDEX "ReminderOutbox_sessionId_idx" ON "ReminderOutbox"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderOutbox_sessionId_kind_key" ON "ReminderOutbox"("sessionId", "kind");

-- AddForeignKey
ALTER TABLE "ReminderOutbox" ADD CONSTRAINT "ReminderOutbox_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiarySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
