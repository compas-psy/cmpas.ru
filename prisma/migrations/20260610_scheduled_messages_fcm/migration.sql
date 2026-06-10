-- Add fcmToken to User for push notifications
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "fcmToken" TEXT;

-- ScheduledClientMessage: delayed messages from psychologist to client
CREATE TABLE IF NOT EXISTS "ScheduledClientMessage" (
    "id"             TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "clientId"       TEXT NOT NULL,
    "sessionId"      TEXT,
    "channel"        TEXT NOT NULL,
    "text"           TEXT NOT NULL,
    "sendAt"         TIMESTAMP(3) NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'pending',
    "sentAt"         TIMESTAMP(3),
    "errorMsg"       TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledClientMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ScheduledClientMessage_psychologistId_idx" ON "ScheduledClientMessage"("psychologistId");
CREATE INDEX IF NOT EXISTS "ScheduledClientMessage_clientId_idx" ON "ScheduledClientMessage"("clientId");
CREATE INDEX IF NOT EXISTS "ScheduledClientMessage_sendAt_idx" ON "ScheduledClientMessage"("sendAt");
CREATE INDEX IF NOT EXISTS "ScheduledClientMessage_status_idx" ON "ScheduledClientMessage"("status");

-- ClientInviteToken: one-time link for client to bind Telegram/MAX to their card
CREATE TABLE IF NOT EXISTS "ClientInviteToken" (
    "id"             TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "clientId"       TEXT NOT NULL,
    "token"          TEXT NOT NULL,
    "channel"        TEXT NOT NULL,
    "usedAt"         TIMESTAMP(3),
    "expiresAt"      TIMESTAMP(3) NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientInviteToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClientInviteToken_token_key" ON "ClientInviteToken"("token");
CREATE INDEX IF NOT EXISTS "ClientInviteToken_token_idx" ON "ClientInviteToken"("token");
CREATE INDEX IF NOT EXISTS "ClientInviteToken_clientId_idx" ON "ClientInviteToken"("clientId");
