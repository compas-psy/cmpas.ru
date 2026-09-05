-- CreateTable
CREATE TABLE "VisitorAnalytics" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "language" TEXT,
    "platform" TEXT,
    "screenWidth" INTEGER,
    "screenHeight" INTEGER,
    "devicePixelRatio" DOUBLE PRECISION,
    "timezone" TEXT,
    "touchSupport" BOOLEAN,
    "deviceType" TEXT,
    "deviceMemory" DOUBLE PRECISION,
    "hardwareConcurrency" INTEGER,
    "connectionType" TEXT,
    "referrer" TEXT,
    "currentUrl" TEXT,
    "pathname" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "sessionStart" TIMESTAMP(3),
    "timestamp" TIMESTAMP(3),
    "fingerprintComponents" TEXT,
    "visits" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitorAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisitorAnalytics_visitorId_key" ON "VisitorAnalytics"("visitorId");

-- CreateIndex
CREATE INDEX "VisitorAnalytics_visitorId_idx" ON "VisitorAnalytics"("visitorId");

-- CreateIndex
CREATE INDEX "VisitorAnalytics_deviceType_idx" ON "VisitorAnalytics"("deviceType");

-- CreateIndex
CREATE INDEX "VisitorAnalytics_utmSource_idx" ON "VisitorAnalytics"("utmSource");

-- CreateIndex
CREATE INDEX "VisitorAnalytics_createdAt_idx" ON "VisitorAnalytics"("createdAt");

-- Задача 26. GEO-колонки и индекс по country переехали сюда из
-- 20260118_add_orders: там они стояли до создания самой таблицы, и на чистой
-- базе вся цепочка обрывалась на первой же миграции. IF NOT EXISTS оставлен
-- на случай базы, где таблица появилась раньше цепочки — именно так и вышло
-- на проде.
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "countryCode" TEXT;
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "region" TEXT;

CREATE INDEX IF NOT EXISTS "VisitorAnalytics_country_idx" ON "VisitorAnalytics"("country");
