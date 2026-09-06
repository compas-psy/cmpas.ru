-- Task 4 (PRAKTIKA MVP): канонические коды юридических документов.
--
-- Вводим code (cmpas_terms / cmpas_privacy / cmpas_professional /
-- cmpas_practice_terms / cmpas_marketing_consent) поверх существующего поля
-- type — как в src/lib/legal-documents.ts LEGAL_CODES — и снимок этого кода
-- на момент согласия в LegalDocumentAcceptance.documentCode, тем же приёмом,
-- каким уже снят documentType/documentVersion.
--
-- Также меняем onDelete документа с CASCADE на RESTRICT: согласие — это
-- доказательство для журнала, и админское удаление LegalDocument
-- (src/app/admin/(chrome)/legal/actions.ts#deleteLegalDoc) не должно иметь
-- возможности молча стереть его вместе с документом.

ALTER TABLE "LegalDocument" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "LegalDocumentAcceptance" ADD COLUMN IF NOT EXISTS "documentCode" TEXT;

UPDATE "LegalDocument" SET "code" = 'cmpas_terms' WHERE "type" = 'TERMS' AND "code" IS NULL;
UPDATE "LegalDocument" SET "code" = 'cmpas_privacy' WHERE "type" = 'PRIVACY' AND "code" IS NULL;
UPDATE "LegalDocument" SET "code" = 'cmpas_marketing_consent' WHERE "type" = 'ADS' AND "code" IS NULL;
UPDATE "LegalDocument" SET "code" = 'cmpas_professional' WHERE "type" = 'PROFESSIONAL' AND "code" IS NULL;
UPDATE "LegalDocument" SET "code" = 'cmpas_practice_terms' WHERE "type" = 'PRACTICE' AND "code" IS NULL;

UPDATE "LegalDocumentAcceptance" a
SET "documentCode" = d."code"
FROM "LegalDocument" d
WHERE a."documentId" = d."id" AND a."documentCode" IS NULL;

CREATE INDEX IF NOT EXISTS "LegalDocument_code_idx" ON "LegalDocument"("code");
CREATE INDEX IF NOT EXISTS "LegalDocumentAcceptance_documentCode_idx" ON "LegalDocumentAcceptance"("documentCode");

ALTER TABLE "LegalDocumentAcceptance" DROP CONSTRAINT IF EXISTS "LegalDocumentAcceptance_documentId_fkey";
ALTER TABLE "LegalDocumentAcceptance"
    ADD CONSTRAINT "LegalDocumentAcceptance_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
