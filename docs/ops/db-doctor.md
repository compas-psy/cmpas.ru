# Состояние базы на боевом сервере

Снято прогоном 32123975376. Файл перезаписывается каждой диагностикой.

```
Warning: Permanently added '45.144.30.190' (ED25519) to the list of known hosts.
### Журнал миграций существует?
t
### Записей в журнале
29
### Незавершённых миграций
0
### Последние 20 записей журнала
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
20260323_add_sync_from_to_calendar_integration  finished=2026-08-17 13:09:58.112921+00
20260315_add_legal_documents  finished=2026-08-17 13:09:54.676037+00
### Колонки, которые добавляли откаченные PR (должны отсутствовать)
User.analyticsConsentAt
Payment.terminal
### Таблицы, которые добавляли откаченные PR (должны отсутствовать)
Subscription
events
events_rejected
### Всего таблиц в базе
46
### Строк в главных таблицах
User=14
DiaryClient=20
DiarySession=41
### Хвост журнала последней выкладки (/tmp/cmpas-deploy.log)
#1 DONE 0.0s

#2 [internal] load build definition from Dockerfile
#2 transferring dockerfile: 2.53kB done
#2 DONE 0.0s

#3 [internal] load metadata for docker.io/library/node:20-slim
#3 DONE 1.0s

#4 [internal] load .dockerignore
#4 transferring context: 170B done
#4 DONE 0.0s

#5 [internal] load build context
#5 DONE 0.0s

#6 [base 1/3] FROM docker.io/library/node:20-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0
#6 resolve docker.io/library/node:20-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0 0.1s done
#6 DONE 0.1s

#5 [internal] load build context
#5 transferring context: 420.83kB 0.4s done
#5 DONE 0.4s

#7 [deps 3/3] RUN npm install --legacy-peer-deps
#7 CACHED

#8 [base 2/3] RUN apt-get update -y && apt-get install -y openssl ca-certificates
#8 CACHED

#9 [base 3/3] WORKDIR /app
#9 CACHED

#10 [deps 1/3] WORKDIR /app
#10 CACHED

#11 [deps 2/3] COPY package.json package-lock.json* ./
#11 CACHED

#12 [builder 2/5] COPY --from=deps /app/node_modules ./node_modules
#12 CACHED

#13 [builder 3/5] COPY . .
#13 DONE 0.4s

#14 [builder 4/5] RUN npx prisma generate
#14 3.208 Prisma schema loaded from prisma/schema.prisma
#14 13.44 
#14 13.44 ✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in 1.19s
#14 13.44 
#14 13.44 Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)
#14 13.44 
#14 13.44 Help us improve the Prisma ORM for everyone. Share your feedback in a short 2-min survey: https://pris.ly/orm/survey/release-5-22
#14 13.44 
#14 13.62 npm notice
#14 13.62 npm notice New major version of npm available! 10.8.2 -> 12.0.2
#14 13.62 npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.0.2
#14 13.62 npm notice To update run: npm install -g npm@12.0.2
#14 13.62 npm notice
#14 DONE 13.7s

#15 [builder 5/5] RUN npm run build
#15 1.076 
#15 1.076 > cmpas.ru@0.1.0 build
#15 1.076 > next build
#15 1.076 
#15 3.937 ▲ Next.js 16.1.1 (Turbopack)
#15 3.937 
#15 4.150   Creating an optimized production build ...
#15 43.17 ✓ Compiled successfully in 37.4s
#15 43.17   Skipping validation of types
#15 43.67   Collecting page data using 3 workers ...
#15 45.55 [AUTH CRITICAL] AUTH_SECRET is not set! Authentication will not work.
#15 45.87 [AUTH CRITICAL] AUTH_SECRET is not set! Authentication will not work.
#15 46.06 Error: MAX_LINK_SECRET или AUTH_SECRET обязателен: подписывать ссылки привязки MAX нечем.
#15 46.06     at module evaluation (.next/server/chunks/[root-of-the-server]__2a0bdcc3._.js:1:1517)
#15 46.06     at instantiateModule (.next/server/chunks/[turbopack]_runtime.js:740:9)
#15 46.06     at instantiateRuntimeModule (.next/server/chunks/[turbopack]_runtime.js:768:12)
#15 46.06     at getOrInstantiateRuntimeModule (.next/server/chunks/[turbopack]_runtime.js:781:12)
#15 46.06     at Object.m (.next/server/chunks/[turbopack]_runtime.js:790:18)
#15 46.06     at Object.<anonymous> (.next/server/app/api/max/connect/route.js:6:3)
#15 46.07 [AUTH CRITICAL] AUTH_SECRET is not set! Authentication will not work.
#15 46.09 
#15 46.09 > Build error occurred
#15 46.11 Error: Failed to collect page data for /api/max/connect
#15 46.11     at ignore-listed frames {
#15 46.11   type: 'Error'
#15 46.11 }
#15 ERROR: process "/bin/sh -c npm run build" did not complete successfully: exit code: 1
------
 > [builder 5/5] RUN npm run build:
46.06     at getOrInstantiateRuntimeModule (.next/server/chunks/[turbopack]_runtime.js:781:12)
46.06     at Object.m (.next/server/chunks/[turbopack]_runtime.js:790:18)
46.06     at Object.<anonymous> (.next/server/app/api/max/connect/route.js:6:3)
46.07 [AUTH CRITICAL] AUTH_SECRET is not set! Authentication will not work.
46.09 
46.09 > Build error occurred
46.11 Error: Failed to collect page data for /api/max/connect
46.11     at ignore-listed frames {
46.11   type: 'Error'
46.11 }
------
Dockerfile:24

--------------------

  22 |     

  23 |     RUN npx prisma generate

  24 | >>> RUN npm run build

  25 |     

  26 |     # Production image

--------------------

failed to solve: process "/bin/sh -c npm run build" did not complete successfully: exit code: 1

### Состояние контейнеров
zapiski-api | Up 18 hours (healthy)
cmpas-app | Up 20 hours
zapiski-postgres | Up 8 days (healthy)
cmpas-mailer | Up 10 days (healthy)
cmpas-postgres | Up 10 days (healthy)
cmpas-singbox | Restarting (1) 39 seconds ago
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
