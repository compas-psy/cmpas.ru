-- Add syncFrom column to CalendarIntegration
-- Controls whether events from this calendar block availability slots
ALTER TABLE "CalendarIntegration" ADD COLUMN IF NOT EXISTS "syncFrom" BOOLEAN NOT NULL DEFAULT true;
