-- ПРАКТИКА · CJM записи v2 (ТЗ 29.08.2026): три независимых изменения схемы,
-- объединённые в одну миграцию, чтобы не создавать три отдельных файла на
-- сегодняшний заход.
--
-- 1) PsychologistSlug (§5.1) — человекочитаемый адрес вместо голого id в
--    ссылке записи. Смена адреса не удаляет старую запись — isCurrent
--    переключается на новую, старая остаётся резолвящейся (уже разосланные
--    ссылки не должны ломаться).
-- 2) WaitlistEntry.notifiedAt (§5.2) — отметка, что заявке уже отправлено
--    приглашение на освободившийся час; без неё повторный cancel/reschedule
--    того же часа отправил бы приглашение повторно.
-- 3) DiarySession: outcome/outcomeMarkedAt/nextBookingNudgeSent/
--    weeklyFollowupSent (§5.4) — вечерняя отметка специалиста и флаги
--    одноразовой отправки пост-сессионных сообщений клиенту.

CREATE TABLE IF NOT EXISTS "PsychologistSlug" (
    "id"             TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "slug"           TEXT NOT NULL,
    "slugCyrillic"   TEXT,
    "isCurrent"      BOOLEAN NOT NULL DEFAULT true,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PsychologistSlug_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PsychologistSlug_slug_key"
    ON "PsychologistSlug" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "PsychologistSlug_slugCyrillic_key"
    ON "PsychologistSlug" ("slugCyrillic");
CREATE INDEX IF NOT EXISTS "PsychologistSlug_psychologistId_isCurrent_idx"
    ON "PsychologistSlug" ("psychologistId", "isCurrent");

DO $$ BEGIN
    ALTER TABLE "PsychologistSlug"
        ADD CONSTRAINT "PsychologistSlug_psychologistId_fkey"
        FOREIGN KEY ("psychologistId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "WaitlistEntry" ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3);

ALTER TABLE "DiarySession" ADD COLUMN IF NOT EXISTS "outcome" TEXT;
ALTER TABLE "DiarySession" ADD COLUMN IF NOT EXISTS "outcomeMarkedAt" TIMESTAMP(3);
ALTER TABLE "DiarySession" ADD COLUMN IF NOT EXISTS "nextBookingNudgeSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DiarySession" ADD COLUMN IF NOT EXISTS "weeklyFollowupSent" BOOLEAN NOT NULL DEFAULT false;
