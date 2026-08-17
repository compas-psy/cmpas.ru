-- Analytics F0/F1 (charter/13_TRACKING_PLAN.md, charter/12_ANALYTICS.md).
-- Additive only: new column with a safe default, new tables. No existing
-- column is dropped, retyped, or has its meaning changed.

-- F0: distinguish which Tinkoff terminal (site vs app) processed a payment.
-- Existing rows predate the second terminal, so they default to "site".
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "terminal" TEXT NOT NULL DEFAULT 'site';

-- F0: subscription state for MRR, separate from individual Payment rows.
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'trial',
    "terminal" TEXT NOT NULL DEFAULT 'site',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_userId_key" ON "Subscription"("userId");
CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription"("status");

ALTER TABLE "Subscription"
    ADD CONSTRAINT "Subscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Analytics consent (charter/12_ANALYTICS.md §2). Null = not given; a
-- non-null timestamp is the only thing that unlocks writing device_id on
-- ingest events for that account.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "analyticsConsentAt" TIMESTAMP(3);

-- F1: POST /ingest destinations. Rejected events keep the raw payload plus a
-- reason, so a bad client can be diagnosed without ever polluting `events`.
CREATE TABLE IF NOT EXISTS "events" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "product" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "deviceId" TEXT,
    "props" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "events_event_idx" ON "events"("event");
CREATE INDEX IF NOT EXISTS "events_accountId_idx" ON "events"("accountId");
CREATE INDEX IF NOT EXISTS "events_ts_idx" ON "events"("ts");

CREATE TABLE IF NOT EXISTS "events_rejected" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_rejected_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "events_rejected_createdAt_idx" ON "events_rejected"("createdAt");
