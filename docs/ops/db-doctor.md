# Состояние базы на боевом сервере

Снято прогоном 32125060398. Файл перезаписывается каждой диагностикой.

```
Warning: Permanently added '45.144.30.190' (ED25519) to the list of known hosts.
### Журнал миграций существует?
t
### Записей в журнале
31
### Незавершённых миграций
0
### Последние 20 записей журнала
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
20260404_add_max_chat_id  finished=2026-08-17 13:10:01.363918+00
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
48
### Строк в главных таблицах
User=14
DiaryClient=20
DiarySession=41
### Место на диске
Filesystem      Size  Used Avail Use% Mounted on
/dev/vda2        89G   62G   23G  73% /
/dev/vda2        89G   62G   23G  73% /
### Память
               total        used        free      shared  buff/cache   available
Mem:            7941        2155        1497          56        4651        5785
Swap:            511           1         510
### Что занимает docker
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          6         6         47.39GB   47.39GB (100%)
Containers      6         6         3.67MB    0B (0%)
Local Volumes   155       7         210.7MB   4.07MB (1%)
Build Cache     835       0         51.91GB   50.91GB
### Убитые по нехватке памяти за сутки
0
0
не удалось прочитать
### Хвост журнала последней выкладки (/tmp/cmpas-deploy.log)
#34 DONE 0.3s

#35 exporting to image
#35 exporting layers
#35 exporting layers 17.6s done
#35 exporting manifest sha256:8e6389c324768b2e7043563a8e7f719153df772172102cdb78f4147d67b3358d 0.0s done
#35 exporting config sha256:64c7a7aba7f6d3425d2d4be9b1c2ac716b616e5c190d45001aea95b787b7f8f1 0.0s done
#35 exporting attestation manifest sha256:e1e80c084903b811ed9dbfce0bc00974d7411e8b8d990e0f24061caa2d0cd97a 0.0s done
#35 exporting manifest list sha256:04b763f7408439f87f4c790c675a66a068c4cb3bde9806c0715bfa7707dab3c1 0.0s done
#35 naming to docker.io/library/cmpasru-app:latest done
#35 unpacking to docker.io/library/cmpasru-app:latest
#35 unpacking to docker.io/library/cmpasru-app:latest 6.6s done
#35 DONE 24.4s

#36 resolving provenance for metadata file
#36 DONE 0.0s
 Image cmpasru-app Built 
time="2026-08-18T13:03:05+03:00" level=warning msg="No services to build"
 Container cmpas-mailer Running 
 Container cmpas-postgres Running 
[deploy] PostgreSQL is ready.
[deploy] Attempting Prisma migrations. A failure here is recorded and must be justified by strict schema verification below.
time="2026-08-18T13:03:05+03:00" level=warning msg="No services to build"
time="2026-08-18T13:03:05+03:00" level=warning msg="No services to build"
 Container cmpasru-app-run-1ff9cb0bad40 Creating 
 Container cmpasru-app-run-1ff9cb0bad40 Created 
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "cmpas_db", schema "public" at "postgres:5432"

31 migrations found in prisma/migrations

Applying migration `20260817140000_booking_a_b`
Applying migration `20260818090000_ingest_anonymous`

The following migration(s) have been applied:

migrations/
  └─ 20260817140000_booking_a_b/
    └─ migration.sql
  └─ 20260818090000_ingest_anonymous/
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
UPDATE 23
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
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:61: NOTICE:  column "readAt" of relation "PracticeNotification" already exists, skipping
ALTER TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:62: NOTICE:  column "createdAt" of relation "PracticeNotification" already exists, skipping
ALTER TABLE
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:65: NOTICE:  relation "PracticeNotification_psychologistId_createdAt_idx" already exists, skipping
psql:/tmp/beta-mvp-schema-fixes.sql:67: NOTICE:  relation "PracticeNotification_psychologistId_readAt_idx" already exists, skipping
CREATE INDEX
[deploy] Running strict schema verification against the new image.
time="2026-08-18T13:03:10+03:00" level=warning msg="No services to build"
time="2026-08-18T13:03:10+03:00" level=warning msg="No services to build"
 Container cmpasru-app-run-d8a2383237ca Creating 
 Container cmpasru-app-run-d8a2383237ca Created 
[schema] Все 43 таблиц и их колонки на месте.
[schema] Чтение User через клиент Prisma прошло.
[schema] Чтение DiaryClient через клиент Prisma прошло.
[schema] Чтение DiarySession через клиент Prisma прошло.
[schema] Prisma migration history has no unfinished entries.
[deploy] Recreating only the application container.
time="2026-08-18T13:03:12+03:00" level=warning msg="No services to build"
 Container cmpas-app Recreate 
 Container cmpas-app Recreated 
 Container cmpas-app Starting 
 Container cmpas-app Started 
[deploy] New application is healthy.
[schema] Все 43 таблиц и их колонки на месте.
[schema] Чтение User через клиент Prisma прошло.
[schema] Чтение DiaryClient через клиент Prisma прошло.
[schema] Чтение DiarySession через клиент Prisma прошло.
[schema] Prisma migration history has no unfinished entries.
[deploy] Auth endpoint status: 200
curl: (28) Failed to connect to api.telegram.org port 443 after 133108 ms: Couldn't connect to server
[deploy] WARNING: Telegram webhook registration failed.
[deploy] Deployment completed successfully.
### Состояние контейнеров
cmpas-app | Up 3 minutes
zapiski-api | Up 19 hours (healthy)
zapiski-postgres | Up 8 days (healthy)
cmpas-mailer | Up 10 days (healthy)
cmpas-postgres | Up 10 days (healthy)
cmpas-singbox | Restarting (1) 22 seconds ago
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
```
