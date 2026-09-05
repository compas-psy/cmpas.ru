-- Задача 26. Здесь стояли семь колонок PsychologistClientDocument и два
-- индекса по ним. На чистой базе миграция падала: по имени каталога она идёт
-- ПЕРЕД 20260531_specialist_client_documents, который эту таблицу и создаёт.
-- («ERROR: relation "PsychologistClientDocument" does not exist».) На проде
-- это было незаметно — там таблица появилась раньше, вне цепочки.
--
-- Колонки переехали в 20260531_specialist_client_documents, к своей таблице.
-- Смысл миграции не изменился: настраиваемые документы и настройки оплаты.

CREATE TABLE IF NOT EXISTS "PsychologistPaymentSettings" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paymentText" TEXT,
    "paymentLink" TEXT,
    "paymentQrUrl" TEXT,
    "prepaymentRequired" BOOLEAN NOT NULL DEFAULT true,
    "paymentDueText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PsychologistPaymentSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PsychologistPaymentSettings_psychologistId_key" ON "PsychologistPaymentSettings"("psychologistId");

CREATE TABLE IF NOT EXISTS "SessionPaymentRequest" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "amount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "paymentTextSnapshot" TEXT,
    "paymentLinkSnapshot" TEXT,
    "paymentQrUrlSnapshot" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markedPaidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionPaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SessionPaymentRequest_sessionId_idx" ON "SessionPaymentRequest"("sessionId");
CREATE INDEX IF NOT EXISTS "SessionPaymentRequest_psychologistId_idx" ON "SessionPaymentRequest"("psychologistId");
CREATE INDEX IF NOT EXISTS "SessionPaymentRequest_clientId_idx" ON "SessionPaymentRequest"("clientId");
CREATE INDEX IF NOT EXISTS "SessionPaymentRequest_status_idx" ON "SessionPaymentRequest"("status");
