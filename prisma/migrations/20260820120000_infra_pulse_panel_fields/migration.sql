-- Управленческая панель, ТЗ §6.1: три поля к показаниям инфраструктуры.
-- Миграция строго добавляющая: ни одна существующая колонка не трогается,
-- все три допускают NULL, поэтому коллектор старой версии продолжает писать
-- строки как раньше, а панель показывает эти блоки как «данных нет».
ALTER TABLE "InfraPulse" ADD COLUMN IF NOT EXISTS "webhookErrorRates" JSONB;
ALTER TABLE "InfraPulse" ADD COLUMN IF NOT EXISTS "buildMinutesLeft" INTEGER;
ALTER TABLE "InfraPulse" ADD COLUMN IF NOT EXISTS "infraCostRub" JSONB;
