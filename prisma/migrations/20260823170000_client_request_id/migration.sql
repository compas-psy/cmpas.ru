-- Ключ идемпотентности с устройства для очереди досылки приложения.
--
-- Приложение ставит запись в очередь ДО отправки и рождает ключ там же. Если
-- ответ сервера потерян (сеть отвалилась после того, как запрос уже обработан),
-- повтор приходит с тем же ключом — и создаёт не вторую строку, а возвращает
-- первую. Без этого досылка чинила бы потерю данных ценой дублей в расписании.
--
-- Nullable: веб и старые сборки приложения ключа не присылают. В PostgreSQL
-- UNIQUE не мешает произвольному числу NULL, поэтому существующие строки
-- миграцию переживают без изменений и без бэкфилла.

ALTER TABLE "DiarySession" ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT;
ALTER TABLE "DiaryClient"  ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "DiarySession_clientRequestId_key"
    ON "DiarySession" ("clientRequestId");
CREATE UNIQUE INDEX IF NOT EXISTS "DiaryClient_clientRequestId_key"
    ON "DiaryClient" ("clientRequestId");
