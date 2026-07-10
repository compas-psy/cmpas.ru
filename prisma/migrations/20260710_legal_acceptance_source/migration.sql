-- Track whether legal-document acceptance came from web or the Android app.
ALTER TABLE "LegalDocumentAcceptance" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'web';
