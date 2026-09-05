-- Задача 26. Колонки, которых не хватало цепочке.
--
-- Тот же пробел, что закрыт в 00000000000000_baseline_pre_migration_tables,
-- но на уровне колонок: таблицы миграции создают, а часть полей схемы в них
-- никогда не добавляют — эти поля доехали до базы через `prisma db push`.
-- На проде они есть, на чистой базе их не было, и приложение на такой базе
-- не поднялось бы: заметки по сессии, признаки отправленных напоминаний,
-- параметры правила расписания — не украшения, без них не работает основное.
--
-- Список получен не на глаз, а сверкой: `prisma migrate diff` между базой,
-- собранной всей цепочкой с нуля, и schema.prisma. После этой миграции такая
-- сверка расхождений по недостающим полям не показывает.
--
-- Каждое действие идемпотентно: на существующей базе миграция не делает
-- ничего.

ALTER TABLE "DiaryClient" ADD COLUMN IF NOT EXISTS "telegramChatId" TEXT;

ALTER TABLE "DiaryQuestionnaire" ADD COLUMN IF NOT EXISTS "isCompleted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "DiarySession"
    ADD COLUMN IF NOT EXISTS "structuredNotes" JSONB,
    ADD COLUMN IF NOT EXISTS "privateNotes" JSONB,
    ADD COLUMN IF NOT EXISTS "clientSummary" TEXT,
    ADD COLUMN IF NOT EXISTS "notified24h" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "notified1h" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "postSessionNudged" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "clientMoodRating" INTEGER;

ALTER TABLE "PsychologistSettings"
    ADD COLUMN IF NOT EXISTS "scheduleMode" TEXT NOT NULL DEFAULT 'private',
    ADD COLUMN IF NOT EXISTS "bookingBufferHours" INTEGER NOT NULL DEFAULT 24,
    ADD COLUMN IF NOT EXISTS "bookingHorizonDays" INTEGER NOT NULL DEFAULT 14;

ALTER TABLE "ScheduleRule"
    ADD COLUMN IF NOT EXISTS "format" TEXT NOT NULL DEFAULT 'online',
    ADD COLUMN IF NOT EXISTS "addressId" TEXT,
    ADD COLUMN IF NOT EXISTS "duration" INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS "breakDuration" INTEGER NOT NULL DEFAULT 15,
    ADD COLUMN IF NOT EXISTS "audienceFilter" TEXT NOT NULL DEFAULT 'all',
    ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "LegalDocumentAcceptance_userId_idx" ON "LegalDocumentAcceptance"("userId");
CREATE INDEX IF NOT EXISTS "LegalDocumentAcceptance_documentId_idx" ON "LegalDocumentAcceptance"("documentId");

-- Окно доступности: схема разрешает не задавать длительность и формат —
-- тогда их берут у правила расписания (Задача 6). Миграция, создавшая
-- таблицу, поставила NOT NULL, и на чистой базе окно без собственной
-- длительности создать было нельзя. DROP NOT NULL на уже допускающей NULL
-- колонке — не ошибка, так что на существующей базе это тоже ничего не меняет.
ALTER TABLE "AvailabilitySlot" ALTER COLUMN "duration" DROP NOT NULL;
ALTER TABLE "AvailabilitySlot" ALTER COLUMN "format" DROP NOT NULL;

-- «Подбор времени» включён по умолчанию с 20260829150000_enable_time_suggest,
-- но там обновились только существующие строки; сам DEFAULT колонки остался
-- false и разошёлся со схемой. Значения строк не трогаем — только умолчание
-- для новых.
ALTER TABLE "PsychologistSettings" ALTER COLUMN "timeSuggestEnabled" SET DEFAULT true;
