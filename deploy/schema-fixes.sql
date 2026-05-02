-- Idempotent schema fixes for CMPAS.RU
-- This file is executed during deployment to ensure all tables/columns exist.
-- All operations use IF NOT EXISTS / IF EXISTS for safety.

-- User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "maxChatId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "subscriptionEndsAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "subscriptionPlan" TEXT;
ALTER TABLE "DiaryClient" ADD COLUMN IF NOT EXISTS "maxChatId" TEXT;

-- PsychologistAddress table
CREATE TABLE IF NOT EXISTS "PsychologistAddress" (
  "id" TEXT NOT NULL,
  "psychologistId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PsychologistAddress_pkey" PRIMARY KEY ("id")
);

-- DiaryBlock table
CREATE TABLE IF NOT EXISTS "DiaryBlock" (
  "id" TEXT NOT NULL,
  "psychologistId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "reason" TEXT,
  "type" TEXT NOT NULL DEFAULT 'personal',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiaryBlock_pkey" PRIMARY KEY ("id")
);

-- ScheduleRule table
CREATE TABLE IF NOT EXISTS "ScheduleRule" (
  "id" TEXT NOT NULL,
  "psychologistId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "color" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduleRule_pkey" PRIMARY KEY ("id")
);

-- AvailabilitySlot columns
ALTER TABLE "AvailabilitySlot" ADD COLUMN IF NOT EXISTS "format" TEXT NOT NULL DEFAULT 'online';
ALTER TABLE "AvailabilitySlot" ADD COLUMN IF NOT EXISTS "addressId" TEXT;
ALTER TABLE "AvailabilitySlot" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AvailabilitySlot" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "AvailabilitySlot" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);
ALTER TABLE "AvailabilitySlot" DROP COLUMN IF EXISTS "specificDate";
ALTER TABLE "AvailabilitySlot" ADD COLUMN IF NOT EXISTS "scheduleRuleId" TEXT;

-- DiarySession columns
ALTER TABLE "DiarySession" ADD COLUMN IF NOT EXISTS "addressId" TEXT;

-- CalendarIntegration columns
ALTER TABLE "CalendarIntegration" ADD COLUMN IF NOT EXISTS "syncFrom" BOOLEAN NOT NULL DEFAULT true;

-- PsychologistSettings columns
ALTER TABLE "PsychologistSettings" ADD COLUMN IF NOT EXISTS "fullName" TEXT;
ALTER TABLE "PsychologistSettings" ADD COLUMN IF NOT EXISTS "sessionBreak" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "PsychologistSettings" ADD COLUMN IF NOT EXISTS "methods" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PsychologistSettings" ADD COLUMN IF NOT EXISTS "basePrice" INTEGER;
ALTER TABLE "PsychologistSettings" ADD COLUMN IF NOT EXISTS "scheduleMode" TEXT NOT NULL DEFAULT 'private';

-- NotificationSettings table
CREATE TABLE IF NOT EXISTS "NotificationSettings" (
  "id" TEXT NOT NULL,
  "psychologistId" TEXT NOT NULL,
  "newBookingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "newBookingTemplate" TEXT NOT NULL DEFAULT '',
  "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
  "reminderMinutesBefore" INTEGER NOT NULL DEFAULT 60,
  "reminderTemplate" TEXT NOT NULL DEFAULT '',
  "clientRescheduleEnabled" BOOLEAN NOT NULL DEFAULT true,
  "clientCancelEnabled" BOOLEAN NOT NULL DEFAULT true,
  "clientReminder25hEnabled" BOOLEAN NOT NULL DEFAULT true,
  "clientReminder25hTemplate" TEXT NOT NULL DEFAULT '',
  "clientReminder1hEnabled" BOOLEAN NOT NULL DEFAULT true,
  "clientReminder1hTemplate" TEXT NOT NULL DEFAULT '',
  "clientPsyCancelEnabled" BOOLEAN NOT NULL DEFAULT true,
  "clientPsyCancelTemplate" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationSettings_psychologistId_key" UNIQUE ("psychologistId")
);

-- Payment table
CREATE TABLE IF NOT EXISTS "Payment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "tinkoffPaymentId" TEXT,
  "amount" INTEGER NOT NULL,
  "plan" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "paymentUrl" TEXT,
  "months" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_orderId_key" ON "Payment"("orderId");
CREATE INDEX IF NOT EXISTS "Payment_userId_idx" ON "Payment"("userId");

-- Indexes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'DiaryBlock_psychologistId_idx') THEN
    CREATE INDEX "DiaryBlock_psychologistId_idx" ON "DiaryBlock"("psychologistId");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'DiaryBlock_date_idx') THEN
    CREATE INDEX "DiaryBlock_date_idx" ON "DiaryBlock"("date");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ScheduleRule_psychologistId_idx') THEN
    CREATE INDEX "ScheduleRule_psychologistId_idx" ON "ScheduleRule"("psychologistId");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'AvailabilitySlot_scheduleRuleId_idx') THEN
    CREATE INDEX "AvailabilitySlot_scheduleRuleId_idx" ON "AvailabilitySlot"("scheduleRuleId");
  END IF;
END $$;

-- Foreign Keys
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PsychologistAddress_psychologistId_fkey') THEN
    ALTER TABLE "PsychologistAddress" ADD CONSTRAINT "PsychologistAddress_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiaryBlock_psychologistId_fkey') THEN
    ALTER TABLE "DiaryBlock" ADD CONSTRAINT "DiaryBlock_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AvailabilitySlot_addressId_fkey') THEN
    ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "PsychologistAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DiarySession_addressId_fkey') THEN
    ALTER TABLE "DiarySession" ADD CONSTRAINT "DiarySession_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "PsychologistAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NotificationSettings_psychologistId_fkey') THEN
    ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScheduleRule_psychologistId_fkey') THEN
    ALTER TABLE "ScheduleRule" ADD CONSTRAINT "ScheduleRule_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AvailabilitySlot_scheduleRuleId_fkey') THEN
    ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_scheduleRuleId_fkey" FOREIGN KEY ("scheduleRuleId") REFERENCES "ScheduleRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Trial init for existing users
UPDATE "User" SET "trialEndsAt" = NOW() + INTERVAL '30 days' WHERE "trialEndsAt" IS NULL;

-- Schedule Rules V2 Updates
ALTER TABLE "ScheduleRule" ADD COLUMN IF NOT EXISTS "format" TEXT NOT NULL DEFAULT 'online';
ALTER TABLE "ScheduleRule" ADD COLUMN IF NOT EXISTS "addressId" TEXT;
ALTER TABLE "ScheduleRule" ADD COLUMN IF NOT EXISTS "duration" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "ScheduleRule" ADD COLUMN IF NOT EXISTS "breakDuration" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "ScheduleRule" ADD COLUMN IF NOT EXISTS "audienceFilter" TEXT NOT NULL DEFAULT 'all';
ALTER TABLE "ScheduleRule" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "ScheduleRule" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);

ALTER TABLE "PsychologistSettings" ADD COLUMN IF NOT EXISTS "bookingBufferHours" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "PsychologistSettings" ADD COLUMN IF NOT EXISTS "bookingHorizonDays" INTEGER NOT NULL DEFAULT 14;

ALTER TABLE "AvailabilitySlot" ALTER COLUMN "duration" DROP NOT NULL;
ALTER TABLE "AvailabilitySlot" ALTER COLUMN "format" DROP NOT NULL;

-- Bot-centric CJ release (May 2026)
-- DiarySession: post-session nudge tracking
ALTER TABLE "DiarySession" ADD COLUMN IF NOT EXISTS "postSessionNudged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DiarySession" ADD COLUMN IF NOT EXISTS "clientMoodRating" INTEGER;

-- NotificationSettings: proactive bot messages
ALTER TABLE "NotificationSettings" ADD COLUMN IF NOT EXISTS "morningDigestEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationSettings" ADD COLUMN IF NOT EXISTS "weeklyDigestEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationSettings" ADD COLUMN IF NOT EXISTS "clientMoodCheckEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Payment: rebillId for recurring charges
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "rebillId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "tinkoffPaymentId" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Payment_tinkoffPaymentId_key') THEN
    CREATE UNIQUE INDEX "Payment_tinkoffPaymentId_key" ON "Payment"("tinkoffPaymentId");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Payment_status_idx') THEN
    CREATE INDEX "Payment_status_idx" ON "Payment"("status");
  END IF;
END $$;
