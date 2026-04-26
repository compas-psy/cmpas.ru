-- CreateTable
CREATE TABLE IF NOT EXISTS "SystemConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT 'false',
    "label" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'features',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);
