-- Track beta interest in teased AI/product features without invoking external AI services.
CREATE TABLE IF NOT EXISTS "FeatureInterest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'android',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeatureInterest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FeatureInterest_userId_feature_key" ON "FeatureInterest"("userId", "feature");
CREATE INDEX IF NOT EXISTS "FeatureInterest_feature_idx" ON "FeatureInterest"("feature");
CREATE INDEX IF NOT EXISTS "FeatureInterest_createdAt_idx" ON "FeatureInterest"("createdAt");
