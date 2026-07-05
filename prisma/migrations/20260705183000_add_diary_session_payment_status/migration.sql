ALTER TABLE "DiarySession" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'not_required';
CREATE INDEX IF NOT EXISTS "DiarySession_paymentStatus_idx" ON "DiarySession"("paymentStatus");
