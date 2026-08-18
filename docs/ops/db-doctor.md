# Состояние базы на боевом сервере

Снято прогоном 32127563661. Файл перезаписывается каждой диагностикой.

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
Mem:            7941        2523         955          55        4823        5417
Swap:            511          62         449
### Что занимает docker
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          6         6         48.36GB   48.36GB (100%)
Containers      6         6         3.67MB    0B (0%)
Local Volumes   155       7         211MB     4.07MB (1%)
Build Cache     853       0         53.35GB   52.35GB
### Убитые по нехватке памяти за сутки
0
0
не удалось прочитать
### Хвост журнала последней выкладки (/tmp/cmpas-deploy.log)
#30 [runner 16/20] COPY --from=builder --chown=nextjs:nodejs /app/scripts/verify-production-schema.js ./scripts/verify-production-schema.js
#30 DONE 0.1s

#31 [runner 17/20] RUN chmod 755 ./scripts/start-production.sh
#31 DONE 0.5s

#32 [runner 18/20] COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
#32 DONE 0.3s

#33 [runner 19/20] COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
#33 DONE 0.3s

#34 [runner 20/20] COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
#34 DONE 0.7s

#35 exporting to image
#35 exporting layers
#35 exporting layers 17.9s done
#35 exporting manifest sha256:490ba95b2e7794a63728d8cb31f2a02c19c99d6429e8af0c97714204b7673f43 0.0s done
#35 exporting config sha256:fe2ef4b459d973ea33551cd608e236619ada6d68e3632e2bb807bbdab814e1b5 0.0s done
#35 exporting attestation manifest sha256:6e5526a39ae510d802165f30d87c2e394921b74de9a5778f577ddde6ccd02031 0.0s done
#35 exporting manifest list sha256:63070c70c6c5b02969b70bdff6328c3e196997f929226e44bd90250822ca177b 0.0s done
#35 naming to docker.io/library/cmpasru-app:latest done
#35 unpacking to docker.io/library/cmpasru-app:latest
#35 unpacking to docker.io/library/cmpasru-app:latest 7.2s done
#35 DONE 25.3s

#36 resolving provenance for metadata file
#36 DONE 0.0s
 Image cmpasru-app Built 
time="2026-08-18T13:36:01+03:00" level=warning msg="No services to build"
 Container cmpas-mailer Running 
 Container cmpas-postgres Running 
[deploy] PostgreSQL is ready.
[deploy] Attempting Prisma migrations. A failure here is recorded and must be justified by strict schema verification below.
time="2026-08-18T13:36:02+03:00" level=warning msg="No services to build"
time="2026-08-18T13:36:02+03:00" level=warning msg="No services to build"
 Container cmpasru-app-run-aecab386018c Creating 
 Container cmpasru-app-run-aecab386018c Created 
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "cmpas_db", schema "public" at "postgres:5432"

32 migrations found in prisma/migrations


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
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:28: NOTICE:  relation "DiarySession_paymentStatus_idx" already exists, skipping
CREATE TABLE
psql:/tmp/beta-mvp-schema-fixes.sql:38: NOTICE:  relation "FeatureInterest" already exists, skipping
psql:/tmp/beta-mvp-schema-fixes.sql:40: NOTICE:  relation "FeatureInterest_userId_feature_key" already exists, skipping
CREATE INDEX
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
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:65: NOTICE:  relation "PracticeNotification_psychologistId_createdAt_idx" already exists, skipping
CREATE INDEX
psql:/tmp/beta-mvp-schema-fixes.sql:67: NOTICE:  relation "PracticeNotification_psychologistId_readAt_idx" already exists, skipping
[deploy] Running strict schema verification against the new image.
time="2026-08-18T13:36:06+03:00" level=warning msg="No services to build"
time="2026-08-18T13:36:07+03:00" level=warning msg="No services to build"
 Container cmpasru-app-run-e345b4936dbb Creating 
 Container cmpasru-app-run-e345b4936dbb Created 
[schema] Все 45 таблиц и их колонки на месте.
[schema] Чтение User через клиент Prisma прошло.
[schema] Чтение DiaryClient через клиент Prisma прошло.
[schema] Чтение DiarySession через клиент Prisma прошло.
[schema] Prisma migration history has no unfinished entries.
[deploy] Recreating only the application container.
time="2026-08-18T13:36:10+03:00" level=warning msg="No services to build"
 Container cmpas-app Recreate 
 Container cmpas-app Recreated 
 Container cmpas-app Starting 
 Container cmpas-app Started 
[deploy] New application is healthy.
[schema] Все 45 таблиц и их колонки на месте.
[schema] Чтение User через клиент Prisma прошло.
[schema] Чтение DiaryClient через клиент Prisma прошло.
[schema] Чтение DiarySession через клиент Prisma прошло.
[schema] Prisma migration history has no unfinished entries.
[deploy] Auth endpoint status: 200
### Состояние контейнеров
cmpas-app | Up 19 seconds
zapiski-api | Up 19 hours (healthy)
zapiski-postgres | Up 8 days (healthy)
cmpas-mailer | Up 10 days (healthy)
cmpas-postgres | Up 10 days (healthy)
cmpas-singbox | Restarting (1) 54 seconds ago
### Достижим ли Т-Банк с сервера
-- имя разрешается в:
178.130.128.34  securepay.tinkoff.ru
-- curl с хоста:
curl: (60) SSL certificate problem: self-signed certificate in certificate chain
More details here: https://curl.se/docs/sslcerts.html

-- curl из контейнера приложения:
sh: 1: curl: not found
-- версия node на хосте:
v20.19.6
### Кто выдал сертификат Т-Банка
subject=CN = *.tinkoff.ru, C = RU, L = Moscow, ST = 77 \D0\B3.\D0\9C\D0\BE\D1\81\D0\BA\D0\B2\D0\B0, O = TBank, OGRN = 1027739642281, 1.2.643.100.4 = 7710140679
issuer=C = RU, O = The Ministry of Digital Development and Communications, CN = Russian Trusted Sub CA
-- есть ли в системе российский корневой центр:
российского корня в доверенных нет
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
