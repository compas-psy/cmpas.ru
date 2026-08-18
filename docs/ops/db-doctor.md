# Состояние базы на боевом сервере

Снято прогоном 32126098644. Файл перезаписывается каждой диагностикой.

```
Warning: Permanently added '45.144.30.190' (ED25519) to the list of known hosts.
### Журнал миграций существует?
t
### Записей в журнале
32
### Незавершённых миграций
0
### Последние 20 записей журнала
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
20260419_add_schedule_rules  finished=2026-08-17 13:10:25.622061+00
20260411_schedule_v2  finished=2026-08-17 13:10:21.886053+00
20260411_admin_crm_models  finished=2026-08-17 13:10:18.369367+00
20260411_add_pageview  finished=2026-08-17 13:10:14.745036+00
20260405_add_subscription_payments  finished=2026-08-17 13:10:11.214714+00
20260405_add_max_chat_id_to_diary_client  finished=2026-08-17 13:10:07.654003+00
20260404_add_trial_ends_at  finished=2026-08-17 13:10:04.578802+00
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
50
### Строк в главных таблицах
User=14
DiaryClient=20
DiarySession=41
### Место на диске
Filesystem      Size  Used Avail Use% Mounted on
/dev/vda2        89G   63G   22G  75% /
/dev/vda2        89G   63G   22G  75% /
### Память
               total        used        free      shared  buff/cache   available
Mem:            7941        2254         432          57        5618        5686
Swap:            511           1         510
### Что занимает docker
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          6         6         49.1GB    49.1GB (100%)
Containers      6         6         28.47MB   0B (0%)
Local Volumes   155       7         211MB     4.07MB (1%)
Build Cache     840       0         52.66GB   52.41GB
### Убитые по нехватке памяти за сутки
0
0
не удалось прочитать
### Хвост журнала последней выкладки (/tmp/cmpas-deploy.log)
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:11: NOTICE:  column "source" of relation "LegalDocumentAcceptance" already exists, skipping
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:12: NOTICE:  column "documentType" of relation "LegalDocumentAcceptance" already exists, skipping
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:13: NOTICE:  column "documentVersion" of relation "LegalDocumentAcceptance" already exists, skipping
ALTER TABLE
UPDATE 23
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
psql:/tmp/beta-mvp-schema-fixes.sql:38: NOTICE:  relation "FeatureInterest" already exists, skipping
CREATE TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:40: NOTICE:  relation "FeatureInterest_userId_feature_key" already exists, skipping
CREATE INDEX
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
psql:/tmp/beta-mvp-schema-fixes.sql:61: NOTICE:  column "readAt" of relation "PracticeNotification" already exists, skipping
ALTER TABLE
ALTER TABLE
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:62: NOTICE:  column "createdAt" of relation "PracticeNotification" already exists, skipping
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:65: NOTICE:  relation "PracticeNotification_psychologistId_createdAt_idx" already exists, skipping
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:67: NOTICE:  relation "PracticeNotification_psychologistId_readAt_idx" already exists, skipping
[deploy] Running strict schema verification against the new image.
time="2026-08-18T13:13:49+03:00" level=warning msg="No services to build"
time="2026-08-18T13:13:49+03:00" level=warning msg="No services to build"
 Container cmpasru-app-run-e0dfc91f1fa1 Creating 
 Container cmpasru-app-run-e0dfc91f1fa1 Created 
[schema] Все 45 таблиц и их колонки на месте.
[schema] Чтение User через клиент Prisma прошло.
[schema] Чтение DiaryClient через клиент Prisma прошло.
[schema] Чтение DiarySession через клиент Prisma прошло.
[schema] Prisma migration history has no unfinished entries.
[deploy] Recreating only the application container.
time="2026-08-18T13:13:51+03:00" level=warning msg="No services to build"
 Container cmpas-app Recreate 
 Container cmpas-app Recreated 
 Container cmpas-app Starting 
 Container cmpas-app Started 
[deploy] ERROR: new application did not become healthy.
cmpas-app | Up 2 minutes
npm warn exec The following package was not found and will be installed: tsx@4.23.12
[infra-pulse] starting, intervalMs=300000
[infra-pulse] server stats failed: Error: ENOENT: no such file or directory, open '/hostfs/proc/stat'
    at readFileSync (node:fs:448:20)
    at readServerStats (/app/src/lib/infra-pulse/collector.ts:32:40)
    at collectOnce (/app/src/lib/infra-pulse/collector.ts:103:9)
    at runCollectorOnce (/app/src/lib/infra-pulse/collector.ts:144:27)
    at tick (/app/scripts/infra-pulse-collector.ts:40:15)
    at loop (/app/scripts/infra-pulse-collector.ts:48:15)
    at <anonymous> (/app/scripts/infra-pulse-collector.ts:64:6)
    at Object.<anonymous> (/app/scripts/infra-pulse-collector.ts:64:11)
    at Module._compile (node:internal/modules/cjs/loader:1521:14)
    at Object.transformer (/root/.npm/_npx/fd45a72a545557e9/node_modules/tsx/dist/register-C557imBs.cjs:9:3619) {
  errno: -2,
  code: 'ENOENT',
  syscall: 'open',
  path: '/hostfs/proc/stat'
}
[infra-pulse] container stats failed: Error: connect ENOENT /var/run/docker.sock
    at PipeConnectWrap.afterConnect [as oncomplete] (node:net:1611:16) {
  errno: -2,
  code: 'ENOENT',
  syscall: 'connect',
  address: '/var/run/docker.sock'
}
[deploy] Rolling back app to previous image sha256:04b763f7408439f87f4c790c675a66a068c4cb3bde9806c0715bfa7707dab3c1.
Error response from daemon: No such image: sha256:04b763f7408439f87f4c790c675a66a068c4cb3bde9806c0715bfa7707dab3c1
time="2026-08-18T13:15:54+03:00" level=warning msg="No services to build"
 Container cmpas-app Creating 
 Container cmpas-app Created 
 Container cmpas-app Starting 
 Container cmpas-app Started 
[deploy] ERROR: rollback container is not healthy.
npm warn exec The following package was not found and will be installed: tsx@4.23.12
[infra-pulse] starting, intervalMs=300000
[infra-pulse] server stats failed: Error: ENOENT: no such file or directory, open '/hostfs/proc/stat'
    at readFileSync (node:fs:448:20)
    at readServerStats (/app/src/lib/infra-pulse/collector.ts:32:40)
    at collectOnce (/app/src/lib/infra-pulse/collector.ts:103:9)
    at runCollectorOnce (/app/src/lib/infra-pulse/collector.ts:144:27)
    at tick (/app/scripts/infra-pulse-collector.ts:40:15)
    at loop (/app/scripts/infra-pulse-collector.ts:48:15)
    at <anonymous> (/app/scripts/infra-pulse-collector.ts:64:6)
    at Object.<anonymous> (/app/scripts/infra-pulse-collector.ts:64:11)
    at Module._compile (node:internal/modules/cjs/loader:1521:14)
    at Object.transformer (/root/.npm/_npx/fd45a72a545557e9/node_modules/tsx/dist/register-C557imBs.cjs:9:3619) {
  errno: -2,
  code: 'ENOENT',
  syscall: 'open',
  path: '/hostfs/proc/stat'
}
[infra-pulse] container stats failed: Error: connect ENOENT /var/run/docker.sock
    at PipeConnectWrap.afterConnect [as oncomplete] (node:net:1611:16) {
  errno: -2,
  code: 'ENOENT',
  syscall: 'connect',
  address: '/var/run/docker.sock'
}
### Состояние контейнеров
cmpas-app | Up 3 minutes
zapiski-api | Up 19 hours (healthy)
zapiski-postgres | Up 8 days (healthy)
cmpas-mailer | Up 10 days (healthy)
cmpas-postgres | Up 10 days (healthy)
cmpas-singbox | Restarting (1) 27 seconds ago
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
```
