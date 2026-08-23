-- Время ответа приложения (q_tech_response_p95, ТЗ_management_dashboard.md
-- §5). Миграция строго добавляющая: новая таблица и одна nullable-колонка
-- на существующей InfraPulse, ничего существующего не трогает, не
-- переименовывает и не удаляет.

-- CreateTable
CREATE TABLE "AppResponseTime" (
    "id" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "p50Ms" INTEGER,
    "p95Ms" INTEGER,
    "p99Ms" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppResponseTime_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AppResponseTime_windowEnd_idx" ON "AppResponseTime"("windowEnd");

-- AlterTable
ALTER TABLE "InfraPulse" ADD COLUMN IF NOT EXISTS "responseP95Ms" INTEGER;
