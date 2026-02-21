ALTER TABLE "CalendarIntegration" ADD COLUMN IF NOT EXISTS "accessToken" TEXT;
ALTER TABLE "CalendarIntegration" ADD COLUMN IF NOT EXISTS "refreshToken" TEXT;
ALTER TABLE "CalendarIntegration" ADD COLUMN IF NOT EXISTS "tokenExpiry" TIMESTAMP(3);
ALTER TABLE "CalendarIntegration" ADD COLUMN IF NOT EXISTS "caldavLogin" TEXT;
ALTER TABLE "CalendarIntegration" ADD COLUMN IF NOT EXISTS "caldavPassword" TEXT;
ALTER TABLE "CalendarIntegration" ADD COLUMN IF NOT EXISTS "caldavUrl" TEXT;
ALTER TABLE "CalendarIntegration" ADD COLUMN IF NOT EXISTS "calendarId" TEXT;
ALTER TABLE "CalendarIntegration" ADD COLUMN IF NOT EXISTS "syncToken" TEXT;
