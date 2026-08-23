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

echo "### Кто выдал сертификат Т-Банка"
echo | timeout 15 openssl s_client -connect securepay.tinkoff.ru:443 -servername securepay.tinkoff.ru -showcerts 2>/dev/null \
  | grep -E "^(s|i):|subject=|issuer=" | head -8 || echo "openssl не отработал"
echo "-- есть ли в системе российский корневой центр:"
ls /usr/local/share/ca-certificates/ 2>/dev/null | head -5 || echo "каталог пуст"
grep -rl "Russian Trusted" /etc/ssl/certs/ 2>/dev/null | head -3 || echo "российского корня в доверенных нет"

echo "### Платежи: последние записи"
docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc \
  "SELECT coalesce(\"orderId\",'-') || ' | ' || coalesce(status,'?') || ' | ' || coalesce(amount::text,'?') || ' | ' || coalesce(terminal,'-') || ' | ' || \"createdAt\"
   FROM \"Payment\" ORDER BY \"createdAt\" DESC LIMIT 6;" 2>&1 | head -10
docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc \
  "SELECT 'всего платежей=' || count(*) FROM \"Payment\";" 2>&1 | head -2

echo "### Заданы ли ключи терминалов в окружении сервера (значения не печатаем)"
for k in TINKOFF_TERMINAL_KEY TINKOFF_PASSWORD TINKOFF_APP_TERMINAL_KEY TINKOFF_APP_PASSWORD SMTP_USER SMTP_PASSWORD; do
  if grep -q "^${k}=." /var/www/cmpas.ru/.env 2>/dev/null; then echo "$k: задан"; else echo "$k: НЕ задан"; fi
done

# ── Доступность сайта снаружи и изнутри (добавлено 20.08 при разборе падения) ──
# Прежняя версия отвечала только на вопрос «что с базой». Когда сайт лёг, а
# контейнеры при этом живы, нужен ответ на другой вопрос: где именно рвётся
# путь запроса — на TLS, на шлюзе или в самом приложении.

echo "### Отвечает ли приложение внутри сервера"
for probe in "http://localhost:3000/" "http://localhost:3000/diary" "http://localhost:3000/api/admin/health"; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$probe" 2>&1 || echo "нет ответа")
  echo "$probe -> $code"
done

echo "### Отвечает ли сайт снаружи (с самого сервера, через полный путь)"
for probe in "https://cmpas.ru/" "https://cmpas.ru/diary" "https://cmpas.ru/admin"; do
  code=$(curl -sS -o /dev/null -w '%{http_code} за %{time_total}s' --max-time 20 "$probe" 2>&1 || echo "нет ответа")
  echo "$probe -> $code"
done

echo "### Сертификат cmpas.ru"
echo | timeout 15 openssl s_client -connect cmpas.ru:443 -servername cmpas.ru 2>/dev/null \
  | openssl x509 -noout -dates -subject -issuer 2>&1 | head -6 || echo "сертификат не читается — рукопожатие не состоялось"

echo "### Кто слушает 80 и 443"
(ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep -E ':(80|443|3000)\b' | head -10 || echo "не удалось прочитать"

echo "### Журнал приложения, последние 60 строк"
docker logs --tail 60 cmpas-app 2>&1 | tail -60 || echo "журнал не читается"

echo "### Журнал контейнера в цикле перезапуска"
docker logs --tail 30 cmpas-singbox 2>&1 | tail -30 || echo "журнал не читается"

echo "### Почему перезапускался app (последний выход)"
docker inspect cmpas-app --format 'запусков={{.RestartCount}} статус={{.State.Status}} код выхода={{.State.ExitCode}} убит по памяти={{.State.OOMKilled}} стартовал={{.State.StartedAt}}' 2>&1 | head -3 || echo "не удалось"

echo "### Свободное место подробно"
df -h / /var/lib/docker 2>&1 | head -5

echo "### Какой образ реально запущен"
docker inspect cmpas-app --format 'образ={{.Config.Image}} создан={{.Created}} запущен={{.State.StartedAt}}' 2>&1 | head -2
docker images --format '{{.Repository}}:{{.Tag}} {{.ID}} {{.CreatedSince}}' 2>&1 | head -8
echo "### Метка сборки внутри контейнера"
docker exec cmpas-app sh -lc 'cat /app/BUILD_INFO 2>/dev/null || ls -la /app/.next/BUILD_ID 2>/dev/null && cat /app/.next/BUILD_ID 2>/dev/null' 2>&1 | head -4
echo "### Есть ли панель в запущенной сборке"
docker exec cmpas-app sh -lc 'ls /app/.next/server/app/admin/ 2>/dev/null' 2>&1 | head -20
echo "### Хвост журнала последней выкладки"
tail -40 /tmp/cmpas-deploy.log 2>&1 | tail -40

# ── Аналитический контур (проверка выкатки feature/analytics) ──────────────
echo "### Флаги аналитики в /var/www/cmpas.ru/.env"
for k in ANALYTICS_INGEST_ENABLED ANALYTICS_TRACKING_ENABLED ANALYTICS_INGEST_SECRET; do
  v=$(grep -E "^${k}=" /var/www/cmpas.ru/.env 2>/dev/null | head -1 | cut -d= -f2-)
  if [ -z "$v" ]; then echo "$k: НЕ задан"
  elif [ "$k" = "ANALYTICS_INGEST_SECRET" ]; then echo "$k: задан (длина ${#v})"
  else echo "$k=$v"; fi
done

echo "### Файлы с секретом приёмника"
for f in /etc/simpas/ingest-secret /var/www/zapiski/.ingest-secret; do
  if [ -f "$f" ]; then echo "$f: есть, $(stat -c '%s байт, права %a, владелец %U' "$f" 2>/dev/null)"
  else echo "$f: ОТСУТСТВУЕТ"; fi
done

echo "### Контейнер infra-pulse"
docker ps -a --filter 'name=infra-pulse' --format '{{.Names}} | {{.Status}} | {{.Image}}' 2>&1 | head -5
docker ps -a --filter 'name=infra-pulse' -q 2>/dev/null | head -1 | grep -q . || echo "контейнера infra-pulse нет вовсе"

echo "### Свежесть строк InfraPulse"
docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc \
  "SELECT 'строк всего=' || count(*) FROM \"InfraPulse\";" 2>&1 | head -2
docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc \
  "SELECT 'последняя=' || COALESCE(max(\"collectedAt\")::text,'нет') || ' возраст_мин=' || COALESCE(round(extract(epoch from (now()-max(\"collectedAt\")))/60)::text,'-') FROM \"InfraPulse\";" 2>&1 | head -2

echo "### Таблицы аналитического контура"
docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc \
  "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('ReminderOutbox','events','events_rejected','Subscription','analytics_device_consent') ORDER BY 1;" 2>&1 | head -8

echo "### Наполнение событий и подписок"
docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc \
  "SELECT 'events=' || count(*) FROM events;" 2>&1 | head -2
docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc \
  "SELECT 'подписок=' || count(*) FROM \"Subscription\";" 2>&1 | head -2

echo "### Куда на самом деле слушает приложение"
# Проба, стучавшая изнутри контейнера в http://localhost:3000, возвращала
# «fetch failed» и молча оставляла главные проверки несделанными. Причина не в
# приёмнике: standalone-сборка Next.js слушает на имени из HOSTNAME, а docker
# ставит туда идентификатор контейнера — то есть на IP контейнера, но НЕ на
# 127.0.0.1. Печатаем факт, чтобы это не осталось догадкой.
echo "HOSTNAME внутри контейнера: $(docker exec cmpas-app printenv HOSTNAME 2>&1 | head -1)"
echo "IP контейнера: $(docker inspect cmpas-app --format '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' 2>&1 | head -1)"

# Дальше стучим С ХОСТА: путь host -> localhost:3000 -> приложение уже доказан
# кодом 200 в разделе выше. Секрет берём из .env хоста, а не из окружения
# контейнера, и НЕ печатаем — в журнал уходит только длина и код ответа.
INGEST_SECRET="$(grep -E '^ANALYTICS_INGEST_SECRET=' /var/www/cmpas.ru/.env 2>/dev/null | head -1 | cut -d= -f2-)"
MOMENTS_SECRET="$(grep -E '^ANALYTICS_INGEST_SECRET_MOMENTS=' /var/www/cmpas.ru/.env 2>/dev/null | head -1 | cut -d= -f2-)"

echo "### Приёмник без ключа (ждём 401)"
curl -sS -o /tmp/doctor-noauth.txt -w 'POST /api/ingest без Authorization -> %{http_code}\n' \
  --max-time 20 -X POST http://localhost:3000/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"event":"app_installed","ts":"2026-01-01T00:00:00Z","product":"practice","props":{},"schema_version":1}' 2>&1 | head -2
echo "  ответ: $(head -c 200 /tmp/doctor-noauth.txt 2>/dev/null)"

echo "### Разделение секретов по продуктам"
# Проверяем не «настроено ли», а «работает ли»: берём НАСТОЯЩИЙ общий секрет и
# пробуем прислать им событие МОМЕНТОВ. Он для practice и zapiski, значит
# приёмник обязан отвергнуть конверт с причиной ПРО ПРОДУКТ — при этом сам
# запрос авторизован, то есть проверяется именно привязка секрет->продукт, а не
# отсутствие секрета.
if [ -n "${INGEST_SECRET}" ]; then
  echo "ANALYTICS_INGEST_SECRET: задан, длина ${#INGEST_SECRET}"
else
  echo "ANALYTICS_INGEST_SECRET: НЕ ЗАДАН"
fi
if [ -n "${MOMENTS_SECRET}" ]; then
  echo "ANALYTICS_INGEST_SECRET_MOMENTS: задан, длина ${#MOMENTS_SECRET}"
else
  echo "ANALYTICS_INGEST_SECRET_MOMENTS: НЕ ЗАДАН (МОМЕНТЫ получат 401 — как и сегодня)"
fi

if [ -n "${INGEST_SECRET}" ]; then
  code=$(curl -sS -o /tmp/doctor-cross.txt -w '%{http_code}' --max-time 20 \
    -X POST http://localhost:3000/api/ingest \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer ${INGEST_SECRET}" \
    -d '{"event":"app_installed","ts":"2026-01-01T00:00:00Z","product":"moments","props":{},"schema_version":1}' 2>&1)
  body=$(head -c 300 /tmp/doctor-cross.txt 2>/dev/null)
  echo "секретом ПРАКТИКИ шлём событие МОМЕНТОВ -> HTTP ${code} ${body}"
  case "$body" in
    *"not allowed for product"*) echo "ПРИВЯЗКА РАБОТАЕТ: чужой продукт отвергнут" ;;
    *) echo "ВНИМАНИЕ: ожидали отказ по продукту, получили другое" ;;
  esac
else
  echo "нечем проверять привязку: секрет не найден в .env"
fi

echo "### Мобильные маршруты аналитики (без токена — ждём 401)"
for route in /api/mobile/analytics /api/mobile/analytics/consent; do
  curl -sS -o /tmp/doctor-mobile.txt -w "POST ${route} -> %{http_code}\n" --max-time 20 \
    -X POST "http://localhost:3000${route}" \
    -H 'Content-Type: application/json' -d '[]' 2>&1 | head -1
done

echo "### Срок хранения событий"
docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc \
  "SELECT 'событий старше 180 дней: ' || count(*) FROM events WHERE ts < NOW() - INTERVAL '180 days';" 2>&1 | head -2

# Проба «приёмник без заголовка» раньше стояла здесь и стучала изнутри
# контейнера. Она перенесена выше и делается с хоста: изнутри контейнера
# localhost:3000 закрыт (см. раздел «Куда на самом деле слушает приложение»),
# и проба возвращала «fetch failed» вместо кода ответа. Двух проб на один
# вопрос не нужно — нужна одна, которая отвечает.
