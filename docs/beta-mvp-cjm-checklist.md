# Beta MVP CJM Checklist

Этот чек-лист дополняет `docs/beta-mvp-execution-plan.md`: карта CJM задаёт полный целевой контур, ТЗ — конкретные задачи. Статусы ниже отражают фактическое состояние кода, а не только наличие заготовок.

## CJM-1 · Регистрация и onboarding психолога

- [x] Убран implicit accept документов на sign-in.
- [x] Legal gate проверяется до onboarding в diary layout.
- [x] Android legal status берёт актуальные версии TERMS / PRIVACY / ADS с сервера.
- [x] TERMS и PRIVACY — отдельные обязательные чекбоксы; ADS остаётся на первом экране, но необязателен.
- [x] Gate возникает только при непринятых TERMS/PRIVACY; отсутствие ADS само по себе окно не открывает.
- [x] Сохранение TERMS/PRIVACY отделено от best-effort сохранения ADS: ошибка рекламы не блокирует вход.
- [x] Документы открываются во встроенном Android viewer; возврат ведёт обратно к согласиям с сохранёнными чекбоксами.
- [x] Web legal gate требует отдельные explicit checkboxes для TERMS и PRIVACY; ADS optional.
- [x] Onboarding без шага-фантома: профиль → расписание → документы → мессенджер → первый клиент → финиш.
- [x] Onboarding сохраняет timezone, sessionBreak, lunch break и cancellationHours через `/api/user/profile`.
- [x] Android bridge: если onboarding не завершён, dashboard показывает «Начните с настройки» без дублирования веб-визарда.
- [ ] Применить и проверить audit-DDL для `LegalDocumentAcceptance.source/documentType/documentVersion` во всех окружениях и синхронизировать Prisma schema.
- [ ] Заменить `{{ОГРНИП}}` и `{{ИНН}}` в публичных legal-документах реальными реквизитами; сверить web-тексты с утверждёнными DOCX.
- [ ] Onboarding calendar import preview должен получить полноценный web UI, а не только endpoint/link.

## CJM-2 · Добавление клиента и подключение канала

- [x] Серверный invite-flow существует: token, `/connect/<token>`, каналы, очередь.
- [x] Android API invite request переведён на `channel = auto`.
- [x] Серверный статус каналов теперь MAX-first при рекомендации.
- [x] Web onboarding и генерация invite-ссылки теперь MAX-first.
- [x] Добавлен warning при отсутствии `MAX_BOT_USERNAME`, а не молчаливая недоступность.
- [x] Добавлены admin/cron endpoint протухания invite-токенов и admin conversion metrics.
- [x] Android InviteSheet использует реальный `inviteLink`, QR, share, copy и MAX-first кнопки.
- [x] Live-polling channel status отображается в invite sheet.
- [ ] Deployment-smoke: проверить MAX env и MAX-first на `/connect/<token>` в продовом окружении.

## CJM-3 · Заметки после сессии

- [x] Mobile sessions API принимает/возвращает `structuredNotes` и `notesPlain`.
- [x] `previousNotesSummary` строится из structured notes с fallback.
- [x] AI teaser показывает `Скоро ✨ · Хочу первым` и пишет `/api/mobile/feature-interest`.
- [ ] Voice: настоящая локальная m4a-запись и player откатаны ради восстановления Android build; сейчас остаётся только честный локальный черновик без аудиофайла.
- [ ] Smoke: web structured note → Android edit → web read без потерь.

## CJM-4 · Управление днём

- [x] Cron/admin endpoint автозавершения confirmed → completed.
- [x] COMPLETE-1: confirmed → completed только после endTime + 15 минут; pending не трогаем.
- [x] Dashboard и sessions list пытаются выполнить settle, но не скрывают данные при ошибке maintenance.
- [x] Нудж `session_needs_note` после прошедшей сессии без заметки.
- [x] «Следующая сессия» берётся только из будущих pending/confirmed встреч.
- [x] «Сессии без заметок» считается по completed.
- [x] Android-карточка прошедшей сессии: заметка + отметка оплаты.

## CJM-5 · Запись, перенос, отмена, оплата

- [x] SEC-1 endpoint miniapp cancellation защищён `clientActionToken` и client ownership.
- [x] Miniapp, signed link, Telegram callback и MAX callback используют `cancellationHours` и `canClientCancel`.
- [x] Поздняя попытка отмены пишет `client_cancel_attempt`, но не меняет сессию.
- [x] `paymentStatus` поддерживается mobile API.
- [x] Web payment GET/PATCH endpoint.
- [x] Web session modal: `Не требуется / Ожидает / Оплачено`, с текстом «КОМПАС только фиксирует отметку».
- [x] Reminder audit: клиентское `-1ч` напоминание есть; отдельный Android `-2ч` путь не обнаружен.
- [ ] Smoke всех четырёх путей отмены на реальных Telegram/MAX сообщениях.
- [ ] Calendar right rail: продублировать быстрые кнопки оплаты вне modal — optional UX.

## CJM-6 · Расписание с телефона

- [x] `/api/mobile/blocks` пишет в серверный `DiaryBlock`.
- [x] Endpoint поддерживает частичные блокировки и диапазоны дат.
- [x] Android API-модель поддерживает `startTime/endTime`.
- [x] Серверные mobile endpoints `GET /availability` и `PATCH /availability/mode`.
- [x] Android экран показывает режим записи, read-only неделю и быстрые блокировки.
- [x] Миграция старых локальных блокировок не требуется: локальной модели блокировок не было.

## CJM-7 · Уведомления психолога

- [x] `PracticeNotification` таблица существует.
- [x] Добавлены beta-типы: `session_needs_note`, `client_cancel_attempt`, `invite_expired`, `session_unpaid`.
- [x] Dashboard читает persistent notification feed.
- [x] Документы opened/acknowledged пишут persistent notifications.
- [x] Android notification sheet: «Сегодня/Ранее», переход к сущности, «Прочитать все».
- [ ] Все продуктовые события пишут persistent notification.
- [ ] FCM registration и проверенные deep-links.
- [ ] Тихие часы 21:00–9:00 + утренняя сводка.

## CJM-8 · Перенос практики и журнал согласий

- [x] Client document page: opened != accepted, согласие только checkbox + button.
- [x] Server action валидирует checkbox.
- [x] API журнала доставок: клиент, документ, версия, status, канал.
- [x] CSV export с BOM и `documentContentHash`.
- [x] Поиск клиентов со старой версией и resend актуальной версии.
- [x] Импорт календаря: endpoints будущих сессий с предпросмотром и дедупом.
- [x] Web UI журнала: фильтры и CSV export.
- [x] Web UI «Старые версии» запускает resend.
- [ ] Smoke реальной доставки после resend и записи результата в журнале.

## Cross-cutting

- [x] `FeatureInterest`: migration, mobile endpoint, admin counters/UI.
- [x] Deploy supplement `deploy/beta-mvp-schema-fixes.sql` и `npm run deploy:schema` добавлены.
- [x] CPO/QA audit и next sprint plan зафиксированы.
- [ ] Проверить, что deploy script реально применяется до запуска новой версии API.
- [ ] Web/Android reusable AI teaser component.

## Перед релизом beta

- [ ] Зелёный `npm run lint` / `npx tsc` / `npm run build`.
- [ ] Зелёный Android Build CI и доступный build log.
- [ ] Legal smoke: открыть все 3 документа → вернуться → принять только ПС/ПК → войти; повторить с ADS.
- [ ] Проверка старого APK на `/api/mobile/*` совместимость.
- [ ] Full smoke: legal → onboarding → клиент → invite → документ → сессия → заметка → оплата → уведомление → отмена.
