# Beta MVP CJM Checklist

Этот чек-лист дополняет `docs/beta-mvp-execution-plan.md`: карта CJM задаёт полный целевой контур, ТЗ — конкретные задачи. Статусы ниже нужны, чтобы не потерять ни один путь психолога/клиента до beta MVP.

## CJM-1 · Регистрация и onboarding психолога

- [x] Убран implicit accept документов на sign-in.
- [x] Legal gate проверяется до onboarding в diary layout.
- [x] Mobile/web acceptance получают audit snapshot: source, documentType, documentVersion.
- [ ] Единый web-экран legal gate: TERMS + PRIVACY обязательные, ADS отдельный optional.
- [ ] Android legal gate должен брать те же версии через `/api/mobile/legal/status`.
- [ ] Onboarding: убрать фантомный шаг, сохранять все поля, добавить документы/мессенджер/первого клиента.

## CJM-2 · Добавление клиента и подключение канала

- [x] Серверный invite-flow существует: token, `/connect/<token>`, каналы, очередь.
- [x] Android API invite request переведён на `channel = auto`.
- [x] Серверный статус каналов теперь MAX-first при рекомендации.
- [x] Добавлен warning при отсутствии `MAX_BOT_USERNAME`, а не молчаливая недоступность.
- [x] Добавлены admin/cron endpoint протухания invite-токенов и admin conversion metrics.
- [x] Android InviteSheet использует реальный `inviteLink`, QR, share, copy и MAX-first кнопки.
- [x] Live-polling channel status уже есть в `ClientDetailViewModel` и отображается в invite sheet.
- [ ] Проверить MAX-first во всех поверхностях UI.

## CJM-3 · Заметки после сессии

- [x] Mobile sessions API уже принимает/возвращает `structuredNotes` и `notesPlain`.
- [x] `previousNotesSummary` строится из structured notes с fallback.
- [x] AI teaser в заметке честно показывает `Скоро ✨ · Хочу первым` и пишет `/api/mobile/feature-interest`.
- [ ] Android UI: убедиться, что web-structured заметка полностью восстанавливается в полях.
- [ ] Voice: заменить локальный флаг на настоящую запись m4a + player.

## CJM-4 · Управление днём

- [x] Cron/admin endpoint автозавершения confirmed → completed.
- [x] Dashboard и sessions list запускают settle для текущего психолога перед выдачей данных.
- [x] Нудж `session_needs_note` после прошедшей сессии без заметки.
- [x] «Следующая сессия» берётся только из будущих pending/confirmed встреч.
- [x] «Сессии без заметок» считается сразу по completed без 14-дневной задержки.
- [x] Android-карточка прошедшей сессии: заметка + отметка оплаты.

## CJM-5 · Запись, перенос, отмена, оплата

- [x] SEC-1 endpoint miniapp cancellation защищён `clientActionToken` и client ownership.
- [x] Miniapp cancellation теперь соблюдает `cancellationHours` и пишет `client_cancel_attempt`.
- [x] Signed action link `/api/client/session-action?a=cancel` теперь соблюдает `cancellationHours`.
- [x] `paymentStatus` уже поддерживается mobile API.
- [ ] Политика отмены N часов во всех 4 клиентских каналах.
- [ ] Web-кнопки оплаты в календаре/session modal.
- [ ] Android QuickAction payment stub окончательно убрать из быстрых действий.
- [ ] Единый текст напоминаний `-1ч`, убрать рассинхрон Android `-2ч`.

## CJM-6 · Расписание с телефона

- [x] `/api/mobile/blocks` пишет в серверный `DiaryBlock`.
- [x] Endpoint поддерживает частичные блокировки `startTime/endTime` и диапазоны дат.
- [x] Android API-модель поддерживает `startTime/endTime`.
- [x] Серверные mobile endpoints `GET /availability` и `PATCH /availability/mode`.
- [x] Android экран расписания показывает режим записи closed/preview/open.
- [x] Android экран расписания показывает read-only неделю: правила + слоты.
- [ ] Быстрые действия: сегодня/завтра, отпуск на даты, закончить день раньше.
- [ ] Миграция старых локальных блокировок на сервер.

## CJM-7 · Уведомления психолога

- [x] `PracticeNotification` таблица уже есть в схеме/deploy fixes.
- [x] Добавлены beta-типы уведомлений: `session_needs_note`, `client_cancel_attempt`, `invite_expired`, `session_unpaid`.
- [x] Dashboard теперь читает persistent notification feed, а не пересобирает историю на лету.
- [ ] Все события пишут persistent notification.
- [ ] FCM deep-links.
- [ ] Тихие часы 21:00–9:00 + утренняя сводка.
- [ ] Android full-screen notification sheet вместо alert.

## CJM-8 · Перенос практики и журнал согласий

- [x] Client document page: opened != accepted, согласие только checkbox + button.
- [x] Server action валидирует checkbox.
- [x] API журнала всех доставок документов: клиент, документ, версия, status, канал.
- [x] CSV export с BOM.
- [ ] Новая версия договора → предложить переотправку клиентам со старой версией.
- [ ] Импорт календаря: будущие сессии с предпросмотром и дедупом.

## Cross-cutting · Честные будущие функции

- [x] DB migration `FeatureInterest`.
- [x] Mobile endpoint `/api/mobile/feature-interest`.
- [x] Admin counters `/api/admin/feature-interest`.
- [x] Deploy supplement `deploy/beta-mvp-schema-fixes.sql` для новых beta-DDL.
- [ ] Web/Android reusable teaser component.
- [ ] Admin UI/table for counters.
- [ ] Влить beta-DDL непосредственно в `deploy/schema-fixes.sql` после CI-проверки миграций.

## Перед релизом beta

- [ ] `npm run lint` / `npx tsc`.
- [ ] Android Build CI.
- [ ] Проверка старого APK на `/api/mobile/*` совместимость.
- [ ] Smoke-test: новый психолог → legal → onboarding → первый клиент → invite → документ → первая сессия → заметка → оплата/уведомление.
