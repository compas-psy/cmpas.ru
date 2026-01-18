-- Enhanced analytics fields for VisitorAnalytics

-- GEO enhancements
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "district" TEXT;
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION;
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "lon" DOUBLE PRECISION;
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "isp" TEXT;
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "org" TEXT;
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "asn" TEXT;

-- Device details (from ua-parser-js)
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "deviceVendor" TEXT;
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "deviceModel" TEXT;

-- Browser details
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "browserName" TEXT;
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "browserVersion" TEXT;
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "browserMajor" TEXT;

-- Engine details
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "engineName" TEXT;
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "engineVersion" TEXT;

-- OS details
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "osName" TEXT;
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "osVersion" TEXT;

-- CPU architecture
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "cpuArchitecture" TEXT;

-- Connection details
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "connectionDownlink" DOUBLE PRECISION;

-- Referrer domain
ALTER TABLE "VisitorAnalytics" ADD COLUMN IF NOT EXISTS "referrerDomain" TEXT;

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS "VisitorAnalytics_city_idx" ON "VisitorAnalytics"("city");
CREATE INDEX IF NOT EXISTS "VisitorAnalytics_deviceVendor_idx" ON "VisitorAnalytics"("deviceVendor");
CREATE INDEX IF NOT EXISTS "VisitorAnalytics_browserName_idx" ON "VisitorAnalytics"("browserName");
CREATE INDEX IF NOT EXISTS "VisitorAnalytics_osName_idx" ON "VisitorAnalytics"("osName");
