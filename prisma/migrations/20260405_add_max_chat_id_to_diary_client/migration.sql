-- Add maxChatId to DiaryClient for MAX messenger notifications
ALTER TABLE "DiaryClient" ADD COLUMN IF NOT EXISTS "maxChatId" TEXT;
