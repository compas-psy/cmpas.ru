-- Связка визита с аккаунтом (задача B5, q_sources — funnel.ts): раньше
-- VisitorAnalytics не знала ни про один User, поэтому источник привлечения
-- (utm по отпечатку устройства) терялся в момент регистрации/входа —
-- q_sources честно отдавал no_data ("метка источника не связана с
-- аккаунтом"). Миграция строго добавляющая: новая nullable-колонка и индекс,
-- ничего существующего не трогает, не переименовывает и не удаляет —
-- существующие строки VisitorAnalytics остаются как есть с accountId = NULL
-- (задним числом связку не восстановить: устройство, с которого человек
-- когда-то заходил, знает только browser-отпечаток, а не то, кем он позже
-- зарегистрировался).
--
-- Намеренно НЕ внешний ключ на User — тот же выбор уже сделан для
-- PageView.visitorId ("not a FK — visitor may arrive before analytics
-- record is created", см. комментарий в prisma/schema.prisma): связывание
-- происходит в src/auth.ts при входе, отдельно от жизненного цикла
-- VisitorAnalytics, и жёсткий FK с ON DELETE потребовал бы отдельного
-- решения о поведении при удалении пользователя, которое не входит в эту
-- задачу (см. claude/product/platform/05_CONSENT_PDN.md о будущем едином
-- контуре согласий и удаления, который эту связку затронет отдельно).

-- AlterTable
ALTER TABLE "VisitorAnalytics" ADD COLUMN "accountId" TEXT;

-- CreateIndex
CREATE INDEX "VisitorAnalytics_accountId_idx" ON "VisitorAnalytics"("accountId");
