CREATE TABLE IF NOT EXISTS "AdminMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromAdminId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AdminMessage_toUserId_idx" ON "AdminMessage"("toUserId");
CREATE INDEX IF NOT EXISTS "AdminMessage_fromAdminId_idx" ON "AdminMessage"("fromAdminId");
CREATE INDEX IF NOT EXISTS "AdminMessage_createdAt_idx" ON "AdminMessage"("createdAt");

CREATE TABLE IF NOT EXISTS "AdminActionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AdminActionLog_adminId_idx" ON "AdminActionLog"("adminId");
CREATE INDEX IF NOT EXISTS "AdminActionLog_targetUserId_idx" ON "AdminActionLog"("targetUserId");
CREATE INDEX IF NOT EXISTS "AdminActionLog_createdAt_idx" ON "AdminActionLog"("createdAt");

CREATE TABLE IF NOT EXISTS "UserNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "UserNote_userId_idx" ON "UserNote"("userId");

CREATE TABLE IF NOT EXISTS "UserTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserTag_userId_tag_key" ON "UserTag"("userId", "tag");
CREATE INDEX IF NOT EXISTS "UserTag_userId_idx" ON "UserTag"("userId");
CREATE INDEX IF NOT EXISTS "UserTag_tag_idx" ON "UserTag"("tag");
