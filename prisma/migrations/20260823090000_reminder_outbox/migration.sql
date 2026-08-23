-- Журнал фактических отправок напоминаний (O-260817-16). Миграция строго
-- добавляющая: новая таблица, ничего существующего не трогает, не
-- переименовывает и не удаляет. До неё src/lib/infra-pulse/reminders-counters.ts
-- уже проверял её наличие через to_regclass и отдавал null — карточка
-- «Рассылка» безопасно продолжит показывать no_data вплоть до применения
-- этой миграции, а сразу после нём начнёт наполняться.

-- CreateTable
CREATE TABLE "ReminderOutbox" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "sessionId" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "sendCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReminderOutbox_sessionId_type_channel_key" ON "ReminderOutbox"("sessionId", "type", "channel");

-- CreateIndex
CREATE INDEX "ReminderOutbox_dueAt_idx" ON "ReminderOutbox"("dueAt");

-- CreateIndex
CREATE INDEX "ReminderOutbox_status_idx" ON "ReminderOutbox"("status");
