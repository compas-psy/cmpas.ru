-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "contactMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "visitorId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "country" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_visitorId_idx" ON "Order"("visitorId");

-- Add GEO columns to VisitorAnalytics if not exists
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "countryCode" TEXT;
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "region" TEXT;

-- Add index for country
CREATE INDEX IF NOT EXISTS "VisitorAnalytics_country_idx" ON "VisitorAnalytics"("country");
