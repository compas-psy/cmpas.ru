-- CreateTable: per-hit pageview log for time-series analytics
CREATE TABLE IF NOT EXISTS "PageView" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "pathname" TEXT,
    "currentUrl" TEXT,
    "referrerDomain" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "deviceType" TEXT,
    "country" TEXT,
    "city" TEXT,
    "isNewVisitor" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "PageView_visitorId_idx" ON "PageView"("visitorId");
CREATE INDEX IF NOT EXISTS "PageView_createdAt_idx" ON "PageView"("createdAt");
CREATE INDEX IF NOT EXISTS "PageView_pathname_idx" ON "PageView"("pathname");
CREATE INDEX IF NOT EXISTS "PageView_deviceType_idx" ON "PageView"("deviceType");
CREATE INDEX IF NOT EXISTS "PageView_utmSource_idx" ON "PageView"("utmSource");
CREATE INDEX IF NOT EXISTS "PageView_country_idx" ON "PageView"("country");
