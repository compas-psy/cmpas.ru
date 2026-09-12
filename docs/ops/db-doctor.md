# Состояние базы на боевом сервере

Снято прогоном 34721620447. Файл перезаписывается каждой диагностикой.

```
Warning: Permanently added '45.144.30.190' (ED25519) to the list of known hosts.
### Журнал миграций существует?
t
### Записей в журнале
60
### Незавершённых миграций
0
### Последние 20 записей журнала
20260911180000_payment_reminders  finished=2026-09-11 20:37:32.187019+00
20260911150000_session_no_show_reason  finished=2026-09-11 14:50:33.791452+00
20260911100000_user_simpasid_sub  finished=2026-09-11 10:10:48.926681+00
20260910170000_client_preferred_channel  finished=2026-09-10 17:45:01.989878+00
20260910120000_user_email_lower_unique  finished=2026-09-10 12:16:09.087087+00
20260910100000_session_outcome_recorded_at  finished=2026-09-10 11:00:11.109575+00
20260909100000_client_max_dialog_id  finished=2026-09-09 11:35:55.626601+00
20260908_notification_ref_id  finished=2026-09-09 09:46:05.445408+00
20260906180000_client_intake_draft  finished=2026-09-06 21:03:19.325879+00
20260905140000_baseline_missing_columns  finished=2026-09-06 07:25:31.481482+00
20260905130000_baseline_pre_migration_foreign_keys  finished=2026-09-06 07:25:31.448543+00
20260905120000_practice_onboarding_state  finished=2026-09-06 07:25:31.390925+00
20260904120000_psychologist_address_is_active  finished=2026-09-06 07:25:31.379883+00
20260904090000_practice_import_source_fingerprint  finished=2026-09-06 07:25:31.356869+00
20260903160000_calendar_session_link_import_batch  finished=2026-09-06 07:25:31.335296+00
20260903150000_client_notifications_enabled  finished=2026-09-06 07:25:31.174389+00
20260903140000_session_origin  finished=2026-09-06 07:25:31.151402+00
20260903130000_practice_attestation_consent_events  finished=2026-09-06 07:25:31.128863+00
20260903120000_legal_canonical_codes  finished=2026-09-06 07:25:31.014763+00
20260829150000_enable_time_suggest  finished=2026-09-06 07:25:30.957596+00
### Колонки, которые добавляли откаченные PR (должны отсутствовать)
PsychologistSettings.privateRemindersEnabled
PsychologistSettings.timeSuggestEnabled
User.analyticsConsentAt
Payment.terminal
### Таблицы, которые добавляли откаченные PR (должны отсутствовать)
Subscription
WaitlistEntry
events
events_rejected
### Orphan ScheduleRule.addressId (ссылка на несуществующий кабинет)
### Orphan AvailabilitySlot.scheduleRuleId (защитная проверка поверх FK)
### Будущие сессии одного психолога в одно время (не cancelled)
### Будущие offline-сессии без кабинета (addressId NULL)
### Всего таблиц в базе
59
### Строк в главных таблицах
User=16
DiaryClient=26
DiarySession=52
### Сессии по статусам (панель считает NSM только по completed)
completed=37
pending=7
confirmed=6
no_show=2
### Сессии по свежести
за 7 дней=10
за 30 дней=11
специалистов с сессией за 30 дней=1
самая свежая сессия=2026-09-24 00:00:00
### Специалисты по свежести регистрации
зарегистрировано за 30 дней=2
зарегистрировано за 90 дней=8
### События приёмника по продуктам и свежести
zapiski всего=1983 свежайшее=2026-09-12 21:19:52.116
practice всего=92 свежайшее=2026-09-12 21:53:29.496
moments всего=10 свежайшее=2026-08-31 08:31:26.375
событий за 30 дней=2085
### Согласие на аналитику
пользователей с согласием=1
### Платежи и подписки по статусам
pending=15
failed=2
paid=1
подписок всего=1
### Триалы: панель видит их через Subscription, дашборд — через User
User.trialEndsAt в будущем=4
User.trialEndsAt задан вообще=12
User.subscriptionEndsAt задан=1
churned=1
### Источники трафика: панель требует привязку к аккаунту, старая аналитика — нет
VisitorAnalytics всего=328
из них с accountId=10
из них с utmSource=11
### Последнее показание InfraPulse: какие поля заполнены
collectedAt=2026-09-12 22:01:44.437
certDaysLeft=80 | backupAgeHours=0.6346096158854166 | backupReadable=true | responseP95Ms=NULL | remindersDue=21 | remindersSent=18 | migrationsApplied=60 | migrationsDrift={"onlyInDb": [], "onlyInRepo": []} | cpuPercent=45.91836734693877 | containers=[{"name": "cmpas-app", "running": true, 
### События по имени (панель ищет узкие срезы)
sync_completed=978
note_saved=869
note_searched=129
app_opened=34
practice_client_intake_contact=11
payment_initiated=9
export_requested=6
practice_started=6
identity_linked=6
client_invite_created=5
practice_booking_link_shared=5
session_created=5
consent_updated=4
rebooking_nudge_sent=3
session_outcome_marked=3
session_slot_repeated=2
practice_booking_succeeded=2
practice_booking_attempted=2
app_installed=2
weekly_followup_sent=1
practice_onboarding_completed=1
practice_migration_previewed=1
practice_migration_started=1
### Таблицы, из которых панель читает: пустые или нет
InfraPulse=5866
DeployLog=61
ReminderOutbox=21
events=2085
events_rejected=40
Subscription=1
Payment=18
### Место на диске
Filesystem      Size  Used Avail Use% Mounted on
/dev/vda2        89G   69G   16G  82% /
/dev/vda2        89G   69G   16G  82% /
### Память
               total        used        free      shared  buff/cache   available
Mem:            7941        2272         749          67        5440        5668
Swap:            511         507           4
### Что занимает docker
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          8         8         51.71GB   51.71GB (100%)
Containers      9         9         3.985MB   0B (0%)
Local Volumes   157       9         367.7MB   4.07MB (1%)
Build Cache     867       0         56.63GB   55.95GB
### Убитые по нехватке памяти за сутки
0
0
не удалось прочитать
### Хвост журнала последней выкладки (/tmp/cmpas-deploy.log)


No pending migrations to apply.
[deploy] Prisma migrations applied.
[deploy] Applying beta schema safety net.
psql:/tmp/beta-mvp-schema-fixes.sql:6: NOTICE:  column "maxChatId" of relation "User" already exists, skipping
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:7: NOTICE:  column "fcmToken" of relation "User" already exists, skipping
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:8: NOTICE:  column "maxChatId" of relation "DiaryClient" already exists, skipping
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:11: NOTICE:  column "source" of relation "LegalDocumentAcceptance" already exists, skipping
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:12: NOTICE:  column "documentType" of relation "LegalDocumentAcceptance" already exists, skipping
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:13: NOTICE:  column "documentVersion" of relation "LegalDocumentAcceptance" already exists, skipping
ALTER TABLE
UPDATE 27
psql:/tmp/beta-mvp-schema-fixes.sql:21: NOTICE:  relation "LegalDocumentAcceptance_userId_source_idx" already exists, skipping
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:22: NOTICE:  relation "LegalDocumentAcceptance_documentType_idx" already exists, skipping
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:25: NOTICE:  column "postSessionNudged" of relation "DiarySession" already exists, skipping
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:26: NOTICE:  column "clientMoodRating" of relation "DiarySession" already exists, skipping
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:27: NOTICE:  column "paymentStatus" of relation "DiarySession" already exists, skipping
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:28: NOTICE:  relation "DiarySession_paymentStatus_idx" already exists, skipping
CREATE INDEX
CREATE TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:38: NOTICE:  relation "FeatureInterest" already exists, skipping
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:40: NOTICE:  relation "FeatureInterest_userId_feature_key" already exists, skipping
psql:/tmp/beta-mvp-schema-fixes.sql:41: NOTICE:  relation "FeatureInterest_feature_idx" already exists, skipping
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:42: NOTICE:  relation "FeatureInterest_createdAt_idx" already exists, skipping
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:56: NOTICE:  relation "PracticeNotification" already exists, skipping
CREATE TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:58: NOTICE:  column "subtitle" of relation "PracticeNotification" already exists, skipping
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:59: NOTICE:  column "sessionId" of relation "PracticeNotification" already exists, skipping
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:60: NOTICE:  column "clientId" of relation "PracticeNotification" already exists, skipping
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:61: NOTICE:  column "readAt" of relation "PracticeNotification" already exists, skipping
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:62: NOTICE:  column "createdAt" of relation "PracticeNotification" already exists, skipping
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:65: NOTICE:  relation "PracticeNotification_psychologistId_createdAt_idx" already exists, skipping
CREATE INDEX
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:67: NOTICE:  relation "PracticeNotification_psychologistId_readAt_idx" already exists, skipping
psql:/tmp/beta-mvp-schema-fixes.sql:92: NOTICE:  relation "CalendarSessionLink" already exists, skipping
CREATE TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:99: NOTICE:  relation "CalendarSessionLink_integrationId_externalEventId_key" already exists, skipping
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:101: NOTICE:  relation "CalendarSessionLink_integrationId_sessionId_key" already exists, skipping
CREATE INDEX
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:102: NOTICE:  relation "CalendarSessionLink_psychologistId_idx" already exists, skipping
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:103: NOTICE:  relation "CalendarSessionLink_sessionId_idx" already exists, skipping
CREATE TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:122: NOTICE:  relation "PracticeImportBatch" already exists, skipping
psql:/tmp/beta-mvp-schema-fixes.sql:124: NOTICE:  relation "PracticeImportBatch_psychologistId_idx" already exists, skipping
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:146: NOTICE:  relation "PracticeImportItem" already exists, skipping
CREATE TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:153: NOTICE:  column "sourceFingerprint" of relation "PracticeImportItem" already exists, skipping
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:155: NOTICE:  relation "PracticeImportItem_batchId_idx" already exists, skipping
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:156: NOTICE:  relation "PracticeImportItem_sourceFingerprint_idx" already exists, skipping
CREATE INDEX
DO
[deploy] Running strict schema verification against the new image.
time="2026-09-13T00:26:27+03:00" level=warning msg="No services to build"
time="2026-09-13T00:26:27+03:00" level=warning msg="No services to build"
 Container cmpasru-app-run-7247875bd4da Creating 
 Container cmpasru-app-run-7247875bd4da Created 
[schema] Все 58 таблиц и их колонки на месте.
[schema] Чтение User через клиент Prisma прошло.
[schema] Чтение DiaryClient через клиент Prisma прошло.
[schema] Чтение DiarySession через клиент Prisma прошло.
[schema] Prisma migration history has no unfinished entries.
[deploy] Starting the infra-pulse collector.
time="2026-09-13T00:26:31+03:00" level=warning msg="No services to build"
 Container cmpas-postgres Running 
 Container cmpas-infra-pulse Recreate 
 Container cmpas-infra-pulse Recreated 
 Container cmpas-postgres Waiting 
 Container cmpas-postgres Healthy 
 Container cmpas-infra-pulse Starting 
 Container cmpas-infra-pulse Started 
[deploy] Recreating only the application container.
time="2026-09-13T00:26:35+03:00" level=warning msg="No services to build"
 Container cmpas-app Recreate 
 Container cmpas-app Recreated 
 Container cmpas-app Starting 
 Container cmpas-app Started 
[deploy] New application is healthy.
[schema] Все 58 таблиц и их колонки на месте.
[schema] Чтение User через клиент Prisma прошло.
[schema] Чтение DiaryClient через клиент Prisma прошло.
[schema] Чтение DiarySession через клиент Prisma прошло.
[schema] Prisma migration history has no unfinished entries.
[deploy] Auth endpoint status: 200
[deploy] Running Subscription backfill (idempotent, scripts/backfill-subscriptions.ts).
time="2026-09-13T00:26:43+03:00" level=warning msg="No services to build"
time="2026-09-13T00:26:43+03:00" level=warning msg="No services to build"
 Container cmpas-backfill-subscriptions Creating 
 Container cmpas-backfill-subscriptions Created 
[backfill-subscriptions] план: create=0 update=0 skip=1
[backfill-subscriptions] выполнено: { created: 0, updated: 0, skipped: 1 }
[deploy] Telegram webhook registered through the tunnel; pending updates: 0.
[deploy] NOTE: Telegram reports a previous webhook delivery error: "Connection timed out"
[deploy] Cleanup: free disk 15G -> 16G.
[deploy] Deployment completed successfully.
### Состояние контейнеров
cmpas-app | Up 37 minutes
cmpas-infra-pulse | Up 37 minutes
simpasid-app | Up 2 hours (healthy)
zapiski-api | Up 37 hours (healthy)
simpasid-postgres | Up 5 days (healthy)
cmpas-singbox | Up 5 days
zapiski-postgres | Up 3 weeks (healthy)
cmpas-mailer | Up 3 weeks (healthy)
cmpas-postgres | Up 3 weeks (healthy)
### Достижим ли Т-Банк с сервера
-- имя разрешается в:
178.130.128.34  securepay.tinkoff.ru
-- curl с хоста:
код 405, время 0.228989s
-- curl из контейнера приложения:
sh: 1: curl: not found
-- версия node на хосте:
v20.19.6
### Кто выдал сертификат Т-Банка
subject=CN = *.tinkoff.ru, C = RU, L = Moscow, ST = 77 \D0\B3.\D0\9C\D0\BE\D1\81\D0\BA\D0\B2\D0\B0, O = TBank, OGRN = 1027739642281, 1.2.643.100.4 = 7710140679
issuer=C = RU, O = The Ministry of Digital Development and Communications, CN = Russian Trusted Sub CA
-- есть ли в системе российский корневой центр:
russian_trusted_root_ca.crt
russian_trusted_sub_ca.crt
российского корня в доверенных нет
### Платежи: последние записи
cmpas_cml2q6tfe0001kioc5j6tpyxu_c7145b1537f25ab7 | pending | 149000 | site | 2026-09-11 19:35:13.812
cmpas_cml2q6tfe0001kioc5j6tpyxu_0051ad28d0e97b17 | pending | 149000 | site | 2026-09-11 19:32:17.278
cmpas_cml2q6tfe0001kioc5j6tpyxu_94a4cc993e9d8c41 | pending | 149000 | site | 2026-09-11 16:37:31.474
cmpas_cml2q6tfe0001kioc5j6tpyxu_acf156676f471997 | pending | 149000 | site | 2026-09-11 16:09:12.655
cmpas_cml2q6tfe0001kioc5j6tpyxu_785a7b6f8b5706cd | pending | 149000 | site | 2026-09-11 16:08:31.775
cmpas_cml2q6tfe0001kioc5j6tpyxu_166be0f5c6b4c348 | pending | 149000 | site | 2026-09-11 16:00:14.065
всего платежей=18
### Платежи: возраст и полнота записи (без секретов)
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=26
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=27
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=29
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=30
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=30
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=30
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=30
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=84
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=132
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=607
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=3063
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=3340
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=3660
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=3830
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=3843
paid | tinkoffPaymentId=true | terminal=site | возраст_ч=3844
failed | tinkoffPaymentId=false | terminal=site | возраст_ч=3844
failed | tinkoffPaymentId=false | terminal=site | возраст_ч=3844
### Демонстрационный терминал: не подменяет ли он боевой (по журналу приложения)
упоминаний в журнале контейнера: 0
### Журнал колбэков Т-Кассы за 7 суток (RebillId и Token вычищены построчно)
### Куда Т-Касса должна слать колбэк (URL, не секрет)
AUTH_URL=https://cmpas.ru
### Живёт ли контейнер дольше, чем застрявшие платежи (иначе журнал ничего не покажет)
запущен=2026-09-12T21:26:37.928270957Z
### Достижим ли маршрут колбэка снаружи (безвредный запрос, без валидного токена)
POST /api/payments/callback (снаружи, через cmpas.ru) -> 400
### Заданы ли ключи терминалов в окружении сервера (значения не печатаем)
TINKOFF_TERMINAL_KEY: задан
TINKOFF_PASSWORD: задан
TINKOFF_APP_TERMINAL_KEY: НЕ задан
TINKOFF_APP_PASSWORD: НЕ задан
SMTP_USER: НЕ задан
SMTP_PASSWORD: НЕ задан
### Отвечает ли приложение внутри сервера
http://localhost:3000/ -> 200
http://localhost:3000/diary -> 307
http://localhost:3000/api/admin/health -> 403
### Отвечает ли сайт снаружи (с самого сервера, через полный путь)
https://cmpas.ru/ -> 200 за 0.135382s
https://cmpas.ru/diary -> 307 за 0.148892s
https://cmpas.ru/admin -> 307 за 0.450022s
### Сертификат cmpas.ru
notBefore=Sep  2 23:59:38 2026 GMT
notAfter=Dec  1 23:59:37 2026 GMT
subject=CN = cmpas.ru
issuer=C = US, O = Let's Encrypt, CN = YE2
### Кто слушает 80 и 443
LISTEN 0      4096                                       0.0.0.0:3000       0.0.0.0:*    users:(("docker-proxy",pid=1454228,fd=7))                                                                                                                                            
LISTEN 0      511                                        0.0.0.0:443        0.0.0.0:*    users:(("nginx",pid=3919949,fd=14),("nginx",pid=529380,fd=14),("nginx",pid=529379,fd=14),("nginx",pid=529378,fd=14),("nginx",pid=529377,fd=14))                                      
LISTEN 0      511                                        0.0.0.0:80         0.0.0.0:*    users:(("nginx",pid=3919949,fd=15),("nginx",pid=529380,fd=15),("nginx",pid=529379,fd=15),("nginx",pid=529378,fd=15),("nginx",pid=529377,fd=15))                                      
LISTEN 0      4096                                          [::]:3000          [::]:*    users:(("docker-proxy",pid=1454235,fd=7))                                                                                                                                            
LISTEN 0      511                                           [::]:443           [::]:*    users:(("nginx",pid=3919949,fd=13),("nginx",pid=529380,fd=13),("nginx",pid=529379,fd=13),("nginx",pid=529378,fd=13),("nginx",pid=529377,fd=13))                                      
LISTEN 0      511                                           [::]:80            [::]:*    users:(("nginx",pid=3919949,fd=16),("nginx",pid=529380,fd=16),("nginx",pid=529379,fd=16),("nginx",pid=529378,fd=16),("nginx",pid=529377,fd=16))                                      
### Журнал приложения, последние 60 строк
[avatar] empty
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] tg_photos_unreachable дорога 2/2 photos=истёк срок 8000мс (из кэша)
[avatar] empty
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[tg-watchdog] Telegram не может доставить 1 обновлений («Connection timed out»). Забираем сами.
[TG Webhook] update 152528895 callback
[TG Bot] подтвердить нажатие не удалось (окно закрыто): 400: Bad Request: query is too old and response timeout expired or query ID is invalid
[tg-watchdog] спасено обновлений: 1, не удалось: 0; вебхук возвращён
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] tg_no_photos дорога 1/2 photos=0 chat=фото нет (из кэша)
[avatar] empty
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] tg_photos_unreachable дорога 2/2 photos=истёк срок 8000мс (из кэша)
[avatar] empty
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] tg_photos_unreachable дорога 2/2 photos=истёк срок 8000мс (из кэша)
[avatar] empty
[avatar] tg_no_photos дорога 1/2 photos=0 chat=фото нет (из кэша)
[avatar] empty
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[avatar] no_messenger
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Утренний дайджест
[CRON] Еженедельная сводка
[Tinkoff callback] {"OrderId":"doctor-probe-nonexistent","TerminalKey":"doctor-probe","Status":"REJECTED","PaymentId":1,"Amount":1,"Token":"0000000000000000000000000000000000000000000000000000000000"}
[Tinkoff callback] Invalid token, OrderId: doctor-probe-nonexistent
### Журнал контейнера в цикле перезапуска
[36mINFO[0m[492645] [[38;5;155m1779762252[0m 0ms] outbound/hysteria2[hysteria2-out]: outbound connection to api.telegram.org:443
[31mERROR[0m[492645] [[38;5;155m1779762252[0m 154ms] connection: connection upload closed: stream 11984 canceled by remote with error code 0
[36mINFO[0m[492664] [[38;5;84m909100947[0m 0ms] inbound/mixed[proxy-in]: inbound connection from 172.18.0.2:42234
[36mINFO[0m[492664] [[38;5;84m909100947[0m 1ms] inbound/mixed[proxy-in]: inbound connection to api.telegram.org:443
[36mINFO[0m[492664] [[38;5;84m909100947[0m 1ms] outbound/hysteria2[hysteria2-out]: outbound connection to api.telegram.org:443
[31mERROR[0m[492664] [[38;5;84m909100947[0m 181ms] connection: connection upload closed: stream 11988 canceled by remote with error code 0
[36mINFO[0m[492685] [[38;5;30m520776974[0m 0ms] inbound/mixed[proxy-in]: inbound connection from 172.18.0.2:50992
[36mINFO[0m[492685] [[38;5;30m520776974[0m 0ms] inbound/mixed[proxy-in]: inbound connection to api.telegram.org:443
[36mINFO[0m[492685] [[38;5;30m520776974[0m 0ms] outbound/hysteria2[hysteria2-out]: outbound connection to api.telegram.org:443
[31mERROR[0m[492685] [[38;5;30m520776974[0m 180ms] connection: connection upload closed: stream 11992 canceled by remote with error code 0
[36mINFO[0m[492704] [[38;5;182m1307844518[0m 0ms] inbound/mixed[proxy-in]: inbound connection from 172.18.0.2:34416
[36mINFO[0m[492704] [[38;5;182m1307844518[0m 0ms] inbound/mixed[proxy-in]: inbound connection to api.telegram.org:443
[36mINFO[0m[492704] [[38;5;182m1307844518[0m 0ms] outbound/hysteria2[hysteria2-out]: outbound connection to api.telegram.org:443
[31mERROR[0m[492704] [[38;5;182m1307844518[0m 200ms] connection: connection upload closed: stream 11996 canceled by remote with error code 0
[36mINFO[0m[492725] [[38;5;224m1796052432[0m 0ms] inbound/mixed[proxy-in]: inbound connection from 172.18.0.2:33464
[36mINFO[0m[492725] [[38;5;224m1796052432[0m 0ms] inbound/mixed[proxy-in]: inbound connection to api.telegram.org:443
[36mINFO[0m[492725] [[38;5;224m1796052432[0m 0ms] outbound/hysteria2[hysteria2-out]: outbound connection to api.telegram.org:443
[31mERROR[0m[492725] [[38;5;224m1796052432[0m 167ms] connection: connection upload closed: stream 12000 canceled by remote with error code 0
[36mINFO[0m[492744] [[38;5;122m3959967853[0m 0ms] inbound/mixed[proxy-in]: inbound connection from 172.18.0.2:50072
[36mINFO[0m[492744] [[38;5;122m3959967853[0m 0ms] inbound/mixed[proxy-in]: inbound connection to api.telegram.org:443
[36mINFO[0m[492744] [[38;5;122m3959967853[0m 0ms] outbound/hysteria2[hysteria2-out]: outbound connection to api.telegram.org:443
[31mERROR[0m[492744] [[38;5;122m3959967853[0m 165ms] connection: connection upload closed: stream 12004 canceled by remote with error code 0
[36mINFO[0m[492765] [[38;5;210m3738054338[0m 0ms] inbound/mixed[proxy-in]: inbound connection from 172.18.0.2:45262
[36mINFO[0m[492765] [[38;5;210m3738054338[0m 0ms] inbound/mixed[proxy-in]: inbound connection to api.telegram.org:443
[36mINFO[0m[492765] [[38;5;210m3738054338[0m 0ms] outbound/hysteria2[hysteria2-out]: outbound connection to api.telegram.org:443
[31mERROR[0m[492765] [[38;5;210m3738054338[0m 150ms] connection: connection upload closed: stream 12008 canceled by remote with error code 0
[36mINFO[0m[492784] [[38;5;83m15360579[0m 0ms] inbound/mixed[proxy-in]: inbound connection from 172.18.0.2:33082
[36mINFO[0m[492784] [[38;5;83m15360579[0m 0ms] inbound/mixed[proxy-in]: inbound connection to api.telegram.org:443
[36mINFO[0m[492784] [[38;5;83m15360579[0m 0ms] outbound/hysteria2[hysteria2-out]: outbound connection to api.telegram.org:443
[31mERROR[0m[492784] [[38;5;83m15360579[0m 161ms] connection: connection upload closed: stream 12012 canceled by remote with error code 0
### Почему перезапускался app (последний выход)
запусков=0 статус=running код выхода=0 убит по памяти=false стартовал=2026-09-12T21:26:37.928270957Z
### Свободное место подробно
Filesystem      Size  Used Avail Use% Mounted on
/dev/vda2        89G   69G   16G  82% /
/dev/vda2        89G   69G   16G  82% /
### Какой образ реально запущен
образ=cmpasru-app создан=2026-09-12T21:26:36.197228684Z запущен=2026-09-12T21:26:37.928270957Z
cmpasru-app:latest f6ffcbb9de51 38 minutes ago
cmpasru-infra-pulse:latest 98d6333928dd 38 minutes ago
simpasid-app:latest 9effbf66c529 2 hours ago
zapiski-api:latest 2c8804a89f3f 2 days ago
postgres:16-alpine 57c72fd2a128 2 months ago
ghcr.io/sagernet/sing-box:latest c8b67944345d 2 months ago
boky/postfix:latest aafc77238423 8 months ago
postgres:15-alpine b3968e348b48 8 months ago
### Метка сборки внутри контейнера
-rw-r--r-- 1 nextjs nodejs 21 Sep 12 21:25 /app/.next/BUILD_ID
rTsVNYSrTeMFlZYdXGpT_### Есть ли панель в запущенной сборке
(chrome)
panel
### Хвост журнала последней выкладки
 Container cmpasru-app-run-7247875bd4da Creating 
 Container cmpasru-app-run-7247875bd4da Created 
[schema] Все 58 таблиц и их колонки на месте.
[schema] Чтение User через клиент Prisma прошло.
[schema] Чтение DiaryClient через клиент Prisma прошло.
[schema] Чтение DiarySession через клиент Prisma прошло.
[schema] Prisma migration history has no unfinished entries.
[deploy] Starting the infra-pulse collector.
time="2026-09-13T00:26:31+03:00" level=warning msg="No services to build"
 Container cmpas-postgres Running 
 Container cmpas-infra-pulse Recreate 
 Container cmpas-infra-pulse Recreated 
 Container cmpas-postgres Waiting 
 Container cmpas-postgres Healthy 
 Container cmpas-infra-pulse Starting 
 Container cmpas-infra-pulse Started 
[deploy] Recreating only the application container.
time="2026-09-13T00:26:35+03:00" level=warning msg="No services to build"
 Container cmpas-app Recreate 
 Container cmpas-app Recreated 
 Container cmpas-app Starting 
 Container cmpas-app Started 
[deploy] New application is healthy.
[schema] Все 58 таблиц и их колонки на месте.
[schema] Чтение User через клиент Prisma прошло.
[schema] Чтение DiaryClient через клиент Prisma прошло.
[schema] Чтение DiarySession через клиент Prisma прошло.
[schema] Prisma migration history has no unfinished entries.
[deploy] Auth endpoint status: 200
[deploy] Running Subscription backfill (idempotent, scripts/backfill-subscriptions.ts).
time="2026-09-13T00:26:43+03:00" level=warning msg="No services to build"
time="2026-09-13T00:26:43+03:00" level=warning msg="No services to build"
 Container cmpas-backfill-subscriptions Creating 
 Container cmpas-backfill-subscriptions Created 
[backfill-subscriptions] план: create=0 update=0 skip=1
[backfill-subscriptions] выполнено: { created: 0, updated: 0, skipped: 1 }
[deploy] Telegram webhook registered through the tunnel; pending updates: 0.
[deploy] NOTE: Telegram reports a previous webhook delivery error: "Connection timed out"
[deploy] Cleanup: free disk 15G -> 16G.
[deploy] Deployment completed successfully.
### Флаги аналитики в /var/www/cmpas.ru/.env
ANALYTICS_INGEST_ENABLED=true
ANALYTICS_TRACKING_ENABLED=true
ANALYTICS_INGEST_SECRET: задан (длина 64)
### Файлы с секретом приёмника
/etc/simpas/ingest-secret: есть, 65 байт, права 600, владелец root
/var/www/zapiski/.ingest-secret: есть, 65 байт, права 600, владелец root
### Контейнер infra-pulse
cmpas-infra-pulse | Up 37 minutes | cmpasru-infra-pulse
### Свежесть строк InfraPulse
строк всего=5866
последняя=2026-09-12 22:01:44.437 возраст_мин=2
### Таблицы аналитического контура
ReminderOutbox
Subscription
analytics_device_consent
events
events_rejected
### Наполнение событий и подписок
events=2085
подписок=1
### Куда на самом деле слушает приложение
HOSTNAME внутри контейнера: 5acae9bd8cb2
IP контейнера: 172.18.0.2 
### Приёмник без ключа (ждём 401)
POST /api/ingest без Authorization -> 401
  ответ: {"accepted":false,"reason":"unauthorized"}
### Разделение секретов по продуктам
ANALYTICS_INGEST_SECRET: задан, длина 64
ANALYTICS_INGEST_SECRET_MOMENTS: задан, длина 64
секретом ПРАКТИКИ шлём событие МОМЕНТОВ -> HTTP 200 {"accepted":false,"reason":"secret not allowed for product moments"}
ПРИВЯЗКА РАБОТАЕТ: чужой продукт отвергнут
### Мобильные маршруты аналитики (без токена — ждём 401)
POST /api/mobile/analytics -> 401
GET  /api/mobile/analytics/consent -> 401
PUT  /api/mobile/analytics/consent -> 401
### Срок хранения событий
событий старше 180 дней: 0
### Живых сессий (замер для выкладки единого входа)
10
### Контрольная сумма набора сессий
1216808b580038927d459741649a1fc9
### Единый вход СИМПАС: переменные на сервере (значения не печатаем)
SIMPASID_ISSUER: https://auth.cmpas.ru
SIMPASID_CLIENT_ID: practice-web
SIMPASID_CLIENT_SECRET: задан (длина 43)
--- все три заданы = кнопка на /auth обязана быть
### Единый вход: достижим ли издатель из контейнера приложения
openid-configuration -> 200
--- 200 = вход через СИМПАС возможен; отказ = кнопка есть, а войти нельзя
### Единый вход: пользователи с более чем одной учётной записью simpasid
0
--- 0 = sub у всех один; больше нуля = sub разошёлся, связь пошла по почте
### Регистр почты: адресов, отзывающихся более чем на одну учётную запись
0
--- 0 = двойников нет, уникальный индекс по lower(email) можно ставить
### Регистр почты: адресов, записанных не в нижнем регистре
0
--- больше нуля = точное сравнение этих людей не находило бы; сравнение уже нечувствительно
### Чем входят: строк Account по провайдерам
simpasid: 2
yandex: 11
### Людей, у которых дверь только одна — почта (ни одной строки Account)
5
всего людей: 16
--- это те, кого редирект на auth.cmpas.ru оставит снаружи, пока они там не заведутся
### Подсказки адресов: ключ DaData (значение не печатаем)
DADATA_API_KEY: задан (длина 40)
### Подсказки адресов: видит ли ключ САМ работающий контейнер
DADATA_API_KEY внутри cmpas-app: задан (длина 40)
cmpas-app запущен: 2026-09-12T21:26:37.928270957Z
--- жалобы ниже старше этого времени быть не могут: журнал живёт с контейнером
### Подсказки адресов: на что жаловался маршрут за 24 часа
--- NO_TOKEN = ключа нет; UPSTREAM_ERROR = DaData ответила ошибкой;
--- TIMEOUT = не уложилась в срок; пусто = маршрут не жаловался
### Достижима ли DaData с сервера (без ключа, ждём 401/403)
POST suggestions.dadata.ru -> 401 за 0.223290s
### Признаёт ли DaData наш ключ (ждём 200; 401/403 = ключ негоден)
POST с ключом -> 200 за 0.261427s
### Аватарки: к скольким клиентам вообще есть за чем идти
3|2|2|26
--- telegram=0 и max_диалог=0 значит, что кружки пусты по данным, а не по коду
--- max_привязан больше max_диалог: диалог заполнится с их следующим сообщением боту
### Аватарки: на что жаловался маршрут за 24 часа
2026-09-12T21:50:32.036752349Z [avatar] no_messenger
2026-09-12T21:50:32.056615099Z [avatar] no_messenger
2026-09-12T21:50:32.125423186Z [avatar] no_messenger
2026-09-12T21:50:32.140215195Z [avatar] no_messenger
2026-09-12T21:50:32.142788446Z [avatar] no_messenger
2026-09-12T21:50:36.454347570Z [avatar] no_messenger
2026-09-12T21:51:12.143115912Z [avatar] no_messenger
2026-09-12T21:51:12.145498295Z [avatar] no_messenger
2026-09-12T21:51:12.169721966Z [avatar] no_messenger
2026-09-12T21:51:12.211380395Z [avatar] no_messenger
2026-09-12T21:51:12.213473983Z [avatar] no_messenger
2026-09-12T21:51:12.247678467Z [avatar] no_messenger
2026-09-12T21:51:12.249334147Z [avatar] tg_photos_unreachable дорога 2/2 photos=истёк срок 8000мс (из кэша)
2026-09-12T21:51:12.249410087Z [avatar] empty
2026-09-12T21:51:13.301983567Z [avatar] tg_no_photos дорога 1/2 photos=0 chat=фото нет (из кэша)
2026-09-12T21:51:13.303042416Z [avatar] empty
2026-09-12T21:51:13.363035919Z [avatar] no_messenger
2026-09-12T21:51:13.381090109Z [avatar] no_messenger
2026-09-12T21:51:13.407181575Z [avatar] no_messenger
2026-09-12T21:51:13.445195215Z [avatar] no_messenger
--- пусто = маршрут не жаловался (или ещё ни разу не спрашивали)
### Аватарки: тот же запрос ИЗНУТРИ КОНТЕЙНЕРА, обеими дорогами
напрямую: НЕТ ХОДА (TypeError) за 10.6с
через сайдкар: НЕТ ХОДА (Error) за 0.0с
--- фотографий: N>0 хотя бы одной дорогой = Telegram отдаёт, дело в выборе дороги
--- обе НЕТ ХОДА = до Telegram из контейнера не достучаться вообще
### Аватарки: отдаёт ли MAX список чатов бота
/me -> HTTP 200 (ключ бота принят)
/chats -> HTTP 200, тело: объект{chats}
  чатов 0, типы: (нет), диалогов 0
  диалог с искомым: нет
  ещё страницы: нет
/chats/<user_id> -> HTTP 404
--- /me не 200 = ключ бота негоден, всё остальное ниже бессмысленно
--- чатов 0 при HTTP 200 и верном ключе = боту в MAX никто не писал
--- тело не объект{chats,marker} = MAX отвечает иначе, чем ждёт разбор, чинить код
--- /chats/<user_id> отдал аватарку = поиск диалога не нужен вовсе, упростить
### Аватарки: какую дорогу выберет код (флаг telegram_vpn_proxy)
telegram_vpn_proxy = true
TELEGRAM_PROXY внутри cmpas-app: задан
--- пустая строка флага = решения не принимали, действует умолчание
### Аватарки: есть ли с ХОСТА ход до Telegram напрямую
curl: (28) Connection timed out after 15002 milliseconds
GET api.telegram.org -> 000 за 15.002732s
--- код 200/404 = ход есть; 000/таймаут = напрямую хода нет, нужен сайдкар
### Аватарки: отдаёт ли Telegram фотографию живого клиента
ответа нет — Telegram не ответил (причина 3)
--- total_count:0 = у человека нет фотографии или она закрыта (причина 2)
--- total_count:N>0 = фотография есть, значит дело в коде или в дороге
### Аватарки: то же самое ЧЕРЕЗ САЙДКАР (этой дорогой ходит бот)
и через сайдкар ответа нет — тоннель не работает
--- total_count здесь и есть правда: этой дорогой пойдёт и маршрут аватарок
```

## Миграции, лежащие в репозитории

```
00000000000000_baseline_pre_migration_tables
20260118_add_orders
20260118_add_visitor_analytics
20260118_enhanced_analytics
20260215171500_add_diary_models
20260221_add_calendar_integration_fields
20260222000000_add_advanced_scheduling
20260226_sync_schema
20260307_consent_and_onboarding
20260308_user_consent
20260315_add_legal_documents
20260323_add_sync_from_to_calendar_integration
20260404_add_max_chat_id
20260404_add_trial_ends_at
20260405_add_max_chat_id_to_diary_client
20260405_add_subscription_payments
20260411_add_pageview
20260411_admin_crm_models
20260411_schedule_v2
20260419_add_schedule_rules
20260426_add_system_config
20260531_configurable_documents_payments
20260531_specialist_client_documents
20260610_scheduled_messages_fcm
20260705183000_add_diary_session_payment_status
20260705_practice_notifications
20260709_feature_interest
20260709_legal_acceptance_audit_fields
20260710120000_legal_acceptance_schema_sync
20260817120000_analytics_f0_f1
20260817140000_booking_a_b
20260818090000_ingest_anonymous
20260818100000_infra_pulse
20260820120000_infra_pulse_panel_fields
20260823090000_reminder_outbox
20260823093000_analytics_event_id
20260823094500_app_response_time
20260823100000_visitor_analytics_account_id
20260823170000_client_request_id
20260829120000_booking_v2_slug_waitlist_outcome
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
20260906180000_client_intake_draft
20260908_notification_ref_id
20260909100000_client_max_dialog_id
20260910100000_session_outcome_recorded_at
20260910120000_user_email_lower_unique
20260910170000_client_preferred_channel
20260911100000_user_simpasid_sub
20260911150000_session_no_show_reason
20260911180000_payment_reminders
```
