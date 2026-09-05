# Task 28 · База: свежая копия, restore, настоящая история миграций

Прогоны, а не пересказ:

| Что | Прогон |
|---|---|
| Снятие свежей копии | `33981239408` |
| Разведка сервера (только чтение) | `33981651383` |
| Restore + миграции, первый заход | `33982893873` (нашёл две ошибки в самой проверке) |
| Restore + миграции, итоговый | **`33983970525` — success** |

Боевых данных в этом каталоге нет и быть не может: проверка целиком идёт
на сервере, во временной базе того же кластера, наружу отдаются только
числа. Временная база удаляется в любом исходе, `cmpas_db` не пишется.

## §2 Свежая копия

```
файл:    cmpas_db_2026-09-05_203323.dump
размер:  6 415 434 байт
объектов внутри (pg_restore --list): 366
проверка читаемости: пройдена на сервере сразу после снятия
возраст на момент restore: 0 ч
```

Строки главных таблиц на момент снятия: User 16, DiaryClient 22,
DiarySession 44, Payment 9.

## §2 Restore в отдельную production-like базу

```
СУБД:            PostgreSQL 15.15 (тот же кластер, что и боевая база)
временная база:  cmpas_rc28_1788632694 (создана и удалена прогоном)
pg_restore:      код возврата 0, строк с error — 0
таблиц после restore: 57
```

## §3 Production-style deploy по НАСТОЯЩЕМУ `_prisma_migrations`

Команда — та же, что у выкладки:
`node node_modules/prisma/build/index.js migrate deploy`, запущенная в
образе приложения `cmpasru-app`, поверх которого смонтированы `prisma/` и
`scripts/` версии release candidate.

```
до deploy:  39 записей в журнале, 0 незавершённых
найдено миграций в выпуске: 51
применено за первый заход: 12
код возврата: 0
"All migrations have been successfully applied."
после deploy: 51 запись, незавершённых и откаченных — 0
```

**Про контрольные суммы.** Задача 26 меняла два уже применённых файла
миграций (`20260118_add_orders`, `20260531_configurable_documents_payments`).
На настоящем журнале боевой базы Prisma **не сказала о них ничего**: ни
ошибки, ни предупреждения о checksum, ни drift. Прогон отдельно ищет в
выводе слова checksum / modified / drift / failed migration — не нашёл
ни одного. Это и есть ответ, которого Задача 26 дать не могла: там
история моделировалась, здесь она настоящая.

Применённые за этот заход миграции:

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
```

## §2 Проверка схемы до и после

`verify-production-schema.js`, код возврата (а не слово в выводе):

```
ДО миграций:    не 0 — и перечислено, чего боевой схеме не хватает:
                DiarySession.clientNotificationsEnabled,
                CalendarSessionLink (таблицы нет),
                PracticeImportBatch (таблицы нет),
                PracticeImportItem (таблицы нет),
                PsychologistSettings.bookingLinkSharedAt,
                PsychologistSettings.onboardingDismissedAt,
                PsychologistAddress.isActive

ПОСЛЕ миграций: 0
                «Все 57 таблиц и их колонки на месте»
                чтение User / DiaryClient / DiarySession через Prisma прошло
                незавершённых записей в журнале нет
```

## §4 Идемпотентность

```
второй migrate deploy: "No pending migrations to apply.", код возврата 0
```

## Данные пережили миграции

```
до:    User=16 DiaryClient=22 DiarySession=44 PsychologistAddress=4 AvailabilitySlot=112 ScheduleRule=11
после: User=16 DiaryClient=22 DiarySession=44 PsychologistAddress=4 AvailabilitySlot=112 ScheduleRule=11
```

Опорная запись Задачи 0 `cmtl7k6pw008gxppuhxzz5pj8`: была 1, стала 1,
кабинет ей не назначен (`addressId` пуст), сиротой не стала.

Сироты после миграций — везде 0: `CalendarSessionLink` без сессии,
`PracticeImportItem` без партии, `PracticeOperatorAttestation` без
пользователя.

Значения по умолчанию сохранили смысл:

```
сессий с origin IS NULL:                0
практик с bookingLinkSharedAt:          0
практик с onboardingDismissedAt:        0
практик с onboardingCompleted = true:  11
```

Последние три строки — ровно то требование Задачи 26, которое раньше
проверялось на выдуманной базе: одиннадцать практик со СТАРЫМ флагом
`onboardingCompleted` НЕ получили новых отметок. Старый веб-визард не
подменяет собой новое состояние онбординга — теперь это видно на живых
данных.

## Итог

```
провалов: 0
RESTORE+MIGRATION: PASS
```
