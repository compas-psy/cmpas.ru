-- Task 7 (PRAKTIKA MVP): DiarySession.origin — who/what created the row
-- ('manual' | 'self_booking' | 'import'). Existing rows default to 'manual'
-- (they were all created by a psychologist directly, before self-booking
-- and import origin-tracking existed). Task 9 will use this to keep cron
-- reminders quiet on freshly-imported sessions.

ALTER TABLE "DiarySession" ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'manual';
