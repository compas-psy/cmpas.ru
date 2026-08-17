# Состояние базы на боевом сервере

Снято прогоном 32033118134. Файл перезаписывается каждой диагностикой.

```
Warning: Permanently added '45.144.30.190' (ED25519) to the list of known hosts.
### Журнал миграций существует?
f
### Записей в журнале
ERROR:  relation "_prisma_migrations" does not exist
LINE 1: SELECT count(*) FROM _prisma_migrations;
                             ^
### Незавершённых миграций
ERROR:  relation "_prisma_migrations" does not exist
LINE 1: SELECT count(*) FROM _prisma_migrations WHERE finished_at IS...
                             ^
### Последние 20 записей журнала
ERROR:  relation "_prisma_migrations" does not exist
LINE 1: ...'  rolled_back=' || rolled_back_at::text,'') FROM _prisma_mi...
                                                             ^
### Колонки, которые добавляли откаченные PR (должны отсутствовать)
### Таблицы, которые добавляли откаченные PR (должны отсутствовать)
### Всего таблиц в базе
42
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
```
