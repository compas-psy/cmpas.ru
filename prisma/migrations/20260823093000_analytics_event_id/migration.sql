-- Идемпотентность POST /ingest (O-260817-17). Миграция строго добавляющая:
-- одна новая nullable-колонка на существующей таблице "events" и её
-- уникальный индекс, ничего существующего не трогает, не переименовывает и
-- не удаляет. NULL допускается везде, где отправитель ещё не присылает
-- event_id — Postgres не считает несколько NULL коллизией UNIQUE.

-- AlterTable
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "eventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "events_eventId_key" ON "events"("eventId");
