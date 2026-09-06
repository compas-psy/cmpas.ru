-- Черновик карточки клиента, разобранной из контакта, пересланного боту.
--
-- Оба бота stateless, а callback_data в Telegram ограничен 64 байтами:
-- имя с телефоном в кнопку не влезают. Поэтому разобранные поля лежат в
-- строке, а кнопка несёт только её id — тем же приёмом, что
-- ClientInviteToken.
--
-- В строке лежат имя и телефон человека, который согласия ещё не давал:
-- отсюда срок жизни в час, погашение через "usedAt" и чистка истёкших.
CREATE TABLE IF NOT EXISTS "ClientIntakeDraft" (
    "id" TEXT NOT NULL,
    "psychologistId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "existingClientId" TEXT,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientIntakeDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClientIntakeDraft_psychologistId_idx" ON "ClientIntakeDraft"("psychologistId");
CREATE INDEX IF NOT EXISTS "ClientIntakeDraft_expiresAt_idx" ON "ClientIntakeDraft"("expiresAt");
