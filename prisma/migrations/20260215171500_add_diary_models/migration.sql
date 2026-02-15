-- CreateTable
CREATE TABLE "DiaryClient" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "age" INTEGER,
    "gender" TEXT,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "nextSessionDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiaryClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaryQuestionnaire" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiaryQuestionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiarySession" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "endTime" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 50,
    "type" TEXT NOT NULL DEFAULT 'individual',
    "format" TEXT NOT NULL DEFAULT 'online',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiarySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilitySlot" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 50,
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "specificDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeBlock" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarIntegration" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accountEmail" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastSynced" TIMESTAMP(3),
    "conflictsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PsychologistSettings" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "defaultSessionDuration" INTEGER NOT NULL DEFAULT 50,
    "onlineSessionLink" TEXT,
    "officeAddress" TEXT,
    "cancellationHours" INTEGER NOT NULL DEFAULT 24,
    "cancellationFee" INTEGER NOT NULL DEFAULT 50,
    "cancellationText" TEXT,
    "autoSync" BOOLEAN NOT NULL DEFAULT true,
    "blockConflicts" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PsychologistSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiaryClient_psychologistId_idx" ON "DiaryClient"("psychologistId");

-- CreateIndex
CREATE INDEX "DiaryClient_status_idx" ON "DiaryClient"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DiaryQuestionnaire_clientId_key" ON "DiaryQuestionnaire"("clientId");

-- CreateIndex
CREATE INDEX "DiarySession_psychologistId_idx" ON "DiarySession"("psychologistId");

-- CreateIndex
CREATE INDEX "DiarySession_clientId_idx" ON "DiarySession"("clientId");

-- CreateIndex
CREATE INDEX "DiarySession_date_idx" ON "DiarySession"("date");

-- CreateIndex
CREATE INDEX "DiarySession_status_idx" ON "DiarySession"("status");

-- CreateIndex
CREATE INDEX "AvailabilitySlot_psychologistId_idx" ON "AvailabilitySlot"("psychologistId");

-- CreateIndex
CREATE INDEX "AvailabilitySlot_dayOfWeek_idx" ON "AvailabilitySlot"("dayOfWeek");

-- CreateIndex
CREATE INDEX "TimeBlock_psychologistId_idx" ON "TimeBlock"("psychologistId");

-- CreateIndex
CREATE INDEX "CalendarIntegration_psychologistId_idx" ON "CalendarIntegration"("psychologistId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarIntegration_psychologistId_provider_key" ON "CalendarIntegration"("psychologistId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "PsychologistSettings_psychologistId_key" ON "PsychologistSettings"("psychologistId");

-- AddForeignKey
ALTER TABLE "DiaryClient" ADD CONSTRAINT "DiaryClient_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryQuestionnaire" ADD CONSTRAINT "DiaryQuestionnaire_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "DiaryClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiarySession" ADD CONSTRAINT "DiarySession_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiarySession" ADD CONSTRAINT "DiarySession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "DiaryClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarIntegration" ADD CONSTRAINT "CalendarIntegration_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PsychologistSettings" ADD CONSTRAINT "PsychologistSettings_psychologistId_fkey" FOREIGN KEY ("psychologistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
