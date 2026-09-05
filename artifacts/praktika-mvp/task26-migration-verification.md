# Task 26 — проверка миграций и схемы

Дата прогона: 2026-09-05. Ветка: `feat/praktika-mvp-launch`.

Задача не про новую функциональность. Нужно было доказать, что накопленный
набор миграций Задач 0–25 безопасно применяется и на чистую базу, и на
существующую практику, что повторный прогон ничего не меняет и что данные не
теряются.

Все данные ниже синтетические. Настоящих имён, телефонов, почт, дампов и
строк подключения здесь нет: тестовые базы одноразовые, локальные, созданы и
удаляются в рамках прогона.

---

## Коротко

Проверка нашла три вещи, из-за которых **чистая база не собиралась вообще** —
`prisma migrate deploy` на пустой базе обрывался на третьей миграции. Все три
исправлены, после чего вся цепочка проходит с нуля, а существующая практика
обновляется без потерь.

| Проверка | Результат |
|---|---|
| `npx prisma validate` | PASS |
| `npx prisma generate` | PASS |
| все миграции на чистую базу | PASS (51 миграция) |
| `verify-production-schema.js` на чистой базе | PASS (57 таблиц) |
| повторный apply на чистой базе | NO-OP, отпечаток схемы не изменился |
| апгрейд существующей практики | PASS (12 миграций) |
| sentinel-строки до/после апгрейда | совпадают полностью |
| значения по умолчанию | смысл старых записей сохранён |
| `verify-production-schema.js` после апгрейда | PASS |
| повторный apply после апгрейда | NO-OP, схема и данные не изменились |
| orphan CalendarSessionLink | 0 |
| orphan PracticeImportItem | 0 |
| orphan PracticeOperatorAttestation | 0 |

---

## Окружение

```
node v22.22.2
psql (PostgreSQL) 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)
postgres server 16.13
prisma 5.22.0 / @prisma/client 5.22.0
```

Две одноразовые локальные базы, обе создаются пустыми в начале прогона:

* `task26_fresh` — чистая база;
* `task26_upgrade` — существующая практика «как до новых миграций».

Боевая база не использовалась и не была доступна из среды прогона.

---

## Что было сломано и что исправлено

### 1. У цепочки не было основания

На пустой базе `prisma migrate deploy` падал:

```
Migration name: 20260215171500_add_diary_models
ERROR: relation "User" does not exist
```

Двенадцать таблиц — `User`, `Account`, `Session`, `VerificationToken`,
`TelegramClient`, `NotificationSettings`, `AuditLog`, `Homework`,
`TherapyGoal`, `ClientAssessment`, `ClientCheckIn`, `ClientRisk` — не создаёт
ни одна миграция. И не создавала: схема доехала до базы через
`prisma db push`, а журнал миграций завели позже, отметив всё уже применённым
(`scripts/db-baseline.sh`). Цепочка умела достраивать существующую базу и не
умела построить новую.

То же самое обнаружилось на уровне колонок: заметки по сессии
(`structuredNotes`, `privateNotes`, `clientSummary`), признаки отправленных
напоминаний (`notified24h`, `notified1h`, `postSessionNudged`), параметры
правила расписания (`format`, `duration`, `breakDuration`, `audienceFilter`,
`addressId`, `startDate`, `endDate`), `scheduleMode`, `bookingBufferHours`,
`bookingHorizonDays`, `telegramChatId`, `isCompleted` — объявлены схемой, но
не создаются ни одной миграцией.

Прод от этого не страдает. Страдает всё остальное: чистая база в CI,
восстановление из ничего, второй контур, машина нового разработчика. База,
которую нельзя построить заново, — это не свойство схемы, а отсутствие пути
назад.

Добавлены три миграции:

* `00000000000000_baseline_pre_migration_tables` — двенадцать таблиц в том
  виде, в каком они были ДО цепочки. У `User` намеренно нет двенадцати
  колонок, которые добавляют более поздние миграции: шесть из этих `ALTER …
  ADD COLUMN` идут без `IF NOT EXISTS` и упали бы на дубле;
* `20260905130000_baseline_pre_migration_foreign_keys` — четырнадцать внешних
  ключей этих таблиц. Отдельной миграцией в конце цепочки, потому что
  половина смотрит на `DiaryClient` и `DiarySession`, которых в начале ещё
  нет. Каждый ключ ставится через проверку `pg_constraint`;
* `20260905140000_baseline_missing_columns` — недостающие колонки и два
  индекса. Список получен не на глаз, а сверкой `prisma migrate diff` между
  собранной с нуля базой и `schema.prisma`.

Все три идемпотентны: на существующей базе не делают ничего.

### 2. Две миграции ссылались на таблицы, которых на их шаге ещё нет

`prisma` применяет миграции в лексикографическом порядке имён каталогов, и в
двух местах порядок оказался обратным зависимости:

* `20260118_add_orders` добавлял GEO-колонки в `VisitorAnalytics` — таблицу,
  которую создаёт следующий по алфавиту `20260118_add_visitor_analytics`;
* `20260531_configurable_documents_payments` добавлял семь колонок в
  `PsychologistClientDocument` — таблицу, которую создаёт следующий по
  алфавиту `20260531_specialist_client_documents`.

Обе на чистой базе падали с `relation … does not exist`. На проде это было
незаметно: там обе таблицы появились раньше, вне цепочки.

Исправлено переносом statements к своим таблицам. Это правка уже применённых
миграций — по правилу Задачи 26 такое допустимо только при реальной
необходимости, и здесь она есть: сбой происходит на первой трети цепочки, и
никакая новая corrective-миграция в конце до него не доживёт.

Безопасность правки проверена отдельно: `prisma migrate deploy` **не сверяет
контрольные суммы уже применённых миграций**. Изменённый файл применённой
миграции даёт `No pending migrations to apply` без единого предупреждения
(проверено экспериментально на `task26_upgrade`). На проде обе миграции давно
в журнале и повторно не выполняются.

### 3. `verify-production-schema.js` давал ложный PASS по пяти таблицам

Проверка берёт ожидаемые колонки из `Prisma.dmmf`, а пять таблиц продукта
живут только в SQL миграций и в `schema.prisma` не описаны:
`SessionPaymentRequest`, `PsychologistPaymentSettings`,
`PsychologistClientDocument`, `ClientDocumentDelivery`, `FeatureInterest`.
Из них в историческом якоре `REQUIRED_COLUMNS` стояла одна `FeatureInterest`
— остальные четыре не проверялись никак: пропади они, проверка отрапортовала
бы «всё на месте», а оплата и документы клиенту сломались бы у человека.

Четыре таблицы добавлены в `REQUIRED_COLUMNS`. Новый инструмент не строился —
дополнен существующий.

---

## A. Статическая проверка

```
$ node --version
v22.22.2
$ npx prisma validate
The schema at prisma/schema.prisma is valid 🚀
$ npx prisma generate
Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client
```

## B. Чистая база

```
$ npx prisma migrate deploy          # DATABASE_URL → task26_fresh
51 migrations found in prisma/migrations
All migrations have been successfully applied.

$ node scripts/verify-production-schema.js
[schema] Все 57 таблиц и их колонки на месте.
[schema] Чтение User через клиент Prisma прошло.
[schema] Чтение DiaryClient через клиент Prisma прошло.
[schema] Чтение DiarySession через клиент Prisma прошло.
[schema] Prisma migration history has no unfinished entries.
exit=0
```

Повторный apply:

```
No pending migrations to apply.
отпечаток схемы до:    f6b2a6ed64b800806842db747aaab182
отпечаток схемы после: f6b2a6ed64b800806842db747aaab182
СХЕМА НЕ ИЗМЕНИЛАСЬ
записей в журнале: 51 -> 51
```

Отпечаток — md5 от всех `table_name + column_name + column_default +
is_nullable` схемы `public`.

## C. Существующая практика

База собрана как прод: `prisma db push` схемы ветки `main`, затем сырые
объекты, которых нет в `schema.prisma` (`PsychologistClientDocument`,
`ClientDocumentDelivery`, `PsychologistPaymentSettings`,
`SessionPaymentRequest`, `FeatureInterest`, `DiarySession.paymentStatus`),
затем 39 миграций ветки `main` помечены применёнными через
`prisma migrate resolve --applied` — ровно то, что делает
`scripts/db-baseline.sh`.

Засеяно синтетическое связное хозяйство: специалист, настройки, клиент, два
приёма, кабинет, правило расписания, окно доступности, интеграция календаря,
юридический документ и согласие на него.

Применилось 12 миграций:

```
00000000000000_baseline_pre_migration_tables
20260829150000_enable_time_suggest
20260903120000_legal_canonical_codes
20260903130000_practice_attestation_consent_events
20260903140000_session_origin
20260903150000_client_notifications_enabled
20260903160000_calendar_session_link_import_batch
20260904090000_practice_import_source_fingerprint
20260904120000_psychologist_address_is_active
20260905120000_practice_onboarding_state
20260905130000_baseline_pre_migration_foreign_keys
20260905140000_baseline_missing_columns
All migrations have been successfully applied.
```

### Sentinel-строки до и после

Сверяются конкретные идентификаторы, а не `COUNT(*)` по таблице.

```
      row       |            id             |         detail
----------------+---------------------------+-------------------------
 Acceptance     | task26-acc-0001           | task26-psy-0001
 Address        | task26-address-0001       | Кабинет 1
 Client         | task26-client-0001        | Клиент Один
 Integration    | task26-integration-0001   | google
 LegalDoc       | task26-doc-terms          | TERMS
 ScheduleRule   | task26-rule-0001          | Будни
 Session future | cmtl7k6pw008gxppuhxzz5pj8 | <null addressId>
 Session past   | task26-session-0002       | task26-address-0001
 Settings       | task26-settings-0001      | Europe/Moscow
 Slot           | task26-slot-0001          | 09:00-13:00
 User           | task26-psy-0001           | psy-0001@task26.invalid

ВСЕ SENTINEL-СТРОКИ СОВПАДАЮТ ДО И ПОСЛЕ
```

`cmtl7k6pw008gxppuhxzz5pj8` — идентификатор из baseline Задачи 0: будущая
очная сессия без кабинета. Строка здесь синтетическая, настоящий только
идентификатор, и проверялось ровно одно: миграция её не теряет, не удаляет и
не назначает ей кабинет самовольно. `addressId` остался `NULL` — схема это
разрешает, и это существующий факт о данных, а не поломка миграции.

### Значения по умолчанию на старых строках

```
                  check                  |      value
-----------------------------------------+------------------
 DiarySession.origin (обе строки)        | manual
 DiarySession.clientNotificationsEnabled | true
 DiarySession.paymentStatus (прошедшая)  | unpaid
 DiarySession.addressId (будущая очная)  | NULL — сохранён
 PsychologistAddress.isActive            | true
 AvailabilitySlot.isActive               | true
 AvailabilitySlot.scheduleRuleId         | task26-rule-0001
 ScheduleRule.isActive                   | true
 Settings.onboardingCompleted (старое)   | true
 Settings.bookingLinkSharedAt (новое)    | NULL
 Settings.onboardingDismissedAt (новое)  | NULL
 Settings.timeSuggestEnabled (backfill)  | true
 LegalDocument.code (backfill)           | cmpas_terms
 Acceptance.documentCode (backfill)      | cmpas_terms
 CalendarIntegration.isActive            | false
 CalendarIntegration.syncFrom            | true
```

Главное здесь — три строки подряд: у специалиста `onboardingCompleted = true`,
а оба новых поля Задачи 24 остались `NULL`. Старый флаг не перетёк в новые
поля: «поделился ссылкой» и «скрыл подсказку» — это не то же самое, что
«когда-то прошёл старый визард», и после миграции они по-прежнему означают
«не делился» и «не скрывал».

Существующие приёмы получили `origin = manual` и
`clientNotificationsEnabled = true` — то есть ровно прежнее поведение:
созданы специалистом, уведомления клиенту разрешены. Кабинет остался
действующим. Отметка оплаты не тронута.

Два `UPDATE` в миграциях сработали как задумано: `timeSuggestEnabled`
переключился в `true` (`20260829150000_enable_time_suggest`), канонические
коды документов проставились (`20260903120000_legal_canonical_codes`).

### Повторный apply

```
No pending migrations to apply.
СХЕМА НЕ ИЗМЕНИЛАСЬ
ДАННЫЕ DiarySession НЕ ИЗМЕНИЛИСЬ
строк: User=1 DiaryClient=1 DiarySession=2 PsychologistAddress=1
```

Данные сверялись md5 по всем колонкам всех строк `DiarySession`, а не только
по количеству.

## D. Orphan-проверки

Проверки прогнаны на обеих базах. Чтобы «0 сирот» не оказалось следствием
пустых таблиц, в новые таблицы предварительно засеяны корректные строки:

```
           таблица           | строк
-----------------------------+-------
 CalendarSessionLink         |     1
 ConsentEvent                |     1
 PracticeImportBatch         |     1
 PracticeImportItem          |     1
 PracticeOperatorAttestation |     1
```

Результат:

```
                             check                              | orphan_rows
----------------------------------------------------------------+-------------
 CalendarSessionLink → отсутствующая DiarySession               |           0
 CalendarSessionLink → отсутствующая CalendarIntegration        |           0
 CalendarSessionLink → чужая сессия (psychologist mismatch)     |           0
 CalendarSessionLink → чужая интеграция (psychologist mismatch) |           0
 PracticeImportItem → отсутствующий PracticeImportBatch         |           0
 PracticeImportItem → созданная сессия чужого психолога         |           0
 PracticeImportItem → созданный клиент чужого психолога         |           0
 PracticeImportBatch → отсутствующий User                       |           0
 PracticeOperatorAttestation → отсутствующий User               |           0
 ConsentEvent → отсутствующий User                              |           0
```

## E. Остаточное расхождение чистой базы со схемой

`prisma migrate diff` между собранной с нуля базой и `schema.prisma` не
показывает ни одного `[+]` — всё, что схема требует, в базе есть. Остаются
только объекты, которых в базе БОЛЬШЕ, чем в схеме, и все они есть и на проде:

* пять сырых таблиц (`ClientDocumentDelivery`, `FeatureInterest`,
  `PsychologistClientDocument`, `PsychologistPaymentSettings`,
  `SessionPaymentRequest`) с их внешними ключами;
* `DiarySession.paymentStatus` и индекс по нему;
* индекс `PsychologistAddress(psychologistId, isActive)` из Задачи 21;
* шесть исторических колонок `User`: `adsConsent*`, `pdnConsent*`;
* серверный `DEFAULT now()` у `Payment.updatedAt`;
* имя индекса `PracticeOperatorAttestation_psychologistId_attestationCode_wo_key`
  — PostgreSQL обрезает идентификаторы до 63 символов, и захардкоженное в
  миграции имя отличается от того, которое сгенерировал бы Prisma. Косметика.

Это исторический долг схемы, а не риск миграций, и Задача 26 его не чистит.

---

## Наблюдение без изменения кода

Комментарий в `20260829150000_enable_time_suggest` утверждает: «повторный
прогон миграции не переспорит это решение». Это неверно: условие
`WHERE "timeSuggestEnabled" = false` выбирает ровно те строки, где флаг
осознанно выключили, и повторный прогон включил бы его обратно. Практического
риска нет — Prisma не выполняет миграцию дважды, что и подтверждено разделом
про повторный apply. Комментарий не тронут: правка чужого текста ради
точности формулировки в задачу не входит.

---

## Как воспроизвести

```bash
# две одноразовые базы
createdb task26_fresh && createdb task26_upgrade

# A
node --version && npx prisma validate && npx prisma generate

# B — чистая база
DATABASE_URL=<task26_fresh> npx prisma migrate deploy
DATABASE_URL=<task26_fresh> node scripts/verify-production-schema.js
DATABASE_URL=<task26_fresh> npx prisma migrate deploy      # ожидается no-op

# C — существующая практика
DATABASE_URL=<task26_upgrade> npx prisma db push --schema=<schema.prisma ветки main>
#   + сырые объекты и `migrate resolve --applied` для 39 миграций main
#   + синтетический seed
DATABASE_URL=<task26_upgrade> npx prisma migrate deploy
DATABASE_URL=<task26_upgrade> node scripts/verify-production-schema.js
DATABASE_URL=<task26_upgrade> npx prisma migrate deploy    # ожидается no-op

# E
npx prisma migrate diff --from-url <task26_fresh> --to-schema-datamodel prisma/schema.prisma
```

## Прогон приложения после правок

```
vitest   1449 passed | 3 skipped
tsc      39 ошибок (базовый уровень, без изменений)
lint     779 problems (базовый уровень, без изменений)
```
