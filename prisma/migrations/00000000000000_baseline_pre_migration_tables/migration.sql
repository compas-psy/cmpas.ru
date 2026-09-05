-- Задача 26. Основание цепочки миграций.
--
-- Что нашлось. На пустой базе `prisma migrate deploy` обрывался на третьей
-- миграции: «ERROR: relation "User" does not exist». Двенадцать таблиц —
-- User, Account, Session, VerificationToken, TelegramClient,
-- NotificationSettings, AuditLog, Homework, TherapyGoal, ClientAssessment,
-- ClientCheckIn, ClientRisk — не создаёт ни одна миграция. Их никогда и не
-- создавала: схема доехала до базы через `prisma db push`, а журнал миграций
-- завели позже, отметив всё уже применённым (scripts/db-baseline.sh).
-- Цепочка получилась без основания: она умеет достраивать существующую базу
-- и не умеет построить новую.
--
-- Почему это важно, если прод работает. Прод работает. Не работает всё
-- остальное: чистая база в CI, восстановление из ничего, второй контур,
-- машина нового разработчика. «База, которую нельзя построить заново» —
-- это не свойство схемы, а отсутствие пути назад.
--
-- Что здесь. Те самые двенадцать таблиц в том виде, в каком они были ДО
-- цепочки. Отличие одно и оно намеренное: у User нет двенадцати колонок,
-- которые добавляют более поздние миграции (adsConsent*, pdnConsent*,
-- trialEndsAt, maxChatId, fcmToken, subscriptionPlan, subscriptionEndsAt,
-- analyticsConsentAt) — иначе их собственные ALTER ... ADD COLUMN, шесть из
-- которых без IF NOT EXISTS, упали бы на дубле.
--
-- Внешние ключи этих таблиц здесь не ставятся: половина смотрит на
-- DiaryClient и DiarySession, которых на этом шаге ещё нет. Они вынесены в
-- 20260905130000_baseline_pre_migration_foreign_keys — последнюю миграцию
-- цепочки, где существует уже всё.
--
-- На существующей базе миграция не делает ничего: каждая таблица
-- создаётся через IF NOT EXISTS, а все двенадцать там давно есть.

CREATE TABLE IF NOT EXISTS "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "action" TEXT NOT NULL,
    "provider" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClientAssessment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "resultText" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "nextAssessment" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClientCheckIn" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "moodRating" INTEGER,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientCheckIn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClientRisk" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "description" TEXT,
    "safetyPlan" TEXT,
    "nextCheckDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientRisk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Homework" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "sessionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3),
    "clientFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NotificationSettings" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "newBookingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "newBookingTemplate" TEXT NOT NULL DEFAULT '🔥 Новая запись!

Клиент: {clientName}
📅 {date} в {time}
📍 {format}',
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderMinutesBefore" INTEGER NOT NULL DEFAULT 60,
    "reminderTemplate" TEXT NOT NULL DEFAULT '⏰ Напоминание: сессия через {time} с {clientName}',
    "clientRescheduleEnabled" BOOLEAN NOT NULL DEFAULT true,
    "clientCancelEnabled" BOOLEAN NOT NULL DEFAULT true,
    "morningDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "weeklyDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "clientReminder25hEnabled" BOOLEAN NOT NULL DEFAULT true,
    "clientReminder25hTemplate" TEXT NOT NULL DEFAULT 'Напоминаем: завтра у вас сессия с {psyName} в {time}',
    "clientReminder1hEnabled" BOOLEAN NOT NULL DEFAULT true,
    "clientReminder1hTemplate" TEXT NOT NULL DEFAULT 'Через час начнётся ваша сессия с {psyName}',
    "clientPsyCancelEnabled" BOOLEAN NOT NULL DEFAULT true,
    "clientPsyCancelTemplate" TEXT NOT NULL DEFAULT 'К сожалению, специалист отменил сессию {date} в {time}. {cancelLink}',
    "clientMoodCheckEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "TelegramClient" (
    "id" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "telegramUsername" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "fullName" TEXT,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentDate" TIMESTAMP(3),
    "diaryClientId" TEXT,
    "psychologistId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TherapyGoal" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "criteria" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TherapyGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "telegramChatId" TEXT,
    "telegramUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE UNIQUE INDEX IF NOT EXISTS "User_telegramChatId_key" ON "User"("telegramChatId");

CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken");

CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");

CREATE INDEX IF NOT EXISTS "AuditLog_email_idx" ON "AuditLog"("email");

CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");

CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationSettings_psychologistId_key" ON "NotificationSettings"("psychologistId");

CREATE UNIQUE INDEX IF NOT EXISTS "TelegramClient_telegramUserId_key" ON "TelegramClient"("telegramUserId");

CREATE UNIQUE INDEX IF NOT EXISTS "TelegramClient_diaryClientId_key" ON "TelegramClient"("diaryClientId");

CREATE INDEX IF NOT EXISTS "TelegramClient_psychologistId_idx" ON "TelegramClient"("psychologistId");

CREATE INDEX IF NOT EXISTS "TherapyGoal_clientId_idx" ON "TherapyGoal"("clientId");

CREATE INDEX IF NOT EXISTS "TherapyGoal_psychologistId_idx" ON "TherapyGoal"("psychologistId");

CREATE INDEX IF NOT EXISTS "Homework_clientId_idx" ON "Homework"("clientId");

CREATE INDEX IF NOT EXISTS "Homework_sessionId_idx" ON "Homework"("sessionId");

CREATE UNIQUE INDEX IF NOT EXISTS "ClientRisk_clientId_key" ON "ClientRisk"("clientId");

CREATE INDEX IF NOT EXISTS "ClientAssessment_clientId_idx" ON "ClientAssessment"("clientId");

CREATE INDEX IF NOT EXISTS "ClientAssessment_toolName_idx" ON "ClientAssessment"("toolName");

CREATE INDEX IF NOT EXISTS "ClientCheckIn_clientId_idx" ON "ClientCheckIn"("clientId");

CREATE INDEX IF NOT EXISTS "ClientCheckIn_date_idx" ON "ClientCheckIn"("date");
