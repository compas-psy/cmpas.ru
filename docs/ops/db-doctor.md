# Состояние базы на боевом сервере

Снято прогоном 34106067106. Файл перезаписывается каждой диагностикой.

```
Warning: Permanently added '45.144.30.190' (ED25519) to the list of known hosts.
### Журнал миграций существует?
t
### Записей в журнале
52
### Незавершённых миграций
0
### Последние 20 записей журнала
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
00000000000000_baseline_pre_migration_tables  finished=2026-09-06 07:25:30.944038+00
20260829120000_booking_v2_slug_waitlist_outcome  finished=2026-08-29 11:54:58.770557+00
20260823170000_client_request_id  finished=2026-08-23 18:35:50.620241+00
20260823100000_visitor_analytics_account_id  finished=2026-08-23 15:07:36.727566+00
20260823094500_app_response_time  finished=2026-08-23 15:07:36.710728+00
20260823093000_analytics_event_id  finished=2026-08-23 15:07:36.684168+00
20260823090000_reminder_outbox  finished=2026-08-23 15:07:36.666461+00
20260820120000_infra_pulse_panel_fields  finished=2026-08-21 05:19:10.612063+00
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
cmtl7k6pw008gxppuhxzz5pj8  psy=cml2q6tfe0001kioc5j6tpyxu  2026-09-09 20:00
### Всего таблиц в базе
59
### Строк в главных таблицах
User=16
DiaryClient=22
DiarySession=44
### Сессии по статусам (панель считает NSM только по completed)
completed=34
pending=6
confirmed=4
### Сессии по свежести
за 7 дней=1
за 30 дней=3
специалистов с сессией за 30 дней=1
самая свежая сессия=2026-09-09 00:00:00
### Специалисты по свежести регистрации
зарегистрировано за 30 дней=3
зарегистрировано за 90 дней=8
### События приёмника по продуктам и свежести
zapiski всего=1744 свежайшее=2026-09-06 20:36:51.649
practice всего=10 свежайшее=2026-09-06 09:34:07.165
moments всего=10 свежайшее=2026-08-31 08:31:26.375
событий за 30 дней=1764
### Согласие на аналитику
пользователей с согласием=1
### Платежи и подписки по статусам
pending=6
failed=2
paid=1
подписок всего=1
### Триалы: панель видит их через Subscription, дашборд — через User
User.trialEndsAt в будущем=3
User.trialEndsAt задан вообще=12
User.subscriptionEndsAt задан=1
churned=1
### Источники трафика: панель требует привязку к аккаунту, старая аналитика — нет
VisitorAnalytics всего=292
из них с accountId=4
из них с utmSource=11
### Последнее показание InfraPulse: какие поля заполнены
collectedAt=2026-09-07 09:25:57.04
certDaysLeft=85 | backupAgeHours=3.888670767415364 | backupReadable=true | responseP95Ms=NULL | remindersDue=9 | remindersSent=6 | migrationsApplied=52 | migrationsDrift={"onlyInDb": [], "onlyInRepo": []} | cpuPercent=26.96629213483146 | containers=[{"name": "cmpas-app", "running": true, 
### События по имени (панель ищет узкие срезы)
note_saved=831
sync_completed=795
note_searched=112
practice_started=6
export_requested=5
consent_updated=4
practice_booking_link_shared=2
app_installed=2
rebooking_nudge_sent=2
identity_linked=1
app_opened=1
practice_onboarding_completed=1
client_invite_created=1
weekly_followup_sent=1
### Таблицы, из которых панель читает: пустые или нет
InfraPulse=4256
DeployLog=19
ReminderOutbox=9
events=1764
events_rejected=11
Subscription=1
Payment=9
### Место на диске
Filesystem      Size  Used Avail Use% Mounted on
/dev/vda2        89G   39G   46G  46% /
/dev/vda2        89G   39G   46G  46% /
### Память
               total        used        free      shared  buff/cache   available
Mem:            7941        2266        1126          91        4946        5674
Swap:            511         215         296
### Что занимает docker
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          7         7         24.44GB   24.44GB (100%)
Containers      7         7         28.82MB   0B (0%)
Local Volumes   155       7         277.2MB   4.07MB (1%)
Build Cache     329       0         24.84GB   24.21GB
### Убитые по нехватке памяти за сутки
0
0
не удалось прочитать
### Хвост журнала последней выкладки (/tmp/cmpas-deploy.log)
52 migrations found in prisma/migrations


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
UPDATE 26
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:21: NOTICE:  relation "LegalDocumentAcceptance_userId_source_idx" already exists, skipping
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:22: NOTICE:  relation "LegalDocumentAcceptance_documentType_idx" already exists, skipping
psql:/tmp/beta-mvp-schema-fixes.sql:25: NOTICE:  column "postSessionNudged" of relation "DiarySession" already exists, skipping
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:26: NOTICE:  column "clientMoodRating" of relation "DiarySession" already exists, skipping
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:27: NOTICE:  column "paymentStatus" of relation "DiarySession" already exists, skipping
ALTER TABLE
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:28: NOTICE:  relation "DiarySession_paymentStatus_idx" already exists, skipping
psql:/tmp/beta-mvp-schema-fixes.sql:38: NOTICE:  relation "FeatureInterest" already exists, skipping
CREATE TABLE
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:40: NOTICE:  relation "FeatureInterest_userId_feature_key" already exists, skipping
psql:/tmp/beta-mvp-schema-fixes.sql:41: NOTICE:  relation "FeatureInterest_feature_idx" already exists, skipping
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:42: NOTICE:  relation "FeatureInterest_createdAt_idx" already exists, skipping
CREATE INDEX
CREATE TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:56: NOTICE:  relation "PracticeNotification" already exists, skipping
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
psql:/tmp/beta-mvp-schema-fixes.sql:67: NOTICE:  relation "PracticeNotification_psychologistId_readAt_idx" already exists, skipping
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:92: NOTICE:  relation "CalendarSessionLink" already exists, skipping
CREATE TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:99: NOTICE:  relation "CalendarSessionLink_integrationId_externalEventId_key" already exists, skipping
CREATE INDEX
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:101: NOTICE:  relation "CalendarSessionLink_integrationId_sessionId_key" already exists, skipping
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:102: NOTICE:  relation "CalendarSessionLink_psychologistId_idx" already exists, skipping
psql:/tmp/beta-mvp-schema-fixes.sql:103: NOTICE:  relation "CalendarSessionLink_sessionId_idx" already exists, skipping
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:122: NOTICE:  relation "PracticeImportBatch" already exists, skipping
CREATE TABLE
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:124: NOTICE:  relation "PracticeImportBatch_psychologistId_idx" already exists, skipping
psql:/tmp/beta-mvp-schema-fixes.sql:146: NOTICE:  relation "PracticeImportItem" already exists, skipping
CREATE TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:153: NOTICE:  column "sourceFingerprint" of relation "PracticeImportItem" already exists, skipping
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:155: NOTICE:  relation "PracticeImportItem_batchId_idx" already exists, skipping
psql:/tmp/beta-mvp-schema-fixes.sql:156: NOTICE:  relation "PracticeImportItem_sourceFingerprint_idx" already exists, skipping
CREATE INDEX
CREATE INDEX
DO
[deploy] Running strict schema verification against the new image.
time="2026-09-07T08:35:11+03:00" level=warning msg="No services to build"
time="2026-09-07T08:35:11+03:00" level=warning msg="No services to build"
 Container cmpasru-app-run-110b94cfa15d Creating 
 Container cmpasru-app-run-110b94cfa15d Created 
[schema] Все 58 таблиц и их колонки на месте.
[schema] Чтение User через клиент Prisma прошло.
[schema] Чтение DiaryClient через клиент Prisma прошло.
[schema] Чтение DiarySession через клиент Prisma прошло.
[schema] Prisma migration history has no unfinished entries.
[deploy] Starting the infra-pulse collector.
time="2026-09-07T08:35:14+03:00" level=warning msg="No services to build"
 Container cmpas-postgres Running 
 Container cmpas-infra-pulse Recreate 
 Container cmpas-infra-pulse Recreated 
 Container cmpas-postgres Waiting 
 Container cmpas-postgres Healthy 
 Container cmpas-infra-pulse Starting 
 Container cmpas-infra-pulse Started 
[deploy] Recreating only the application container.
time="2026-09-07T08:35:18+03:00" level=warning msg="No services to build"
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
time="2026-09-07T08:35:26+03:00" level=warning msg="No services to build"
time="2026-09-07T08:35:26+03:00" level=warning msg="No services to build"
 Container cmpasru-infra-pulse-run-a458257e61da Creating 
 Container cmpasru-infra-pulse-run-a458257e61da Created 
npm warn exec The following package was not found and will be installed: tsx@4.23.13
[backfill-subscriptions] план: create=0 update=0 skip=1
[backfill-subscriptions] выполнено: { created: 0, updated: 0, skipped: 1 }
[deploy] Telegram webhook registered through the tunnel; pending updates: 0.
[deploy] Deployment completed successfully.
### Состояние контейнеров
cmpas-app | Up 4 hours
cmpas-infra-pulse | Up 4 hours
cmpas-singbox | Up 4 hours
zapiski-api | Up 2 days (healthy)
zapiski-postgres | Up 2 weeks (healthy)
cmpas-mailer | Up 2 weeks (healthy)
cmpas-postgres | Up 2 weeks (healthy)
### Достижим ли Т-Банк с сервера
-- имя разрешается в:
178.130.128.34  securepay.tinkoff.ru
-- curl с хоста:
код 405, время 0.214715s
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
cmpas_cml2q6tfe0001kioc5j6tpyxu_9d5aaff1e1925d6c | pending | 99000 | site | 2026-08-18 15:19:45.018
cmpas_cml2q6tfe0001kioc5j6tpyxu_8244a60cc6f1cbad | pending | 99000 | site | 2026-05-08 06:42:16.349
cmpas_cml2q6tfe0001kioc5j6tpyxu_9d0e50bfb33d4818 | pending | 99000 | site | 2026-04-26 17:56:56.241
cmpas_cml3mp4xd0006hgrnbw9v9jnl_3f86dcb647887e91 | pending | 99000 | site | 2026-04-13 09:47:32.003
cmpas_cml2q6tfe0001kioc5j6tpyxu_1c2fea9fbc778f8d | pending | 99000 | site | 2026-04-06 07:38:00.896
cmpas_cml2q6tfe0001kioc5j6tpyxu_f640f4f81b5009ea | pending | 99000 | site | 2026-04-05 18:50:14.401
всего платежей=9
### Платежи: возраст и полнота записи (без секретов)
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=474
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=2931
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=3208
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=3528
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=3698
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=3711
paid | tinkoffPaymentId=true | terminal=site | возраст_ч=3711
failed | tinkoffPaymentId=false | terminal=site | возраст_ч=3712
failed | tinkoffPaymentId=false | terminal=site | возраст_ч=3712
### Демонстрационный терминал: не подменяет ли он боевой (по журналу приложения)
упоминаний в журнале контейнера: 0
### Журнал колбэков Т-Кассы за 7 суток (RebillId и Token вычищены построчно)
### Куда Т-Касса должна слать колбэк (URL, не секрет)
AUTH_URL=https://cmpas.ru
### Живёт ли контейнер дольше, чем застрявшие платежи (иначе журнал ничего не покажет)
запущен=2026-09-07T05:35:20.741605294Z
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
https://cmpas.ru/ -> 200 за 0.100460s
https://cmpas.ru/diary -> 307 за 0.164655s
https://cmpas.ru/admin -> 307 за 0.480338s
### Сертификат cmpas.ru
notBefore=Sep  2 23:59:38 2026 GMT
notAfter=Dec  1 23:59:37 2026 GMT
subject=CN = cmpas.ru
issuer=C = US, O = Let's Encrypt, CN = YE2
### Кто слушает 80 и 443
LISTEN 0      4096                                       0.0.0.0:3000       0.0.0.0:*    users:(("docker-proxy",pid=4148933,fd=7))                                                                                                                                            
LISTEN 0      511                                        0.0.0.0:443        0.0.0.0:*    users:(("nginx",pid=1155941,fd=11),("nginx",pid=1155940,fd=11),("nginx",pid=1155939,fd=11),("nginx",pid=1155938,fd=11),("nginx",pid=523662,fd=11))                                   
LISTEN 0      511                                        0.0.0.0:80         0.0.0.0:*    users:(("nginx",pid=1155941,fd=12),("nginx",pid=1155940,fd=12),("nginx",pid=1155939,fd=12),("nginx",pid=1155938,fd=12),("nginx",pid=523662,fd=12))                                   
LISTEN 0      4096                                          [::]:3000          [::]:*    users:(("docker-proxy",pid=4148940,fd=7))                                                                                                                                            
LISTEN 0      511                                           [::]:443           [::]:*    users:(("nginx",pid=1155941,fd=13),("nginx",pid=1155940,fd=13),("nginx",pid=1155939,fd=13),("nginx",pid=1155938,fd=13),("nginx",pid=523662,fd=13))                                   
LISTEN 0      511                                           [::]:80            [::]:*    users:(("nginx",pid=1155941,fd=14),("nginx",pid=1155940,fd=14),("nginx",pid=1155939,fd=14),("nginx",pid=1155938,fd=14),("nginx",pid=523662,fd=14))                                   
### Журнал приложения, последние 60 строк
[startup] Verifying required production schema...
[schema] Все 58 таблиц и их колонки на месте.
[schema] Чтение User через клиент Prisma прошло.
[schema] Чтение DiaryClient через клиент Prisma прошло.
[schema] Чтение DiarySession через клиент Prisma прошло.
[schema] Prisma migration history has no unfinished entries.
[startup] Schema is ready. Starting Next.js...
▲ Next.js 16.1.1
- Local:         http://e6f44cf0cda4:3000
- Network:       http://e6f44cf0cda4:3000

✓ Starting...
✓ Ready in 330ms
[AUTH] AUTH_SECRET fingerprint: IKXOHxDD... (stable = sessions preserved)
[CRON] Инструментация: cron-задачи зарегистрированы
[AUTH] AUTH_SECRET fingerprint: IKXOHxDD... (stable = sessions preserved)
[TG Bot] API root: https://api.telegram.org
[TG Bot] VPN proxy active
[MAX] Webhook registration on startup: {"success":true}
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[AUTH] AUTH_SECRET fingerprint: IKXOHxDD... (stable = sessions preserved)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Еженедельная сводка
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[TG Webhook] update 152528878 message
[TG Webhook] update 152528879 message
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[Tinkoff callback] Invalid token, OrderId: doctor-probe-nonexistent
[Tinkoff callback] {"OrderId":"doctor-probe-nonexistent","TerminalKey":"doctor-probe","Status":"REJECTED","PaymentId":1,"Amount":1,"Token":"0000000000000000000000000000000000000000000000000000000000"}
### Журнал контейнера в цикле перезапуска
[36mINFO[0m[15132] [[38;5;217m4001430217[0m 0ms] outbound/hysteria2[hysteria2-out]: outbound connection to api.telegram.org:443
[31mERROR[0m[15133] [[38;5;217m4001430217[0m 461ms] connection: connection upload closed: stream 1552 canceled by remote with error code 0
[36mINFO[0m[15172] [[38;5;179m2311207587[0m 0ms] inbound/mixed[proxy-in]: inbound connection from 172.18.0.2:43304
[36mINFO[0m[15172] [[38;5;179m2311207587[0m 1ms] inbound/mixed[proxy-in]: inbound connection to api.telegram.org:443
[36mINFO[0m[15172] [[38;5;179m2311207587[0m 1ms] outbound/hysteria2[hysteria2-out]: outbound connection to api.telegram.org:443
[31mERROR[0m[15173] [[38;5;179m2311207587[0m 462ms] connection: connection upload closed: stream 1556 canceled by remote with error code 0
[36mINFO[0m[15212] [[38;5;98m3122876242[0m 0ms] inbound/mixed[proxy-in]: inbound connection from 172.18.0.2:39038
[36mINFO[0m[15212] [[38;5;98m3122876242[0m 1ms] inbound/mixed[proxy-in]: inbound connection to api.telegram.org:443
[36mINFO[0m[15212] [[38;5;98m3122876242[0m 1ms] outbound/hysteria2[hysteria2-out]: outbound connection to api.telegram.org:443
[31mERROR[0m[15213] [[38;5;98m3122876242[0m 454ms] connection: connection upload closed: stream 1560 canceled by remote with error code 0
[36mINFO[0m[15253] [[38;5;210m901068226[0m 0ms] inbound/mixed[proxy-in]: inbound connection from 172.18.0.2:47592
[36mINFO[0m[15253] [[38;5;210m901068226[0m 0ms] inbound/mixed[proxy-in]: inbound connection to api.telegram.org:443
[36mINFO[0m[15253] [[38;5;210m901068226[0m 0ms] outbound/hysteria2[hysteria2-out]: outbound connection to api.telegram.org:443
[31mERROR[0m[15253] [[38;5;210m901068226[0m 466ms] connection: connection upload closed: stream 1564 canceled by remote with error code 0
[36mINFO[0m[15293] [[38;5;77m2221338941[0m 0ms] inbound/mixed[proxy-in]: inbound connection from 172.18.0.2:37470
[36mINFO[0m[15293] [[38;5;77m2221338941[0m 0ms] inbound/mixed[proxy-in]: inbound connection to api.telegram.org:443
[36mINFO[0m[15293] [[38;5;77m2221338941[0m 1ms] outbound/hysteria2[hysteria2-out]: outbound connection to api.telegram.org:443
[31mERROR[0m[15293] [[38;5;77m2221338941[0m 472ms] connection: connection upload closed: stream 1568 canceled by remote with error code 0
[36mINFO[0m[15333] [[38;5;153m3120111438[0m 0ms] inbound/mixed[proxy-in]: inbound connection from 172.18.0.2:57278
[36mINFO[0m[15333] [[38;5;153m3120111438[0m 0ms] inbound/mixed[proxy-in]: inbound connection to api.telegram.org:443
[36mINFO[0m[15333] [[38;5;153m3120111438[0m 0ms] outbound/hysteria2[hysteria2-out]: outbound connection to api.telegram.org:443
[31mERROR[0m[15333] [[38;5;153m3120111438[0m 468ms] connection: connection upload closed: stream 1572 canceled by remote with error code 0
[36mINFO[0m[15373] [[38;5;48m394083616[0m 0ms] inbound/mixed[proxy-in]: inbound connection from 172.18.0.2:41110
[36mINFO[0m[15373] [[38;5;48m394083616[0m 0ms] inbound/mixed[proxy-in]: inbound connection to api.telegram.org:443
[36mINFO[0m[15373] [[38;5;48m394083616[0m 0ms] outbound/hysteria2[hysteria2-out]: outbound connection to api.telegram.org:443
[31mERROR[0m[15373] [[38;5;48m394083616[0m 476ms] connection: connection upload closed: stream 1576 canceled by remote with error code 0
[36mINFO[0m[15413] [[38;5;115m4040845411[0m 0ms] inbound/mixed[proxy-in]: inbound connection from 172.18.0.2:58004
[36mINFO[0m[15413] [[38;5;115m4040845411[0m 2ms] inbound/mixed[proxy-in]: inbound connection to api.telegram.org:443
[36mINFO[0m[15413] [[38;5;115m4040845411[0m 2ms] outbound/hysteria2[hysteria2-out]: outbound connection to api.telegram.org:443
[31mERROR[0m[15413] [[38;5;115m4040845411[0m 472ms] connection: connection upload closed: stream 1580 canceled by remote with error code 0
### Почему перезапускался app (последний выход)
запусков=0 статус=running код выхода=0 убит по памяти=false стартовал=2026-09-07T05:35:20.741605294Z
### Свободное место подробно
Filesystem      Size  Used Avail Use% Mounted on
/dev/vda2        89G   39G   46G  46% /
/dev/vda2        89G   39G   46G  46% /
### Какой образ реально запущен
образ=cmpasru-app создан=2026-09-07T05:35:19.416127434Z запущен=2026-09-07T05:35:20.741605294Z
cmpasru-infra-pulse:latest c4c58eadcd0b 4 hours ago
cmpasru-app:latest 562a1204f194 4 hours ago
zapiski-api:latest b8bbb277dc53 2 days ago
postgres:16-alpine 57c72fd2a128 2 months ago
ghcr.io/sagernet/sing-box:latest c8b67944345d 2 months ago
boky/postfix:latest aafc77238423 8 months ago
postgres:15-alpine b3968e348b48 8 months ago
### Метка сборки внутри контейнера
-rw-r--r-- 1 nextjs nodejs 21 Sep  7 05:34 /app/.next/BUILD_ID
9Fc2MhlhVdORjeRVF2BcF### Есть ли панель в запущенной сборке
(chrome)
panel
### Хвост журнала последней выкладки
time="2026-09-07T08:35:11+03:00" level=warning msg="No services to build"
 Container cmpasru-app-run-110b94cfa15d Creating 
 Container cmpasru-app-run-110b94cfa15d Created 
[schema] Все 58 таблиц и их колонки на месте.
[schema] Чтение User через клиент Prisma прошло.
[schema] Чтение DiaryClient через клиент Prisma прошло.
[schema] Чтение DiarySession через клиент Prisma прошло.
[schema] Prisma migration history has no unfinished entries.
[deploy] Starting the infra-pulse collector.
time="2026-09-07T08:35:14+03:00" level=warning msg="No services to build"
 Container cmpas-postgres Running 
 Container cmpas-infra-pulse Recreate 
 Container cmpas-infra-pulse Recreated 
 Container cmpas-postgres Waiting 
 Container cmpas-postgres Healthy 
 Container cmpas-infra-pulse Starting 
 Container cmpas-infra-pulse Started 
[deploy] Recreating only the application container.
time="2026-09-07T08:35:18+03:00" level=warning msg="No services to build"
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
time="2026-09-07T08:35:26+03:00" level=warning msg="No services to build"
time="2026-09-07T08:35:26+03:00" level=warning msg="No services to build"
 Container cmpasru-infra-pulse-run-a458257e61da Creating 
 Container cmpasru-infra-pulse-run-a458257e61da Created 
npm warn exec The following package was not found and will be installed: tsx@4.23.13
[backfill-subscriptions] план: create=0 update=0 skip=1
[backfill-subscriptions] выполнено: { created: 0, updated: 0, skipped: 1 }
[deploy] Telegram webhook registered through the tunnel; pending updates: 0.
[deploy] Deployment completed successfully.
### Флаги аналитики в /var/www/cmpas.ru/.env
ANALYTICS_INGEST_ENABLED=true
ANALYTICS_TRACKING_ENABLED=true
ANALYTICS_INGEST_SECRET: задан (длина 64)
### Файлы с секретом приёмника
/etc/simpas/ingest-secret: есть, 65 байт, права 600, владелец root
/var/www/zapiski/.ingest-secret: есть, 65 байт, права 600, владелец root
### Контейнер infra-pulse
cmpas-infra-pulse | Up 4 hours | cmpasru-infra-pulse
### Свежесть строк InfraPulse
строк всего=4256
последняя=2026-09-07 09:25:57.04 возраст_мин=2
### Таблицы аналитического контура
ReminderOutbox
Subscription
analytics_device_consent
events
events_rejected
### Наполнение событий и подписок
events=1764
подписок=1
### Куда на самом деле слушает приложение
HOSTNAME внутри контейнера: e6f44cf0cda4
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
```
