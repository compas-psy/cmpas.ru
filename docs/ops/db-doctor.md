# Состояние базы на боевом сервере

Снято прогоном 32035789907. Файл перезаписывается каждой диагностикой.

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
```
