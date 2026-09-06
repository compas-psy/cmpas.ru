-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "contactMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "visitorId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "country" TEXT,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_visitorId_idx" ON "Order"("visitorId");

-- Задача 26. Здесь стояли четыре GEO-колонки VisitorAnalytics и индекс по
-- country. На чистой базе эта миграция падала: по имени каталога она идёт
-- ПЕРЕД 20260118_add_visitor_analytics, то есть таблицы ещё нет.
-- («ERROR: relation "VisitorAnalytics" does not exist».) На проде это было
-- незаметно — там таблица появилась раньше, вне этой цепочки.
--
-- Колонки переехали в 20260118_add_visitor_analytics, к своей таблице, где
-- они и создаются теперь. Смысл миграции не изменился: она добавляет Order.
