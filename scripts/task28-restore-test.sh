#!/usr/bin/env bash
# Задача 28, §2–§4: восстановление свежей боевой копии во ВРЕМЕННУЮ базу и
# production-style прогон миграций по настоящей истории `_prisma_migrations`.
#
# Почему на сервере, а не на раннере: так боевые данные никуда не уезжают.
# Копия читается там же, где снята, временная база живёт в том же кластере
# PostgreSQL 15, что и боевая, и удаляется в конце. Наружу отдаются только
# числа.
#
# ЧЕГО ЭТОТ СКРИПТ НЕ ДЕЛАЕТ. Он не притрагивается к cmpas_db: там нет ни
# одной команды записи в боевую базу, а имя временной базы проверяется
# префиксом — если оно вдруг окажется другим, скрипт останавливается, не
# начав. Выкладка не запускается, контейнер приложения не пересоздаётся.
#
# Ожидается, что рядом уже лежит /tmp/rc28 с prisma/ и scripts/ версии
# release candidate (кладёт workflow).
set -uo pipefail

STAMP=$(date +%s)
TMPDB="cmpas_rc28_${STAMP}"
PROD_DB="cmpas_db"
PG="cmpas-postgres"
IMAGE="cmpasru-app"
NET="cmpasru_default"
RC=/tmp/rc28
BACKUP_DIR=/var/backups/cmpas
FAILURES=0

say()  { echo; echo "### $*"; }
bad()  { echo "ПРОВАЛ: $*"; FAILURES=$((FAILURES + 1)); }
good() { echo "OK: $*"; }

# ── Предохранитель ───────────────────────────────────────────────────────
case "$TMPDB" in
  cmpas_rc28_*) ;;
  *) echo "ОСТАНОВ: имя временной базы «$TMPDB» не по шаблону"; exit 2 ;;
esac
if [ "$TMPDB" = "$PROD_DB" ]; then
  echo "ОСТАНОВ: временная база совпала с боевой"; exit 2
fi

psql_tmp() { docker exec "$PG" psql -U postgres -d "$TMPDB" -tAc "$1" 2>&1; }
psql_adm() { docker exec "$PG" psql -U postgres -d postgres -tAc "$1" 2>&1; }

cleanup() {
  say "Убираю за собой"
  psql_adm "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$TMPDB';" >/dev/null
  psql_adm "DROP DATABASE IF EXISTS \"$TMPDB\";" >/dev/null
  echo "временная база удалена: $TMPDB"
  docker exec "$PG" sh -c 'rm -f /tmp/rc28.dump' 2>/dev/null
  psql_adm "SELECT datname FROM pg_database WHERE datname LIKE 'cmpas_rc28_%';" | sed '/^$/d' | while read -r left; do
    echo "ОСТАЛОСЬ (надо удалить вручную): $left"
  done
}
trap cleanup EXIT

# ── 1. Свежая копия ──────────────────────────────────────────────────────
say "Свежая копия"
DUMP=$(ls -1t "$BACKUP_DIR"/cmpas_db_*.dump 2>/dev/null | head -1)
if [ -z "$DUMP" ]; then bad "копий не найдено"; exit 1; fi
BYTES=$(stat -c %s "$DUMP")
echo "файл:   $(basename "$DUMP")"
echo "размер: $BYTES байт"
echo "снята:  $(date -u -r "$DUMP" '+%Y-%m-%dT%H:%M:%SZ')"
if [ "$BYTES" -lt 10240 ]; then bad "копия подозрительно мала"; else good "копия не нулевая"; fi

AGE_HOURS=$(( ( $(date +%s) - $(stat -c %Y "$DUMP") ) / 3600 ))
echo "возраст копии: ${AGE_HOURS} ч"
if [ "$AGE_HOURS" -gt 24 ]; then bad "копия старше суток — Задача 28 требует свежую"; else good "копия свежая"; fi

# ── 2. Восстановление во временную базу ──────────────────────────────────
say "Восстановление в отдельную базу $TMPDB (PostgreSQL $(docker exec "$PG" psql -U postgres -tAc 'SHOW server_version;' | tr -d ' '))"
docker cp "$DUMP" "$PG:/tmp/rc28.dump" >/dev/null
psql_adm "CREATE DATABASE \"$TMPDB\";" >/dev/null
RESTORE_OUT=$(docker exec "$PG" pg_restore -U postgres -d "$TMPDB" --no-owner --no-privileges /tmp/rc28.dump 2>&1)
RESTORE_RC=$?
ERRS=$(printf '%s\n' "$RESTORE_OUT" | grep -c "^pg_restore: error" || true)
echo "код возврата pg_restore: $RESTORE_RC, строк с error: $ERRS"
if [ "$ERRS" -gt 0 ]; then printf '%s\n' "$RESTORE_OUT" | grep "^pg_restore: error" | head -5; fi
TABLES=$(psql_tmp "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
echo "таблиц в восстановленной базе: $TABLES"
if [ "${TABLES:-0}" -lt 20 ]; then bad "восстановленная база выглядит пустой"; else good "восстановленная база читается"; fi

# ── 3. Что было до миграций ──────────────────────────────────────────────
say "Состояние ДО миграций (только числа)"
BEFORE=$(psql_tmp "
  SELECT 'User='||(SELECT count(*) FROM \"User\")
      || ' DiaryClient='||(SELECT count(*) FROM \"DiaryClient\")
      || ' DiarySession='||(SELECT count(*) FROM \"DiarySession\")
      || ' PsychologistAddress='||(SELECT count(*) FROM \"PsychologistAddress\")
      || ' AvailabilitySlot='||(SELECT count(*) FROM \"AvailabilitySlot\")
      || ' ScheduleRule='||(SELECT count(*) FROM \"ScheduleRule\");")
echo "$BEFORE"
echo "записей в журнале миграций: $(psql_tmp 'SELECT count(*) FROM _prisma_migrations;')"
echo "незавершённых/откаченных:   $(psql_tmp 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;')"
SENTINEL_BEFORE=$(psql_tmp "SELECT count(*) FROM \"DiarySession\" WHERE id='cmtl7k6pw008gxppuhxzz5pj8';")
echo "опорная запись Задачи 0 до миграций: $SENTINEL_BEFORE"

DBURL="postgresql://postgres:postgres@postgres:5432/${TMPDB}"
run_in_app() {
  docker run --rm --network "$NET" \
    -v "$RC/prisma:/app/prisma:ro" \
    -v "$RC/scripts:/app/scripts:ro" \
    -w /app -e DATABASE_URL="$DBURL" \
    "$IMAGE" sh -c "$1" 2>&1
}

say "Проверка схемы ДО миграций"
VERIFY_BEFORE=$(run_in_app 'node node_modules/prisma/build/index.js generate >/dev/null 2>&1; node scripts/verify-production-schema.js')
echo "$VERIFY_BEFORE" | tail -25
if printf '%s' "$VERIFY_BEFORE" | grep -qi "PASS"; then
  echo "(до миграций схема уже сходится — значит новых миграций нет)"
else
  echo "(ожидаемо: боевая схема ещё не знает про новые миграции выпуска)"
fi

# ── 4. Production-style migrate deploy по НАСТОЯЩЕЙ истории ──────────────
say "prisma migrate deploy — первый прогон"
DEPLOY1=$(run_in_app 'node node_modules/prisma/build/index.js migrate deploy')
DEPLOY1_RC=$?
echo "$DEPLOY1"
echo "--- код возврата: $DEPLOY1_RC"
if [ "$DEPLOY1_RC" -ne 0 ]; then bad "migrate deploy завершился с ошибкой"; else good "migrate deploy отработал"; fi

if printf '%s' "$DEPLOY1" | grep -qiE "checksum|modified|drift|failed migration"; then
  echo "ВНИМАНИЕ: Prisma сказала что-то про контрольные суммы или расхождение — цитата выше."
fi

say "Незавершённые и откаченные миграции ПОСЛЕ первого прогона (ожидается 0)"
UNFIN=$(psql_tmp "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;")
echo "$UNFIN"
if [ "${UNFIN:-1}" != "0" ]; then bad "остались незавершённые или откаченные миграции"; else good "незавершённых миграций нет"; fi
echo "записей в журнале стало: $(psql_tmp 'SELECT count(*) FROM _prisma_migrations;')"

say "Проверка схемы ПОСЛЕ миграций"
VERIFY_AFTER=$(run_in_app 'node node_modules/prisma/build/index.js generate >/dev/null 2>&1; node scripts/verify-production-schema.js')
echo "$VERIFY_AFTER" | tail -30
if printf '%s' "$VERIFY_AFTER" | grep -qi "SCHEMA OK\|PASS"; then good "verify-production-schema прошёл"; else bad "verify-production-schema не прошёл"; fi

# ── 5. Идемпотентность ───────────────────────────────────────────────────
say "prisma migrate deploy — второй прогон (ожидается «нечего применять»)"
DEPLOY2=$(run_in_app 'node node_modules/prisma/build/index.js migrate deploy')
DEPLOY2_RC=$?
echo "$DEPLOY2"
echo "--- код возврата: $DEPLOY2_RC"
if [ "$DEPLOY2_RC" -ne 0 ]; then bad "второй migrate deploy завершился с ошибкой"; fi
if printf '%s' "$DEPLOY2" | grep -qiE "No pending migrations|уже применены|already in sync"; then
  good "второй прогон — пустая операция"
else
  bad "второй прогон не сообщил, что применять нечего"
fi

# ── 6. Данные пережили миграции ──────────────────────────────────────────
say "Состояние ПОСЛЕ миграций (только числа)"
AFTER=$(psql_tmp "
  SELECT 'User='||(SELECT count(*) FROM \"User\")
      || ' DiaryClient='||(SELECT count(*) FROM \"DiaryClient\")
      || ' DiarySession='||(SELECT count(*) FROM \"DiarySession\")
      || ' PsychologistAddress='||(SELECT count(*) FROM \"PsychologistAddress\")
      || ' AvailabilitySlot='||(SELECT count(*) FROM \"AvailabilitySlot\")
      || ' ScheduleRule='||(SELECT count(*) FROM \"ScheduleRule\");")
echo "$AFTER"
if [ "$BEFORE" = "$AFTER" ]; then good "ни одна строка не потеряна и не добавлена"; else bad "счётчики изменились: было [$BEFORE] стало [$AFTER]"; fi

SENTINEL_AFTER=$(psql_tmp "SELECT count(*) FROM \"DiarySession\" WHERE id='cmtl7k6pw008gxppuhxzz5pj8';")
echo "опорная запись Задачи 0 после миграций: $SENTINEL_AFTER"
if [ "$SENTINEL_BEFORE" = "$SENTINEL_AFTER" ] && [ "${SENTINEL_AFTER:-0}" = "1" ]; then
  good "опорная запись Задачи 0 на месте"
else
  bad "опорная запись Задачи 0 не пережила миграции"
fi

say "Опорная запись не получила кабинет и не осиротела"
psql_tmp "SELECT 'addressId пуст: ' || (\"addressId\" IS NULL)::text FROM \"DiarySession\" WHERE id='cmtl7k6pw008gxppuhxzz5pj8';"

say "Сироты после миграций (везде ожидается 0)"
psql_tmp "SELECT 'CalendarSessionLink без сессии: ' || count(*) FROM \"CalendarSessionLink\" l LEFT JOIN \"DiarySession\" s ON s.id = l.\"sessionId\" WHERE s.id IS NULL;"
psql_tmp "SELECT 'PracticeImportItem без партии: ' || count(*) FROM \"PracticeImportItem\" i LEFT JOIN \"PracticeImportBatch\" b ON b.id = i.\"batchId\" WHERE b.id IS NULL;"
psql_tmp "SELECT 'PracticeOperatorAttestation без пользователя: ' || count(*) FROM \"PracticeOperatorAttestation\" a LEFT JOIN \"User\" u ON u.id = a.\"psychologistId\" WHERE u.id IS NULL;"

say "Значения по умолчанию сохранили смысл (только числа)"
psql_tmp "SELECT 'сессий с origin IS NULL: ' || count(*) FROM \"DiarySession\" WHERE origin IS NULL;"
psql_tmp "SELECT 'пользователей с bookingLinkSharedAt: ' || count(*) FROM \"User\" WHERE \"bookingLinkSharedAt\" IS NOT NULL;"
psql_tmp "SELECT 'пользователей с onboardingDismissedAt: ' || count(*) FROM \"User\" WHERE \"onboardingDismissedAt\" IS NOT NULL;"

echo
say "ИТОГ"
echo "провалов: $FAILURES"
if [ "$FAILURES" -eq 0 ]; then echo "RESTORE+MIGRATION: PASS"; else echo "RESTORE+MIGRATION: FAIL"; fi
exit "$FAILURES"
