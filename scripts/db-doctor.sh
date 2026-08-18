#!/usr/bin/env bash
# Читает состояние базы на боевом сервере. Только SELECT, ничего не меняет.
set -uo pipefail

q() { docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc "$1" 2>&1 || true; }

echo "### Журнал миграций существует?"
q "SELECT to_regclass('public._prisma_migrations') IS NOT NULL;"

echo "### Записей в журнале"
q "SELECT count(*) FROM _prisma_migrations;"

echo "### Незавершённых миграций"
q "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;"

echo "### Последние 20 записей журнала"
q "SELECT migration_name || '  finished=' || coalesce(finished_at::text,'НЕТ') || coalesce('  rolled_back=' || rolled_back_at::text,'') FROM _prisma_migrations ORDER BY started_at DESC LIMIT 20;"

echo "### Колонки, которые добавляли откаченные PR (должны отсутствовать)"
q "SELECT table_name || '.' || column_name FROM information_schema.columns
   WHERE table_schema='public' AND (
     (table_name='User' AND column_name='analyticsConsentAt') OR
     (table_name='Payment' AND column_name='terminal') OR
     (table_name='PsychologistSettings' AND column_name IN ('timeSuggestEnabled','privateRemindersEnabled')));"

echo "### Таблицы, которые добавляли откаченные PR (должны отсутствовать)"
q "SELECT table_name FROM information_schema.tables WHERE table_schema='public'
   AND table_name IN ('Subscription','events','events_rejected','WaitlistEntry');"

echo "### Всего таблиц в базе"
q "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"

echo "### Строк в главных таблицах"
q "SELECT 'User=' || count(*) FROM \"User\";"
q "SELECT 'DiaryClient=' || count(*) FROM \"DiaryClient\";"
q "SELECT 'DiarySession=' || count(*) FROM \"DiarySession\";"

echo "### Место на диске"
df -h / /var 2>/dev/null | head -5

echo "### Память"
free -m 2>/dev/null | head -3

echo "### Что занимает docker"
docker system df 2>&1 | head -8

echo "### Убитые по нехватке памяти за сутки"
(journalctl -k --since "24 hours ago" 2>/dev/null | grep -ci "out of memory\|oom-kill" || dmesg 2>/dev/null | grep -ci "out of memory\|oom-kill" || echo "не удалось прочитать")

echo "### Хвост журнала последней выкладки (/tmp/cmpas-deploy.log)"
tail -n 120 /tmp/cmpas-deploy.log 2>/dev/null || echo "журнала нет"

echo "### Состояние контейнеров"
docker ps -a --format '{{.Names}} | {{.Status}}' 2>&1 | head -20

echo "### Достижим ли Т-Банк с сервера"
echo "-- имя разрешается в:"
getent hosts securepay.tinkoff.ru 2>&1 | head -3 || echo "не разрешается"
echo "-- curl с хоста:"
curl -sS -o /dev/null -w 'код %{http_code}, время %{time_total}s\n' --max-time 15 https://securepay.tinkoff.ru/v2/GetState 2>&1 | head -3
echo "-- curl из контейнера приложения:"
docker exec cmpas-app sh -lc "curl -sS -o /dev/null -w 'код %{http_code}\n' --max-time 15 https://securepay.tinkoff.ru/v2/GetState" 2>&1 | head -3
echo "-- версия node на хосте:"
node -v 2>&1 | head -1
