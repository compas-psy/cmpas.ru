# Состояние базы на боевом сервере

Снято прогоном 32127447920. Файл перезаписывается каждой диагностикой.

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
/dev/vda2        89G   64G   21G  76% /
/dev/vda2        89G   64G   21G  76% /
### Память
               total        used        free      shared  buff/cache   available
Mem:            7941        3524         219          56        4560        4416
Swap:            511           4         507
### Что занимает docker
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          6         6         49.22GB   49.22GB (100%)
Containers      6         6         28.47MB   0B (0%)
Local Volumes   155       7         211MB     4.07MB (1%)
Build Cache     843       15        52.78GB   50.85GB
### Убитые по нехватке памяти за сутки
0
0
не удалось прочитать
### Хвост журнала последней выкладки (/tmp/cmpas-deploy.log)
[deploy] AUTH_SECRET fingerprint: IKXOHxDD...
[deploy] Preparing sing-box configuration.
[31mFATAL[0m[0000] decode config at /c.json: outbounds[0]: unknown outbound type: mieru
[deploy] WARNING: sing-box configuration check failed; deploying without VPN sidecar.
[deploy] Creating database backup: /var/backups/cmpas/db_backup_20260818_133415.sql
[deploy] Validating Docker Compose configuration.
[deploy] Building the new application image while the old app remains online.
 Image cmpasru-app Building 
#1 [internal] load local bake definitions
#1 reading from stdin 500B done
#1 DONE 0.0s

#2 [internal] load build definition from Dockerfile
#2 transferring dockerfile: 3.73kB done
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
#5 transferring context: 64.61kB 0.2s done
#5 DONE 0.2s

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
#13 DONE 0.6s

#14 [builder 4/5] RUN npx prisma generate
#14 2.495 Prisma schema loaded from prisma/schema.prisma
#14 7.643 
#14 7.643 ✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in 1.38s
#14 7.643 
#14 7.643 Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)
#14 7.643 
#14 7.643 Help us improve the Prisma ORM for everyone. Share your feedback in a short 2-min survey: https://pris.ly/orm/survey/release-5-22
#14 7.643 
#14 7.820 npm notice
#14 7.820 npm notice New major version of npm available! 10.8.2 -> 12.0.2
#14 7.820 npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.0.2
#14 7.820 npm notice To update run: npm install -g npm@12.0.2
#14 7.820 npm notice
#14 DONE 7.9s

#15 [builder 5/5] RUN npm run build
#15 1.154 
#15 1.154 > cmpas.ru@0.1.0 build
#15 1.154 > next build
#15 1.154 
#15 4.255 ▲ Next.js 16.1.1 (Turbopack)
#15 4.257 
#15 4.473   Creating an optimized production build ...
### Состояние контейнеров
cmpas-app | Up 19 minutes
zapiski-api | Up 19 hours (healthy)
zapiski-postgres | Up 8 days (healthy)
cmpas-mailer | Up 10 days (healthy)
cmpas-postgres | Up 10 days (healthy)
cmpas-singbox | Restarting (1) 31 seconds ago
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
