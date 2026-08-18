-- Accept POST /ingest events from a device without an account (O-260817-13).
-- Additive/loosening only: an existing NOT NULL column becomes nullable, one
-- new table is added. No column is dropped or retyped, no existing row is
-- touched.

-- events.accountId was required; a device without an account (МОМЕНТЫ has
-- none, ЗАПИСКИ has no production login yet) has nothing to put there.
ALTER TABLE "events" ALTER COLUMN "accountId" DROP NOT NULL;

-- Consent basis for a device that has no account yet. Independent of
-- User.analyticsConsentAt (charter/12_ANALYTICS.md §2): an account's consent
-- doesn't retroactively cover events sent before the account existed.
CREATE TABLE IF NOT EXISTS "analytics_device_consent" (
    "deviceId"  TEXT NOT NULL,
    "consentAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_device_consent_pkey" PRIMARY KEY ("deviceId")
);
