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

# ── Сырьё, из которого панель считает показатели ──────────────────────────
#
# Учредитель смотрит /admin/panel и видит пустоту, а старая админка по тем же
# предметам показывает числа. Чтобы отличить «данных действительно нет» от
# «фильтр их отрезал», нужны СЫРЫЕ распределения, а не итоги панели.
#
# Живой случай: q_practice_nsm считает только сессии со статусом completed и
# на их отсутствие отвечает «ни один специалист не провёл сессию» — при том
# что сессии в базе есть, просто ни одну не отметили завершённой вручную
# (status по умолчанию pending).
echo "### Сессии по статусам (панель считает NSM только по completed)"
q "SELECT coalesce(status,'(null)') || '=' || count(*) FROM \"DiarySession\" GROUP BY status ORDER BY count(*) DESC;"

echo "### Сессии по свежести"
q "SELECT 'за 7 дней=' || count(*) FROM \"DiarySession\" WHERE date >= now() - interval '7 days';"
q "SELECT 'за 30 дней=' || count(*) FROM \"DiarySession\" WHERE date >= now() - interval '30 days';"
q "SELECT 'специалистов с сессией за 30 дней=' || count(DISTINCT \"psychologistId\") FROM \"DiarySession\" WHERE date >= now() - interval '30 days';"
q "SELECT 'самая свежая сессия=' || coalesce(max(date)::text,'нет') FROM \"DiarySession\";"

echo "### Специалисты по свежести регистрации"
q "SELECT 'зарегистрировано за 30 дней=' || count(*) FROM \"User\" WHERE \"createdAt\" >= now() - interval '30 days';"
q "SELECT 'зарегистрировано за 90 дней=' || count(*) FROM \"User\" WHERE \"createdAt\" >= now() - interval '90 days';"

echo "### События приёмника по продуктам и свежести"
q "SELECT product || ' всего=' || count(*) || ' свежайшее=' || coalesce(max(ts)::text,'нет') FROM events GROUP BY product ORDER BY count(*) DESC;"
q "SELECT 'событий за 30 дней=' || count(*) FROM events WHERE ts >= now() - interval '30 days';"

echo "### Согласие на аналитику"
q "SELECT 'пользователей с согласием=' || count(*) FROM \"User\" WHERE \"analyticsConsentAt\" IS NOT NULL;"

echo "### Платежи и подписки по статусам"
q "SELECT coalesce(status,'(null)') || '=' || count(*) FROM \"Payment\" GROUP BY status ORDER BY count(*) DESC;"
q "SELECT 'подписок всего=' || count(*) FROM \"Subscription\";"

echo "### Триалы: панель видит их через Subscription, дашборд — через User"
# Расхождение №1 из аудита: дашборд считает User.trialEndsAt напрямую, а
# панель — только Subscription.status='trial'. Subscription пополняется
# бэкафиллом лишь для тех, у кого есть subscriptionEndsAt или оплата.
q "SELECT 'User.trialEndsAt в будущем=' || count(*) FROM \"User\" WHERE \"trialEndsAt\" > now();"
q "SELECT 'User.trialEndsAt задан вообще=' || count(*) FROM \"User\" WHERE \"trialEndsAt\" IS NOT NULL;"
q "SELECT 'User.subscriptionEndsAt задан=' || count(*) FROM \"User\" WHERE \"subscriptionEndsAt\" IS NOT NULL;"
q "SELECT coalesce(status,'(null)') || '=' || count(*) FROM \"Subscription\" GROUP BY status;"

echo "### Источники трафика: панель требует привязку к аккаунту, старая аналитика — нет"
# Расхождение №3 из аудита.
q "SELECT 'VisitorAnalytics всего=' || count(*) FROM \"VisitorAnalytics\";"
q "SELECT 'из них с accountId=' || count(*) FROM \"VisitorAnalytics\" WHERE \"accountId\" IS NOT NULL;"
q "SELECT 'из них с utmSource=' || count(*) FROM \"VisitorAnalytics\" WHERE \"utmSource\" IS NOT NULL;"

echo "### Последнее показание InfraPulse: какие поля заполнены"
# Панель гасит лампы, когда поля показания пусты. Нужно знать, какие именно.
q "SELECT 'collectedAt=' || coalesce(max(\"collectedAt\")::text,'нет') FROM \"InfraPulse\";"
q "SELECT concat_ws(' | ',
     'certDaysLeft=' || coalesce(\"certDaysLeft\"::text,'NULL'),
     'backupAgeHours=' || coalesce(\"backupAgeHours\"::text,'NULL'),
     'backupReadable=' || coalesce(\"backupReadable\"::text,'NULL'),
     'responseP95Ms=' || coalesce(\"responseP95Ms\"::text,'NULL'),
     'remindersDue=' || coalesce(\"remindersDue\"::text,'NULL'),
     'remindersSent=' || coalesce(\"remindersSent\"::text,'NULL'),
     'migrationsApplied=' || coalesce(\"migrationsApplied\"::text,'NULL'),
     'migrationsDrift=' || coalesce(\"migrationsDrift\"::text,'NULL'),
     'cpuPercent=' || coalesce(\"cpuPercent\"::text,'NULL'),
     'containers=' || coalesce(left(\"containers\"::text,40),'NULL'))
   FROM \"InfraPulse\" ORDER BY \"collectedAt\" DESC LIMIT 1;"

echo "### События по имени (панель ищет узкие срезы)"
q "SELECT event || '=' || count(*) FROM events GROUP BY event ORDER BY count(*) DESC LIMIT 25;"

echo "### Таблицы, из которых панель читает: пустые или нет"
for t in InfraPulse DeployLog ReminderOutbox events events_rejected Subscription Payment; do
  q "SELECT '$t=' || count(*) FROM \"$t\";" 2>/dev/null || echo "$t: нет таблицы"
done

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

# ── Платежи: почему 6 из 9 застряли в pending ─────────────────────────────
#
# КРАСНАЯ ЛИНИЯ: rebillId и пароль терминала не покидают модель Payment и
# переменные окружения. Редакция происходит ЗДЕСЬ, на сервере, до того как
# что-либо уйдёт по SSH — не постфактум в отчёте.

echo "### Платежи: возраст и полнота записи (без секретов)"
q "SELECT
     coalesce(status,'(null)') || ' | tinkoffPaymentId=' || (\"tinkoffPaymentId\" IS NOT NULL)::text
       || ' | terminal=' || terminal
       || ' | возраст_ч=' || round(extract(epoch from (now()-\"createdAt\"))/3600)::text
     FROM \"Payment\" ORDER BY \"createdAt\" DESC;"

echo "### Демонстрационный терминал: не подменяет ли он боевой (по журналу приложения)"
# tinkoff.ts сам кричит в лог при старте, если в production используется
# демо-терминал вместо настоящего — ищем эту строку, а не гадаем по ключам.
docker logs cmpas-app 2>&1 | grep -c "приём платежей работает на демонстрационном терминале"   | xargs -I{} echo "упоминаний в журнале контейнера: {}"

echo "### Журнал колбэков Т-Кассы за 7 суток (RebillId и Token вычищены построчно)"
# Редакция — регулярным выражением по вывод docker logs, ДО того как строки
# покинут сервер: значения RebillId и Token заменяются меткой, ключи остаются
# видны для диагностики (пришёл ли колбэк вообще, с каким статусом).
docker logs --since 168h cmpas-app 2>&1   | grep -E "\[Tinkoff"   | sed -E 's/"RebillId":[0-9]+/"RebillId":"<скрыто>"/g; s/"Token":"[^"]*"/"Token":"<скрыто>"/g'   | tail -60

echo "### Куда Т-Касса должна слать колбэк (URL, не секрет)"
# notificationUrl строится как AUTH_URL + /api/payments/callback
# (src/app/api/payments/create/route.ts). Если AUTH_URL на сервере не
# cmpas.ru — Т-Касса физически не может достучаться, и все платежи
# зависают в pending вне зависимости от того, что происходит в коде.
grep -E '^AUTH_URL=' /var/www/cmpas.ru/.env 2>/dev/null || echo "AUTH_URL: НЕ задан в .env (упадёт на запасной https://cmpas.ru)"

echo "### Живёт ли контейнер дольше, чем застрявшие платежи (иначе журнал ничего не покажет)"
# Контейнер пересоздаётся при каждой выкладке (docker compose --force-recreate).
# Если он моложе самого свежего застрявшего платежа — пустой журнал колбэков
# выше означает «журнал не пережил выкладку», а не «колбэк не пришёл».
docker inspect cmpas-app --format 'запущен={{.State.StartedAt}}' 2>&1

echo "### Достижим ли маршрут колбэка снаружи (безвредный запрос, без валидного токена)"
# OrderId заведомо не существует, Token заведомо неверный — verifyNotificationToken
# отвергнет запрос ДО обращения к базе. Проверяем не логику приёма платежей,
# а сам факт: доходит ли POST на этот путь вообще, или его режет прокси/WAF
# раньше, чем код успевает ответить.
curl -sS -o /dev/null -w 'POST /api/payments/callback (снаружи, через cmpas.ru) -> %{http_code}\n' --max-time 15 \
  -X POST https://cmpas.ru/api/payments/callback \
  -H 'Content-Type: application/json' \
  -d '{"OrderId":"doctor-probe-nonexistent","TerminalKey":"doctor-probe","Status":"REJECTED","PaymentId":1,"Amount":1,"Token":"0000000000000000000000000000000000000000000000000000000000"}' 2>&1

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
#
# device_id в конверте обязателен, и не для красоты: проверка продукта стоит
# ПОСЛЕ разбора конверта. Без device_id приёмник отвечает «missing account_id
# and device_id» и до продукта не доходит — проба возвращает отказ, выглядящий
# как успех проверки, хотя привязка не проверена вовсе. Ровно это и случилось
# в прогоне 32658893775.
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
    -d '{"event":"app_installed","ts":"2026-01-01T00:00:00Z","product":"moments","device_id":"doctor-probe","props":{},"schema_version":1}' 2>&1)
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
# Метод у каждого маршрута свой, и стучать во все POST-ом нельзя: согласие —
# это РЕСУРС с GET и PUT, POST там законно отвечает 405. Прогон 32658893775
# показал ровно 405 — и это был неверный вопрос с моей стороны, а не неверный
# ответ сервера. Спрашиваем тем методом, который маршрут принимает: иначе
# проверяется наличие метода, а не то, пускает ли маршрут без токена.
curl -sS -o /dev/null -w "POST /api/mobile/analytics -> %{http_code}\n" --max-time 20 \
  -X POST http://localhost:3000/api/mobile/analytics \
  -H 'Content-Type: application/json' -d '[]' 2>&1 | head -1
curl -sS -o /dev/null -w "GET  /api/mobile/analytics/consent -> %{http_code}\n" --max-time 20 \
  http://localhost:3000/api/mobile/analytics/consent 2>&1 | head -1
curl -sS -o /dev/null -w "PUT  /api/mobile/analytics/consent -> %{http_code}\n" --max-time 20 \
  -X PUT http://localhost:3000/api/mobile/analytics/consent \
  -H 'Content-Type: application/json' -d '{"granted":true}' 2>&1 | head -1

echo "### Срок хранения событий"
docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc \
  "SELECT 'событий старше 180 дней: ' || count(*) FROM events WHERE ts < NOW() - INTERVAL '180 days';" 2>&1 | head -2

# Проба «приёмник без заголовка» раньше стояла здесь и стучала изнутри
# контейнера. Она перенесена выше и делается с хоста: изнутри контейнера
# localhost:3000 закрыт (см. раздел «Куда на самом деле слушает приложение»),
# и проба возвращала «fetch failed» вместо кода ответа. Двух проб на один
# вопрос не нужно — нужна одна, которая отвечает.
