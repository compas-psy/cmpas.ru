# Состояние базы на боевом сервере

Снято прогоном 33756125247. Файл перезаписывается каждой диагностикой.

```
Warning: Permanently added '45.144.30.190' (ED25519) to the list of known hosts.
### Журнал миграций существует?
t
### Записей в журнале
39
### Незавершённых миграций
0
### Последние 20 записей журнала
20260829120000_booking_v2_slug_waitlist_outcome  finished=2026-08-29 11:54:58.770557+00
20260823170000_client_request_id  finished=2026-08-23 18:35:50.620241+00
20260823100000_visitor_analytics_account_id  finished=2026-08-23 15:07:36.727566+00
20260823094500_app_response_time  finished=2026-08-23 15:07:36.710728+00
20260823093000_analytics_event_id  finished=2026-08-23 15:07:36.684168+00
20260823090000_reminder_outbox  finished=2026-08-23 15:07:36.666461+00
20260820120000_infra_pulse_panel_fields  finished=2026-08-21 05:19:10.612063+00
20260818100000_infra_pulse  finished=2026-08-18 10:13:47.754507+00
20260818090000_ingest_anonymous  finished=2026-08-18 10:03:09.310097+00
20260817140000_booking_a_b  finished=2026-08-18 10:03:09.281124+00
20260817120000_analytics_f0_f1  finished=2026-08-17 13:33:19.477871+00
20260710120000_legal_acceptance_schema_sync  finished=2026-08-17 13:10:59.984689+00
20260709_legal_acceptance_audit_fields  finished=2026-08-17 13:10:55.588199+00
20260709_feature_interest  finished=2026-08-17 13:10:51.733131+00
20260705_practice_notifications  finished=2026-08-17 13:10:47.675357+00
20260705183000_add_diary_session_payment_status  finished=2026-08-17 13:10:44.177284+00
20260610_scheduled_messages_fcm  finished=2026-08-17 13:10:40.256673+00
20260531_specialist_client_documents  finished=2026-08-17 13:10:36.777919+00
20260531_configurable_documents_payments  finished=2026-08-17 13:10:33.116919+00
20260426_add_system_config  finished=2026-08-17 13:10:29.427704+00
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
### Всего таблиц в базе
53
### Строк в главных таблицах
User=16
DiaryClient=22
DiarySession=44
### Сессии по статусам (панель считает NSM только по completed)
completed=34
pending=6
confirmed=4
### Сессии по свежести
за 7 дней=2
за 30 дней=3
специалистов с сессией за 30 дней=1
самая свежая сессия=2026-09-09 00:00:00
### Специалисты по свежести регистрации
зарегистрировано за 30 дней=3
зарегистрировано за 90 дней=8
### События приёмника по продуктам и свежести
zapiski всего=1590 свежайшее=2026-09-03 12:06:31.56
moments всего=10 свежайшее=2026-08-31 08:31:26.375
practice всего=4 свежайшее=2026-09-03 07:24:33.13
событий за 30 дней=1604
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
VisitorAnalytics всего=287
из них с accountId=4
из них с utmSource=10
### Последнее показание InfraPulse: какие поля заполнены
collectedAt=2026-09-03 12:33:13.461
certDaysLeft=89 | backupAgeHours=120.7491372941759 | backupReadable=true | responseP95Ms=NULL | remindersDue=9 | remindersSent=6 | migrationsApplied=39 | migrationsDrift={"onlyInDb": [], "onlyInRepo": []} | cpuPercent=60.17699115044248 | containers=[{"name": "zapiski-api", "running": true
### События по имени (панель ищет узкие срезы)
note_saved=813
sync_completed=681
note_searched=91
practice_started=6
export_requested=4
consent_updated=4
rebooking_nudge_sent=2
app_installed=2
identity_linked=1
### Таблицы, из которых панель читает: пустые или нет
InfraPulse=3141
DeployLog=14
ReminderOutbox=9
events=1604
events_rejected=9
Subscription=1
Payment=9
### Место на диске
Filesystem      Size  Used Avail Use% Mounted on
/dev/vda2        89G   31G   54G  37% /
/dev/vda2        89G   31G   54G  37% /
### Память
               total        used        free      shared  buff/cache   available
Mem:            7941        2376         354          57        5574        5564
Swap:            511          58         453
### Что занимает docker
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          7         7         17.98GB   17.98GB (100%)
Containers      7         6         31.58MB   12.29kB (0%)
Local Volumes   155       7         273.8MB   4.07MB (1%)
Build Cache     236       0         16.87GB   16.25GB
### Убитые по нехватке памяти за сутки
0
0
не удалось прочитать
### Хвост журнала последней выкладки (/tmp/cmpas-deploy.log)
#40 DONE 0.0s
 Image cmpasru-app Built 
 Image cmpasru-infra-pulse Built 
time="2026-08-29T14:54:53+03:00" level=warning msg="No services to build"
 Container cmpas-postgres Running 
 Container cmpas-mailer Running 
[deploy] PostgreSQL is ready.
[deploy] Attempting Prisma migrations. A failure here is recorded and must be justified by strict schema verification below.
time="2026-08-29T14:54:54+03:00" level=warning msg="No services to build"
time="2026-08-29T14:54:54+03:00" level=warning msg="No services to build"
 Container cmpasru-app-run-1e8e30cf82eb Creating 
 Container cmpasru-app-run-1e8e30cf82eb Created 
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "cmpas_db", schema "public" at "postgres:5432"

39 migrations found in prisma/migrations

Applying migration `20260829120000_booking_v2_slug_waitlist_outcome`

The following migration(s) have been applied:

migrations/
  └─ 20260829120000_booking_v2_slug_waitlist_outcome/
    └─ migration.sql
      
All migrations have been successfully applied.
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
psql:/tmp/beta-mvp-schema-fixes.sql:21: NOTICE:  relation "LegalDocumentAcceptance_userId_source_idx" already exists, skipping
CREATE INDEX
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
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:42: NOTICE:  relation "FeatureInterest_createdAt_idx" already exists, skipping
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
[deploy] Running strict schema verification against the new image.
time="2026-08-29T14:54:59+03:00" level=warning msg="No services to build"
time="2026-08-29T14:55:00+03:00" level=warning msg="No services to build"
 Container cmpasru-app-run-c3ff98dcb629 Creating 
 Container cmpasru-app-run-c3ff98dcb629 Created 
[schema] Все 48 таблиц и их колонки на месте.
[schema] Чтение User через клиент Prisma прошло.
[schema] Чтение DiaryClient через клиент Prisma прошло.
[schema] Чтение DiarySession через клиент Prisma прошло.
[schema] Prisma migration history has no unfinished entries.
[deploy] Starting the infra-pulse collector.
time="2026-08-29T14:55:02+03:00" level=warning msg="No services to build"
 Container cmpas-postgres Running 
 Container cmpas-infra-pulse Recreate 
 Container cmpas-infra-pulse Recreated 
 Container cmpas-postgres Waiting 
 Container cmpas-postgres Healthy 
 Container cmpas-infra-pulse Starting 
 Container cmpas-infra-pulse Started 
[deploy] Recreating only the application container.
time="2026-08-29T14:55:12+03:00" level=warning msg="No services to build"
 Container cmpas-app Recreate 
 Container cmpas-app Recreated 
 Container cmpas-app Starting 
 Container cmpas-app Started 
[deploy] New application is healthy.
[schema] Все 48 таблиц и их колонки на месте.
[schema] Чтение User через клиент Prisma прошло.
[schema] Чтение DiaryClient через клиент Prisma прошло.
[schema] Чтение DiarySession через клиент Prisma прошло.
[schema] Prisma migration history has no unfinished entries.
[deploy] Auth endpoint status: 200
[deploy] Running Subscription backfill (idempotent, scripts/backfill-subscriptions.ts).
time="2026-08-29T14:55:21+03:00" level=warning msg="No services to build"
time="2026-08-29T14:55:21+03:00" level=warning msg="No services to build"
 Container cmpasru-infra-pulse-run-685f9414833b Creating 
 Container cmpasru-infra-pulse-run-685f9414833b Created 
npm warn exec The following package was not found and will be installed: tsx@4.23.12
[backfill-subscriptions] план: create=0 update=0 skip=1
[backfill-subscriptions] выполнено: { created: 0, updated: 0, skipped: 1 }
curl: (28) Failed to connect to api.telegram.org port 443 after 134733 ms: Couldn't connect to server
[deploy] WARNING: Telegram webhook registration failed.
[deploy] Deployment completed successfully.
### Состояние контейнеров
zapiski-api | Up 7 hours (healthy)
cmpas-app | Up 5 days
cmpas-infra-pulse | Up 5 days
zapiski-postgres | Up 13 days (healthy)
cmpas-mailer | Up 13 days (healthy)
cmpas-postgres | Up 13 days (healthy)
cmpas-singbox | Exited (1) 13 days ago
### Достижим ли Т-Банк с сервера
-- имя разрешается в:
178.130.128.34  securepay.tinkoff.ru
-- curl с хоста:
код 405, время 0.224620s
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
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=381
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=2838
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=3115
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=3435
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=3605
pending | tinkoffPaymentId=true | terminal=site | возраст_ч=3618
paid | tinkoffPaymentId=true | terminal=site | возраст_ч=3619
failed | tinkoffPaymentId=false | terminal=site | возраст_ч=3619
failed | tinkoffPaymentId=false | terminal=site | возраст_ч=3619
### Демонстрационный терминал: не подменяет ли он боевой (по журналу приложения)
упоминаний в журнале контейнера: 0
### Журнал колбэков Т-Кассы за 7 суток (RebillId и Token вычищены построчно)
### Куда Т-Касса должна слать колбэк (URL, не секрет)
AUTH_URL=https://cmpas.ru
### Живёт ли контейнер дольше, чем застрявшие платежи (иначе журнал ничего не покажет)
запущен=2026-08-29T11:55:15.796931542Z
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
https://cmpas.ru/ -> 200 за 0.193910s
https://cmpas.ru/diary -> 307 за 0.162522s
https://cmpas.ru/admin -> 307 за 0.321531s
### Сертификат cmpas.ru
notBefore=Sep  2 23:59:38 2026 GMT
notAfter=Dec  1 23:59:37 2026 GMT
subject=CN = cmpas.ru
issuer=C = US, O = Let's Encrypt, CN = YE2
### Кто слушает 80 и 443
LISTEN 0      4096                                       0.0.0.0:3000       0.0.0.0:*    users:(("docker-proxy",pid=2161157,fd=7))                                                                                                                                           
LISTEN 0      511                                        0.0.0.0:443        0.0.0.0:*    users:(("nginx",pid=1155941,fd=11),("nginx",pid=1155940,fd=11),("nginx",pid=1155939,fd=11),("nginx",pid=1155938,fd=11),("nginx",pid=523662,fd=11))                                  
LISTEN 0      511                                        0.0.0.0:80         0.0.0.0:*    users:(("nginx",pid=1155941,fd=12),("nginx",pid=1155940,fd=12),("nginx",pid=1155939,fd=12),("nginx",pid=1155938,fd=12),("nginx",pid=523662,fd=12))                                  
LISTEN 0      4096                                          [::]:3000          [::]:*    users:(("docker-proxy",pid=2161165,fd=7))                                                                                                                                           
LISTEN 0      511                                           [::]:443           [::]:*    users:(("nginx",pid=1155941,fd=13),("nginx",pid=1155940,fd=13),("nginx",pid=1155939,fd=13),("nginx",pid=1155938,fd=13),("nginx",pid=523662,fd=13))                                  
LISTEN 0      511                                           [::]:80            [::]:*    users:(("nginx",pid=1155941,fd=14),("nginx",pid=1155940,fd=14),("nginx",pid=1155939,fd=14),("nginx",pid=1155938,fd=14),("nginx",pid=523662,fd=14))                                  
### Журнал приложения, последние 60 строк
    at async m (.next/server/chunks/ssr/_adf2bbda._.js:1:6738)
    at async o (.next/server/chunks/ssr/_adf2bbda._.js:2:2712)
    at async Module.I (.next/server/chunks/ssr/_adf2bbda._.js:2:7927)
⨯ Error: Failed to find Server Action. This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at async m (.next/server/chunks/ssr/_adf2bbda._.js:1:6738)
    at async o (.next/server/chunks/ssr/_adf2bbda._.js:2:2712)
    at async Module.I (.next/server/chunks/ssr/_adf2bbda._.js:2:7927)
⨯ Error: Failed to find Server Action. This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at async m (.next/server/chunks/ssr/_adf2bbda._.js:1:6738)
    at async o (.next/server/chunks/ssr/_adf2bbda._.js:2:2712)
    at async Module.I (.next/server/chunks/ssr/_adf2bbda._.js:2:7927)
⨯ Error: Failed to find Server Action. This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at async m (.next/server/chunks/ssr/_adf2bbda._.js:1:6738)
    at async o (.next/server/chunks/ssr/_adf2bbda._.js:2:2712)
    at async Module.I (.next/server/chunks/ssr/_adf2bbda._.js:2:7927)
Error: Failed to find Server Action "x". This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at ignore-listed frames
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
Error: Failed to find Server Action "64856d17a2b5d4b4609bdcaab980209f2caa022e". This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at ignore-listed frames
⨯ Error: Failed to find Server Action. This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at async m (.next/server/chunks/ssr/_adf2bbda._.js:1:6738)
    at async o (.next/server/chunks/ssr/_adf2bbda._.js:2:2712)
    at async Module.I (.next/server/chunks/ssr/_adf2bbda._.js:2:7927)
⨯ Error: Failed to find Server Action. This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at async m (.next/server/chunks/ssr/_adf2bbda._.js:1:6738)
    at async o (.next/server/chunks/ssr/_adf2bbda._.js:2:2712)
    at async Module.I (.next/server/chunks/ssr/_adf2bbda._.js:2:7927)
⨯ Error: Failed to find Server Action. This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at async m (.next/server/chunks/ssr/_adf2bbda._.js:1:6738)
    at async o (.next/server/chunks/ssr/_adf2bbda._.js:2:2712)
    at async Module.I (.next/server/chunks/ssr/_adf2bbda._.js:2:7927)
⨯ Error: Failed to find Server Action. This request might be from an older or newer deployment.
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at async m (.next/server/chunks/ssr/_adf2bbda._.js:1:6738)
    at async o (.next/server/chunks/ssr/_adf2bbda._.js:2:2712)
    at async Module.I (.next/server/chunks/ssr/_adf2bbda._.js:2:7927)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[CRON] Запуск рассылки уведомлений (каждые 15 минут)
[Tinkoff callback] {"OrderId":"doctor-probe-nonexistent","TerminalKey":"doctor-probe","Status":"REJECTED","PaymentId":1,"Amount":1,"Token":"0000000000000000000000000000000000000000000000000000000000"}
[Tinkoff callback] Invalid token, OrderId: doctor-probe-nonexistent
### Журнал контейнера в цикле перезапуска
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
[31mFATAL[0m[0000] decode config at /etc/sing-box/config.json: outbounds[0]: unknown outbound type: mieru
### Почему перезапускался app (последний выход)
запусков=0 статус=running код выхода=0 убит по памяти=false стартовал=2026-08-29T11:55:15.796931542Z
### Свободное место подробно
Filesystem      Size  Used Avail Use% Mounted on
/dev/vda2        89G   31G   54G  37% /
/dev/vda2        89G   31G   54G  37% /
### Какой образ реально запущен
образ=cmpasru-app создан=2026-08-29T11:55:13.585247795Z запущен=2026-08-29T11:55:15.796931542Z
zapiski-api:latest 29aeb6ee0841 7 hours ago
cmpasru-infra-pulse:latest df6f2f39db46 5 days ago
cmpasru-app:latest 96d78c332828 5 days ago
postgres:16-alpine 57c72fd2a128 8 weeks ago
ghcr.io/sagernet/sing-box:latest c8b67944345d 2 months ago
boky/postfix:latest aafc77238423 8 months ago
postgres:15-alpine b3968e348b48 8 months ago
### Метка сборки внутри контейнера
-rw-r--r-- 1 nextjs nodejs 21 Aug 29 11:51 /app/.next/BUILD_ID
rnLrn0umd4zJakJ0ktYc1### Есть ли панель в запущенной сборке
(chrome)
panel
### Хвост журнала последней выкладки
 Container cmpasru-app-run-c3ff98dcb629 Creating 
 Container cmpasru-app-run-c3ff98dcb629 Created 
[schema] Все 48 таблиц и их колонки на месте.
[schema] Чтение User через клиент Prisma прошло.
[schema] Чтение DiaryClient через клиент Prisma прошло.
[schema] Чтение DiarySession через клиент Prisma прошло.
[schema] Prisma migration history has no unfinished entries.
[deploy] Starting the infra-pulse collector.
time="2026-08-29T14:55:02+03:00" level=warning msg="No services to build"
 Container cmpas-postgres Running 
 Container cmpas-infra-pulse Recreate 
 Container cmpas-infra-pulse Recreated 
 Container cmpas-postgres Waiting 
 Container cmpas-postgres Healthy 
 Container cmpas-infra-pulse Starting 
 Container cmpas-infra-pulse Started 
[deploy] Recreating only the application container.
time="2026-08-29T14:55:12+03:00" level=warning msg="No services to build"
 Container cmpas-app Recreate 
 Container cmpas-app Recreated 
 Container cmpas-app Starting 
 Container cmpas-app Started 
[deploy] New application is healthy.
[schema] Все 48 таблиц и их колонки на месте.
[schema] Чтение User через клиент Prisma прошло.
[schema] Чтение DiaryClient через клиент Prisma прошло.
[schema] Чтение DiarySession через клиент Prisma прошло.
[schema] Prisma migration history has no unfinished entries.
[deploy] Auth endpoint status: 200
[deploy] Running Subscription backfill (idempotent, scripts/backfill-subscriptions.ts).
time="2026-08-29T14:55:21+03:00" level=warning msg="No services to build"
time="2026-08-29T14:55:21+03:00" level=warning msg="No services to build"
 Container cmpasru-infra-pulse-run-685f9414833b Creating 
 Container cmpasru-infra-pulse-run-685f9414833b Created 
npm warn exec The following package was not found and will be installed: tsx@4.23.12
[backfill-subscriptions] план: create=0 update=0 skip=1
[backfill-subscriptions] выполнено: { created: 0, updated: 0, skipped: 1 }
curl: (28) Failed to connect to api.telegram.org port 443 after 134733 ms: Couldn't connect to server
[deploy] WARNING: Telegram webhook registration failed.
[deploy] Deployment completed successfully.
### Флаги аналитики в /var/www/cmpas.ru/.env
ANALYTICS_INGEST_ENABLED=true
ANALYTICS_TRACKING_ENABLED=true
ANALYTICS_INGEST_SECRET: задан (длина 64)
### Файлы с секретом приёмника
/etc/simpas/ingest-secret: есть, 65 байт, права 600, владелец root
/var/www/zapiski/.ingest-secret: есть, 65 байт, права 600, владелец root
### Контейнер infra-pulse
cmpas-infra-pulse | Up 5 days | cmpasru-infra-pulse
### Свежесть строк InfraPulse
строк всего=3141
последняя=2026-09-03 12:33:13.461 возраст_мин=3
### Таблицы аналитического контура
ReminderOutbox
Subscription
analytics_device_consent
events
events_rejected
### Наполнение событий и подписок
events=1604
подписок=1
### Куда на самом деле слушает приложение
HOSTNAME внутри контейнера: 024d0303838b
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
```
