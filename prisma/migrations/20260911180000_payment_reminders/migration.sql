-- Напоминание об оплате перед сессией.
--
-- Решение учредителя 11.09.2026: «отправлять перед первой или последующими
-- сессиями ссылку на оплату нужно. Интервал за сколько до сессии отправлять
-- выбирает психолог». Отсюда две колонки: включено ли напоминание и за
-- сколько часов до встречи оно уходит.
--
-- Выключено по умолчанию: включать за человека рассылку его клиентам нельзя.
-- Сутки — значение по умолчанию для тех, кто включит и не станет выбирать.
ALTER TABLE "PsychologistPaymentSettings"
    ADD COLUMN IF NOT EXISTS "paymentReminderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PsychologistPaymentSettings"
    ADD COLUMN IF NOT EXISTS "paymentReminderHoursBefore" INTEGER NOT NULL DEFAULT 24;

-- Чем вызвана запись о просьбе оплатить: сообщением при заведении клиента
-- («manual») или напоминанием перед сессией («reminder»). Без этого различия
-- напоминание не может понять, уходило ли ОНО по этой сессии: строка от
-- сообщения о записи выглядела бы точно так же, и клиент остался бы без
-- напоминания вовсе.
ALTER TABLE "SessionPaymentRequest"
    ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS "SessionPaymentRequest_sessionId_kind_idx"
    ON "SessionPaymentRequest"("sessionId", "kind");
