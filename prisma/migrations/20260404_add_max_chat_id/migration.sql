-- Add maxChatId to User for MAX messenger notifications
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "maxChatId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_maxChatId_key" ON "User"("maxChatId");
