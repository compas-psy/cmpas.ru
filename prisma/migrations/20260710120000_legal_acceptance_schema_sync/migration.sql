-- Snapshot audit fields required for beta legal gate: source + document type/version.
ALTER TABLE "LegalDocumentAcceptance" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'web';
ALTER TABLE "LegalDocumentAcceptance" ADD COLUMN IF NOT EXISTS "documentType" TEXT;
ALTER TABLE "LegalDocumentAcceptance" ADD COLUMN IF NOT EXISTS "documentVersion" TEXT;

UPDATE "LegalDocumentAcceptance" a
SET "documentType" = COALESCE(a."documentType", d.type),
    "documentVersion" = COALESCE(a."documentVersion", d.version)
FROM "LegalDocument" d
WHERE d.id = a."documentId";

CREATE INDEX IF NOT EXISTS "LegalDocumentAcceptance_userId_source_idx" ON "LegalDocumentAcceptance"("userId", "source");
CREATE INDEX IF NOT EXISTS "LegalDocumentAcceptance_documentType_idx" ON "LegalDocumentAcceptance"("documentType");
