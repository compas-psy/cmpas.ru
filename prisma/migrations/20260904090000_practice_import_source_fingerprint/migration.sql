-- Task 13: a durable source-row identity for spreadsheet/paste import items,
-- since they have no CalendarSessionLink to anchor idempotency to.
ALTER TABLE "PracticeImportItem" ADD COLUMN "sourceFingerprint" TEXT;

CREATE INDEX "PracticeImportItem_sourceFingerprint_idx" ON "PracticeImportItem"("sourceFingerprint");
