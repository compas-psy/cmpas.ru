-- Admin CRM Models
-- AdminMessage: message history from admin to user
CREATE TABLE "AdminMessage" (
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
CREATE INDEX "AdminMessage_toUserId_idx" ON "AdminMessage"("toUserId");
CREATE INDEX "AdminMessage_fromAdminId_idx" ON "AdminMessage"("fromAdminId");
CREATE INDEX "AdminMessage_createdAt_idx" ON "AdminMessage"("createdAt");

-- AdminActionLog: audit trail for admin actions
CREATE TABLE "AdminActionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AdminActionLog_adminId_idx" ON "AdminActionLog"("adminId");
CREATE INDEX "AdminActionLog_targetUserId_idx" ON "AdminActionLog"("targetUserId");
CREATE INDEX "AdminActionLog_createdAt_idx" ON "AdminActionLog"("createdAt");

-- UserNote: CRM notes per user
CREATE TABLE "UserNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "UserNote_userId_idx" ON "UserNote"("userId");

-- UserTag: segmentation tags
CREATE TABLE "UserTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "UserTag_userId_tag_key" ON "UserTag"("userId", "tag");
CREATE INDEX "UserTag_userId_idx" ON "UserTag"("userId");
CREATE INDEX "UserTag_tag_idx" ON "UserTag"("tag");
