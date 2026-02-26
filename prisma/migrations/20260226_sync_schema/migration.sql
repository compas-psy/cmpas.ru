-- AlterTable "AvailabilitySlot"
ALTER TABLE "AvailabilitySlot" ADD COLUMN "startDate" TIMESTAMP(3);
ALTER TABLE "AvailabilitySlot" ADD COLUMN "endDate" TIMESTAMP(3);
-- specificDate was present in the first migration but removed from schema
ALTER TABLE "AvailabilitySlot" DROP COLUMN IF EXISTS "specificDate";

-- AlterTable "PsychologistSettings"
ALTER TABLE "PsychologistSettings" ADD COLUMN "fullName" TEXT;
ALTER TABLE "PsychologistSettings" ADD COLUMN "methods" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PsychologistSettings" ADD COLUMN "basePrice" INTEGER;

-- CreateTable "DiaryBlock"
CREATE TABLE "DiaryBlock" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "reason" TEXT,
    "type" TEXT NOT NULL DEFAULT 'personal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiaryBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiaryBlock_psychologistId_idx" ON "DiaryBlock"("psychologistId");
CREATE INDEX "DiaryBlock_date_idx" ON "DiaryBlock"("date");

-- AddForeignKey
ALTER TABLE "DiaryBlock" ADD CONSTRAINT "DiaryBlock_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
