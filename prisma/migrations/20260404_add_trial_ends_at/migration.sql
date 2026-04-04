-- Add trialEndsAt to User for 30-day trial tracking
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
