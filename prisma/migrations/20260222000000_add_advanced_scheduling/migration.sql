-- AlterTable
ALTER TABLE "AvailabilitySlot" ADD COLUMN "format" TEXT NOT NULL DEFAULT 'online';
ALTER TABLE "AvailabilitySlot" ADD COLUMN "addressId" TEXT;

-- AlterTable
ALTER TABLE "DiarySession" ADD COLUMN "addressId" TEXT;

-- AlterTable
ALTER TABLE "PsychologistSettings" ADD COLUMN "sessionBreak" INTEGER NOT NULL DEFAULT 15;

-- CreateTable
CREATE TABLE "PsychologistAddress" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PsychologistAddress_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "PsychologistAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiarySession" ADD CONSTRAINT "DiarySession_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "PsychologistAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsychologistAddress" ADD CONSTRAINT "PsychologistAddress_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
