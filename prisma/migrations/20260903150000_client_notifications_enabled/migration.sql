-- Task 9 (PRAKTIKA MVP, founder review): communication-policy field,
-- deliberately separate from DiarySession.origin (provenance/audit).
-- Existing rows and every manual/self_booking session default to true —
-- nothing changes for the current product. Calendar/CSV import (Tasks
-- 10-13) is required to explicitly pass false when creating rows.

ALTER TABLE "DiarySession"
ADD COLUMN IF NOT EXISTS "clientNotificationsEnabled"
BOOLEAN NOT NULL DEFAULT true;
