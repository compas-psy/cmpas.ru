-- Задача 18: безопасный вывод кабинета из работы вместо удаления строки.
-- Удаление PsychologistAddress обнуляет DiarySession."addressId"
-- (onDelete: SetNull) — прошедшие сессии теряют место встречи. Флаг
-- позволяет убрать кабинет из выбора, ничего не разрушая.
ALTER TABLE "PsychologistAddress" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "PsychologistAddress_psychologistId_isActive_idx" ON "PsychologistAddress"("psychologistId", "isActive");
