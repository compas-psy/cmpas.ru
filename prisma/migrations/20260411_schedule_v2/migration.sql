-- AlterTable: Add maxSessionsPerDay to PsychologistSettings
ALTER TABLE "PsychologistSettings" ADD COLUMN IF NOT EXISTS "maxSessionsPerDay" INTEGER;
