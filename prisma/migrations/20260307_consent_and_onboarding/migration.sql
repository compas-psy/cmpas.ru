-- Migration: Add consent tracking and onboarding flag
-- Adds consent fields to DiaryClient, onboardingCompleted to PsychologistSettings,
-- and ConsentVersion table for 152-FZ compliance

-- DiaryClient consent fields
ALTER TABLE "DiaryClient" ADD COLUMN "consentVersion" TEXT;
ALTER TABLE "DiaryClient" ADD COLUMN "consentHash" TEXT;
ALTER TABLE "DiaryClient" ADD COLUMN "consentDate" TIMESTAMP(3);

-- PsychologistSettings onboarding flag
ALTER TABLE "PsychologistSettings" ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;

-- Mark all existing psychologist settings as onboarding completed (they were created before this flag)
UPDATE "PsychologistSettings" SET "onboardingCompleted" = true;

-- ConsentVersion table
CREATE TABLE "ConsentVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentVersion_pkey" PRIMARY KEY ("id")
);

-- Unique index on version
CREATE UNIQUE INDEX "ConsentVersion_version_key" ON "ConsentVersion"("version");

-- Seed initial consent version
INSERT INTO "ConsentVersion" ("id", "version", "text", "isActive") VALUES (
    'consent_v1_2026',
    '2026-03-07-v1',
    'Я даю своё согласие на обработку моих персональных данных (имя, номер телефона, идентификатор Telegram) психологу, оказывающему мне услуги через сервис КОМПАС (cmpas.ru), в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных данных».

Цель обработки: организация и проведение психологических консультаций, запись на сессии, уведомления о предстоящих встречах, ведение истории консультаций.

Оператором персональных данных является психолог (специалист), которому вы записываетесь. Сервис КОМПАС выступает в роли технического посредника и обрабатывает данные исключительно в целях обеспечения функционирования платформы.

Данное согласие действует бессрочно и может быть отозвано путём направления письменного уведомления психологу или на адрес электронной почты поддержки сервиса.

Я подтверждаю, что уведомлен(а) о своих правах, предусмотренных главой 3 Федерального закона № 152-ФЗ, в том числе о праве на доступ к своим персональным данным, их уточнение, удаление и отзыв настоящего согласия.',
    true
);
