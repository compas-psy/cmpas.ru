ALTER TABLE "DiarySession" ADD COLUMN IF NOT EXISTS "structuredNotes" JSONB;
ALTER TABLE "DiarySession" ADD COLUMN IF NOT EXISTS "privateNotes" JSONB;
ALTER TABLE "DiarySession" ADD COLUMN IF NOT EXISTS "clientSummary" TEXT;
ALTER TABLE "DiarySession" ADD COLUMN IF NOT EXISTS "notified24h" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DiarySession" ADD COLUMN IF NOT EXISTS "notified1h" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "DiaryQuestionnaire" ADD COLUMN IF NOT EXISTS "isCompleted" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "TherapyGoal" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "criteria" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TherapyGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Homework" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "sessionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3),
    "clientFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClientRisk" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "description" TEXT,
    "safetyPlan" TEXT,
    "nextCheckDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientRisk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClientAssessment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "resultText" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "nextAssessment" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClientCheckIn" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "moodRating" INTEGER,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientCheckIn_pkey" PRIMARY KEY ("id")
);
