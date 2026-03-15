-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocumentAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "LegalDocumentAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalDocument_type_idx" ON "LegalDocument"("type");

-- CreateIndex
CREATE INDEX "LegalDocument_isActive_idx" ON "LegalDocument"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocumentAcceptance_userId_documentId_key" ON "LegalDocumentAcceptance"("userId", "documentId");

-- AddForeignKey
ALTER TABLE "LegalDocumentAcceptance" ADD CONSTRAINT "LegalDocumentAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocumentAcceptance" ADD CONSTRAINT "LegalDocumentAcceptance_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
