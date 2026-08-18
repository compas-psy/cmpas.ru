-- Technical pulse (O-260817-12). Only additive: two new tables, nothing
-- existing touched.
--
-- InfraPulse is written ONLY by the read-only infra-pulse-collector
-- container (docker/infra-pulse-role.sh grants it SELECT-only on this and
-- every other table — the collector's own DB role has no INSERT/UPDATE/
-- DELETE grant at all, enforced at the database level, not just in code).
--
-- DeployLog is written by scripts/deploy-production-remote.sh (which
-- already has full DB access during a deploy — a different, already-
-- privileged actor, not the read-only collector).

-- CreateTable
CREATE TABLE "InfraPulse" (
    "id" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpuPercent" DOUBLE PRECISION,
    "memUsedBytes" BIGINT,
    "memTotalBytes" BIGINT,
    "diskUsedBytes" BIGINT,
    "diskTotalBytes" BIGINT,
    "containers" JSONB,
    "dbSizeBytes" BIGINT,
    "dbTopTables" JSONB,
    "dbRowCounts" JSONB,
    "migrationsApplied" INTEGER,
    "migrationsUnfinished" INTEGER,
    "migrationsDrift" JSONB,
    "backupAgeHours" DOUBLE PRECISION,
    "backupSizeBytes" BIGINT,
    "backupSizeRatioYesterday" DOUBLE PRECISION,
    "backupReadable" BOOLEAN,
    "remindersDue" INTEGER,
    "remindersSent" INTEGER,
    "remindersSentTwice" INTEGER,
    "certDaysLeft" INTEGER,
    "certDaysLeftZapiski" INTEGER,

    CONSTRAINT "InfraPulse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeployLog" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "result" TEXT NOT NULL,
    "imageRef" TEXT,
    "errorNote" TEXT,

    CONSTRAINT "DeployLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InfraPulse_collectedAt_idx" ON "InfraPulse"("collectedAt");

-- CreateIndex
CREATE INDEX "DeployLog_startedAt_idx" ON "DeployLog"("startedAt");

-- CreateIndex
CREATE INDEX "DeployLog_result_idx" ON "DeployLog"("result");
