-- Booking mechanics A/B (product/practice/CJM_booking_v1.md, O-260817-03).
-- Additive only: new columns with safe defaults, one new table.

-- Mechanic A "тихая запись" and Mechanic B "подбор времени" — both off by
-- default, existing psychologists see no behavior change until they opt in.
ALTER TABLE "PsychologistSettings" ADD COLUMN IF NOT EXISTS "privateRemindersEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PsychologistSettings" ADD COLUMN IF NOT EXISTS "timeSuggestEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Waitlist capture shown when the suggested-times screen finds nothing.
-- Capture only — no matching/notification engine yet.
CREATE TABLE IF NOT EXISTS "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "preference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WaitlistEntry_psychologistId_createdAt_idx" ON "WaitlistEntry"("psychologistId", "createdAt");
