-- O-260817-09: consent tied to the client record, not the channel; revocation
-- with a working button; text corrected against legal/CLIENT_CONSENT_BASIS.md.

-- Revocation marker. consentVersion/consentHash/consentDate are never cleared
-- by a revoke — history stays intact, per CJM_booking_v2.md §7 "не голый true".
ALTER TABLE "DiaryClient" ADD COLUMN IF NOT EXISTS "consentRevokedAt" TIMESTAMP(3);

-- Legal pack correction (legal/CLIENT_CONSENT_BASIS.md §2-§3): operator is the
-- psychologist ({psychologistName} is substituted per-psychologist at render
-- time, see src/lib/booking/consent.ts), КОМПАС is the processor acting on the
-- psychologist's instruction, and the revoke instruction now points at the
-- real "Мои записи" button instead of "написать письмо в поддержку" from the
-- 2026-03-07 template. Superseding the active version re-prompts clients on
-- their next visit; the prior consent (old version/hash/date) already saved
-- on DiaryClient rows is not touched. Retention is described by event (until
-- revoked / until the psychologist archives the card), not by a fixed number
-- of days — the legal pack extract in this repo does not give one, and this
-- migration does not invent one (CLAUDE.md §1, "не сочинять").
-- Deactivate every *other* version, not this one — a migration file can in
-- practice be replayed manually during an incident, and Prisma migrations
-- aren't wrapped one-per-transaction across the whole deploy. Naively doing
-- "SET isActive = false WHERE isActive = true" before the insert would, on a
-- second run, turn off the row this same statement had just turned on (the
-- INSERT below no-ops on conflict), silently leaving zero active consent
-- versions — which makes getConsentStatus() report "not required" for
-- everyone. Verified by deliberately re-running this file against a scratch
-- Postgres: without the version exclusion the row ended up inactive.
UPDATE "ConsentVersion" SET "isActive" = false WHERE "isActive" = true AND "version" <> '2026-08-18-v2';

INSERT INTO "ConsentVersion" ("id", "version", "text", "isActive", "createdAt")
VALUES (
    'consent_v2_2026_08_18_client_legal',
    '2026-08-18-v2',
    E'Согласие на обработку персональных данных (шаблон платформы v0.9)\n\nОператор ваших персональных данных — специалист, к которому вы записываетесь ({psychologistName}). Именно он определяет цели и состав обработки. КОМПАС (cmpas.ru) обрабатывает эти данные по поручению специалиста, как технический обработчик, и не использует их в собственных целях: ни для рекламы, ни для передачи в другие сервисы.\n\nСостав данных: имя, телефон, дата и время записи. Больше на этапе записи не собирается ничего.\n\nЦель: чтобы специалист мог подтвердить, перенести или отменить встречу с вами и связаться с вами по поводу записи.\n\nСрок хранения: пока действует это согласие или пока специалист ведёт вашу карточку в КОМПАС.\n\nКак отозвать: на странице «Мои записи» есть кнопка «Отозвать согласие». После отзыва новая запись через эту страницу недоступна, пока согласие не будет дано заново; уже состоявшиеся встречи и их история никуда не исчезают.\n\nЭто согласие не является принятием Политики конфиденциальности КОМПАС — она отдельный информационный документ о том, как устроена платформа, и отдельного принятия не требует.',
    true,
    now()
)
ON CONFLICT ("version") DO NOTHING;

-- Belt and suspenders: whatever happened above, this version must end up active.
UPDATE "ConsentVersion" SET "isActive" = true WHERE "version" = '2026-08-18-v2';
