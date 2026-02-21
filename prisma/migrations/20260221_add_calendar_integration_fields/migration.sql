-- AlterTable
ALTER TABLE "CalendarIntegration" ADD COLUMN "accessToken" TEXT;
ALTER TABLE "CalendarIntegration" ADD COLUMN "refreshToken" TEXT;
ALTER TABLE "CalendarIntegration" ADD COLUMN "tokenExpiry" TIMESTAMP(3);
ALTER TABLE "CalendarIntegration" ADD COLUMN "caldavLogin" TEXT;
ALTER TABLE "CalendarIntegration" ADD COLUMN "caldavPassword" TEXT;
ALTER TABLE "CalendarIntegration" ADD COLUMN "caldavUrl" TEXT;
ALTER TABLE "CalendarIntegration" ADD COLUMN "calendarId" TEXT;
ALTER TABLE "CalendarIntegration" ADD COLUMN "syncToken" TEXT;
