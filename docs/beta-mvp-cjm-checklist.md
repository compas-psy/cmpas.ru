# Beta MVP CJM Checklist

Этот чек-лист дополняет `docs/beta-mvp-execution-plan.md`: карта CJM задаёт полный целевой контур, ТЗ — конкретные задачи. Статусы ниже нужны, чтобы не потерять ни один путь психолога/клиента до beta MVP.

## CJM-1 · Регистрация и onboarding психолога

- [x] Убран implicit accept документов на sign-in.
- [x] Legal gate проверяется до onboarding в diary layout.
- [x] Mobile/web acceptance получают audit snapshot: source, documentType, documentVersion.
- [x] Android legal gate берёт актуальные версии через `/api/mobile/legal/status`.
- [x] Android legal gate требует отдельные explicit checkboxes для TERMS и PRIVACY; ADS optional.
- [x] Web legal gate требует отдельные explicit checkboxes для TERMS и PRIVACY; ADS optional.
- [x] Onboarding без шага-фантома: профиль → расписание → документы → мессенджер → первый клиент → финиш.
- [x] Onboarding сохраняет timezone, sessionBreak, lunch break и cancellationHours через `/api/user/profile`.
- [x] Android bridge: если onboarding не завершён, dashboard показывает «Начните с настройки» без дублирования веб-визарда.
- [ ] Onboarding calendar import preview должен получить полноценный web UI, а не только endpoint/link.

## CJM-2 · Добавление клиента и подключение канала

- [x] Серверный invite-flow существует: token, `/connect/<token>`, каналы, очередь.
- [x] Android API invite request переведён на `channel = auto`.
- [x] Серверный статус каналов теперь MAX-first при рекомендации.
- [x] Web onboarding и генерация invite-ссылки теперь MAX-first.
- [x] Добавлен warning при отсутствии `MAX_BOT_USERNAME`, а не молчаливая недоступность.
- [x] Добавлены admin/cron endpoint протухания invite-токенов и admin conversion metrics.
- [x] Android InviteSheet использует реальный `inviteLink`, QR, share, copy и MAX-first кнопки.
- [x] Live-polling channel status уже есть в `ClientDetailViewModel` и отображается в invite sheet.
- [ ] Deployment-smoke: проверить MAX env и MAX-first на `/connect/<token>` в продовом окружении.

## CJM-3 · Заметки после сессии

- [x] Mobile sessions API уже принимает/возвращает `structuredNotes` и `notesPlain`.
- [x] `previousNotesSummary` строится из structured notes с fallback.
- [x] AI teaser в заметке честно показывает `Скоро ✨ · Хочу первым` и пишет `/api/mobile/feature-interest`.
- [x] Voice: Android записывает локальный m4a, показывает длительность, воспроизводит через player и честно сообщает, что расшифровка будет позже.
- [ ] Smoke: web structured note → Android edit → web read без потерь.

## CJM-4 · Управление днём

- [x] Cron/admin endpoint автозавершения confirmed → completed.
- [x] COMPLETE-1 QA-fix: confirmed → completed только после endTime + 15 минут, pending не трогаем.
- [x] Dashboard и sessions list запускают settle для текущего психолога перед выдачей данных.
- [x] Нудж `session_needs_note` после прошедшей сессии без заметки, бережный текст из ТЗ.
- [x] «Следующая сессия» берётся только из будущих pending/confirmed встреч.
- [x] «Сессии без заметок» считается сразу по completed без 14-дневной задержки.
- [x] Android-карточка прошедшей сессии: заметка + отметка оплаты.

## CJM-5 · Запись, перенос, отмена, оплата

- [x] SEC-1 endpoint miniapp cancellation защищён `clientActionToken` и client ownership.
- [x] Miniapp cancellation теперь соблюдает `cancellationHours` и пишет `client_cancel_attempt`.
- [x] Signed action link `/api/client/session-action?a=cancel` теперь соблюдает `cancellationHours`.
- [x] Telegram callback cancellation теперь соблюдает `cancellationHours`, пишет `client_cancel_attempt` и удаляет событие из календарей только при допустимой отмене.
- [x] MAX callback cancellation теперь соблюдает `cancellationHours`, пишет `client_cancel_attempt` и удаляет событие из календарей только при допустимой отмене.
- [x] `paymentStatus` уже поддерживается mobile API.
- [x] Web payment endpoint `PATCH /api/diary/sessions/[id]/payment` для календаря/session modal.
- [x] Reminder audit: клиентское `-1ч` напоминание есть в cron/settings; Android `-2ч` рассинхрон поиском по коду не обнаружен, `2 часа` остаётся только опцией web-настройки напоминания психологу.
- [ ] Web-кнопки оплаты в календаре/session modal.

## CJM-6 · Расписание с телефона

- [x] `/api/mobile/blocks` пишет в серверный `DiaryBlock`.
- [x] Endpoint поддерживает частичные блокировки `startTime/endTime` и диапазоны дат.
- [x] Android API-модель поддерживает `startTime/endTime`.
- [x] Серверные mobile endpoints `GET /availability` и `PATCH /availability/mode`.
- [x] Android экран расписания показывает режим записи closed/preview/open.
- [x] Android экран расписания показывает read-only неделю: правила + слоты.
- [x] Быстрые действия: сегодня/завтра, отпуск на даты, закончить день раньше.
- [x] Миграция старых локальных блокировок не требуется: в `LocalPracticeStore` нет локальной модели блокировок, только clients/sessions/notes.

## CJM-7 · Уведомления психолога

- [x] `PracticeNotification` таблица уже есть в схеме/deploy fixes.
- [x] Добавлены beta-типы уведомлений: `session_needs_note`, `client_cancel_attempt`, `invite_expired`, `session_unpaid`.
- [x] Dashboard теперь читает persistent notification feed, а не пересобирает историю на лету.
- [x] Документы: opened/acknowledged теперь пишут persistent notifications.
- [x] Android notification sheet: группы «Сегодня/Ранее», deep-link tap, «Прочитать все», локальный read-state.
- [ ] Все события пишут persistent notification.
- [ ] FCM deep-links.
- [ ] Тихие часы 21:00–9:00 + утренняя сводка.

## CJM-8 · Перенос практики и журнал согласий

- [x] Client document page: opened != accepted, согласие только checkbox + button.
- [x] Server action валидирует checkbox.
- [x] API журнала всех доставок документов: клиент, документ, версия, status, канал.
- [x] CSV export с BOM и `documentContentHash`.
- [x] API поиска клиентов со старой версией документа и переотправки актуальной версии.
- [x] Импорт календаря: будущие сессии с предпросмотром и дедупом.
- [x] Web UI журнала документов: общий таб, фильтры «Без согласия» / «Принятые», CSV export.
- [ ] Web UI переотправки клиентам со старой версией прямо из журнала/документа.

## Cross-cutting · Честные будущие функции

- [x] DB migration `FeatureInterest`.
- [x] Mobile endpoint `/api/mobile/feature-interest`.
- [x] Admin counters `/api/admin/feature-interest`.
- [x] Admin UI/table `/admin/feature-interest` for counters.
- [x] Deploy supplement `deploy/beta-mvp-schema-fixes.sql` для новых beta-DDL.
- [x] Deploy script `npm run deploy:schema` применяет legacy schema-fixes, beta schema-fixes и Prisma migrations.
- [x] CPO/QA audit зафиксирован в `docs/beta-mvp-cpo-qa-audit.md`.
- [x] Next sprint plan зафиксирован в `docs/beta-mvp-next-sprint-plan.md`.
- [ ] Web/Android reusable teaser component.

## Перед релизом beta

- [ ] `npm run lint` / `npx tsc`.
- [ ] Android Build CI.
- [ ] Проверка старого APK на `/api/mobile/*` совместимость.
- [ ] Smoke-test: новый психолог → legal → onboarding → первый клиент → invite → документ → первая сессия → заметка → оплата/уведомление.
