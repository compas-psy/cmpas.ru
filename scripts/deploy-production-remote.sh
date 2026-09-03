#!/usr/bin/env bash
set -Eeuo pipefail

cd /var/www/cmpas.ru

log() {
  printf '[deploy] %s\n' "$*"
}

upsert_env() {
  local key="$1"
  local value="$2"
  local escaped
  escaped=$(printf '%s' "$value" | sed 's/[&|]/\\&/g')
  if grep -q "^${key}=" .env 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${escaped}|" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

ensure_env() {
  local key="$1"
  local default_value="$2"
  local current
  current=$(grep "^${key}=" .env 2>/dev/null | cut -d= -f2- || true)
  if [ -z "$current" ]; then
    upsert_env "$key" "$default_value"
  fi
}

wait_for_postgres() {
  local retries=45
  until docker exec cmpas-postgres pg_isready -U postgres -d cmpas_db >/dev/null 2>&1; do
    retries=$((retries - 1))
    if [ "$retries" -le 0 ]; then
      log 'ERROR: PostgreSQL did not become ready.'
      docker logs cmpas-postgres --tail 200 2>&1 || true
      return 1
    fi
    sleep 2
  done
}

app_is_healthy() {
  curl -fsS --max-time 5 http://127.0.0.1:3000/api/auth/session >/dev/null 2>&1
}

wait_for_app() {
  local retries=60
  until app_is_healthy; do
    retries=$((retries - 1))
    if [ "$retries" -le 0 ]; then
      return 1
    fi
    sleep 2
  done
}

deploy_started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Deploy history (O-260817-12, "выкладки" card). This script already has
# full DB write access during a deploy (it applies migrations) — a
# different, already-privileged actor than the read-only infra-pulse
# collector, which only ever SELECTs from DeployLog. Silently does nothing
# if the DeployLog table doesn't exist yet (e.g. mid-rollout before this
# migration has landed) or if postgres isn't reachable — a missing log row
# must never be the reason a deploy fails.
log_deploy() {
  local result="$1"
  local note="${2:-}"
  local image_ref
  image_ref=$(docker inspect --format '{{.Config.Image}}' cmpas-app 2>/dev/null || true)
  local deploy_id="deploy-$(date +%s%N)-$$"
  # `-v name=value` substitution (:'name') only runs through psql's normal
  # input processing, not through -c — that's why this pipes a heredoc over
  # stdin instead of using -c "...".
  docker exec -i cmpas-postgres psql -U postgres -d cmpas_db -v ON_ERROR_STOP=0 \
    -v id="$deploy_id" -v started="$deploy_started_at" -v result="$result" -v image="$image_ref" -v note="$note" \
    >/dev/null 2>&1 <<-'EOSQL' || true
		INSERT INTO "DeployLog" (id, "startedAt", "finishedAt", result, "imageRef", "errorNote")
		SELECT :'id', :'started'::timestamptz, now(), :'result', NULLIF(:'image', ''), NULLIF(:'note', '')
		WHERE to_regclass('public."DeployLog"') IS NOT NULL;
	EOSQL
}

rollback_app() {
  local old_image_id="$1"
  local old_image_ref="$2"

  if [ -z "$old_image_id" ] || [ -z "$old_image_ref" ]; then
    log 'Rollback unavailable: previous app image was not found.'
    return 1
  fi

  log "Rolling back app to previous image ${old_image_id}."
  docker rm -f cmpas-app >/dev/null 2>&1 || true
  docker tag "$old_image_id" "$old_image_ref"
  docker compose up -d --no-deps --force-recreate app

  if wait_for_app; then
    log 'Rollback completed; previous application is healthy.'
    return 0
  fi

  log 'ERROR: rollback container is not healthy.'
  docker logs cmpas-app --tail 300 2>&1 || true
  return 1
}

touch .env
ensure_env DATABASE_URL 'postgresql://postgres:postgres@postgres:5432/cmpas_db'
ensure_env EMAIL_SERVER_HOST 'mailer'
ensure_env EMAIL_SERVER_PORT '25'
ensure_env EMAIL_FROM 'noreply@cmpas.ru'
ensure_env AUTH_TRUST_HOST 'true'
ensure_env AUTH_URL 'https://cmpas.ru'
ensure_env TELEGRAM_API_URL 'https://api.telegram.org'
ensure_env TELEGRAM_PROXY ''
ensure_env MAX_BOT_USERNAME ''

current_secret=$(grep '^AUTH_SECRET=' .env 2>/dev/null | cut -d= -f2- || true)
if [ -z "$current_secret" ] || printf '%s' "$current_secret" | grep -qi 'changeme\|placeholder\|secret-to-be-changed'; then
  upsert_env AUTH_SECRET "$(openssl rand -base64 32)"
  log 'AUTH_SECRET generated or replaced.'
fi

for key in \
  YANDEX_CLIENT_ID \
  YANDEX_CLIENT_SECRET \
  TELEGRAM_BOT_TOKEN \
  TELEGRAM_CHAT_ID \
  MAX_BOT_TOKEN \
  MAX_BOT_USERNAME \
  DADATA_API_KEY \
  TINKOFF_TERMINAL_KEY \
  TINKOFF_PASSWORD \
  TINKOFF_APP_TERMINAL_KEY \
  TINKOFF_APP_PASSWORD \
  SMTP_HOST \
  SMTP_PORT \
  SMTP_USER \
  SMTP_PASSWORD \
  SMTP_FROM \
  ANALYTICS_INGEST_SECRET \
  ANALYTICS_INGEST_SECRET_MOMENTS \
  INFRA_PULSE_GITHUB_TOKEN \
  INFRA_PULSE_GITHUB_ORG; do
  value="${!key:-}"
  if [ -n "$value" ]; then
    upsert_env "$key" "$value"
  fi
done

webhook_secret=$(grep '^TELEGRAM_WEBHOOK_SECRET=' .env 2>/dev/null | cut -d= -f2- || true)
if [ -z "$webhook_secret" ]; then
  upsert_env TELEGRAM_WEBHOOK_SECRET "$(openssl rand -hex 32)"
fi

# MAX_WEBHOOK_SECRET — тот же приём самозаведения. MAX Bot API (POST
# /subscriptions) принимает необязательное поле "secret" (5-256 символов,
# [A-Za-z0-9-]) и присылает его назад в заголовке X-Max-Bot-Api-Secret на
# каждой доставке апдейта — без этого любой, кто знает публичный URL вебхука,
# мог слать поддельные апдейты (см. src/app/api/max/webhook/route.ts).
# openssl rand -hex 32 даёт только [0-9a-f] — укладывается в алфавит секрета.
max_webhook_secret=$(grep '^MAX_WEBHOOK_SECRET=' .env 2>/dev/null | cut -d= -f2- || true)
if [ -z "$max_webhook_secret" ]; then
  upsert_env MAX_WEBHOOK_SECRET "$(openssl rand -hex 32)"
fi

# infra-pulse-collector's DB password (O-260817-12) — generated once here,
# same pattern as AUTH_SECRET/TELEGRAM_WEBHOOK_SECRET above, never
# committed. The role itself is (re)created further below, after migrations
# have run.
infra_pulse_password=$(grep '^INFRA_PULSE_DB_PASSWORD=' .env 2>/dev/null | cut -d= -f2- || true)
if [ -z "$infra_pulse_password" ]; then
  upsert_env INFRA_PULSE_DB_PASSWORD "$(openssl rand -base64 24)"
  log 'INFRA_PULSE_DB_PASSWORD generated.'
fi

# ANALYTICS_INGEST_SECRET (POST /ingest, Authorization: Bearer <...>) — тот же
# приём самозаведения, что у TELEGRAM_WEBHOOK_SECRET/INFRA_PULSE_DB_PASSWORD
# выше. Читается ПОСЛЕ цикла переноса из окружения (`for key in ...` выше):
# если GitHub передал секрет явно, он уже лежит в .env к этому моменту и
# генерация ниже — no-op, заданное человеком значение не трогаем. Только если
# его не задали ни оттуда, ни руками в .env раньше — рождаем его здесь, на
# сервере; в репозиторий он не попадает никогда.
# ANALYTICS_INGEST_SECRET_MOMENTS намеренно НЕ самозаводится. Общий секрет выше
# можно родить на сервере, потому что все, кому он нужен, живут на этой же
# машине. Секрет МОМЕНТОВ нужен сборке приложения на раннере GitHub — значение,
# рождённое на сервере, туда не попадёт никогда, и самозаведение дало бы лишь
# секрет, который ни с чем не сходится. Он либо приходит из секрета GitHub
# (перенесён циклом выше), либо его нет — и тогда приёмник отвечает МОМЕНТАМ
# 401, ровно как сегодня.
analytics_ingest_secret=$(grep '^ANALYTICS_INGEST_SECRET=' .env 2>/dev/null | cut -d= -f2- || true)
if [ -z "$analytics_ingest_secret" ]; then
  analytics_ingest_secret=$(openssl rand -hex 32)
  upsert_env ANALYTICS_INGEST_SECRET "$analytics_ingest_secret"
  log 'ANALYTICS_INGEST_SECRET generated.'
fi

# Мост к ЗАПИСКАМ: на этом же сервере в /var/www/zapiski живёт соседний
# продукт, и его код, который шлёт события в наш POST /ingest, обязан знать
# тот же ANALYTICS_INGEST_SECRET. Пишет — эта выкладка (ПРАКТИКА, секрет
# рождается здесь же, см. выше); читает — выкладка/рантайм ЗАПИСОК на этом
# сервере. Не через переменную окружения: у ЗАПИСОК своя выкладка и свой
# .env, общего источника переменных между двумя продуктами до сих пор не
# было, а заводить его ради одного значения — лишняя связанность двух
# независимых деплоев. Поэтому — общий файл на диске сервера, а не
# воображаемый общий env. Перезаписывается на КАЖДОЙ выкладке (не только при
# первой генерации выше), иначе смена секрета человеком в .env ПРАКТИКИ
# никогда не доедет до соседа. Права строго 600, владелец root — секрет для
# межпроцессного чтения (root/сервис ЗАПИСОК), не для всех на сервере.
mkdir -p /etc/simpas
( umask 077; printf '%s\n' "$analytics_ingest_secret" > /etc/simpas/ingest-secret )
chmod 600 /etc/simpas/ingest-secret
chown root:root /etc/simpas/ingest-secret
log 'ANALYTICS_INGEST_SECRET synced to /etc/simpas/ingest-secret for ЗАПИСОК.'

# Вторая копия — внутрь каталога самих ЗАПИСОК, и вот почему она нужна, а не
# избыточна. Файл выше принадлежит root с правами 600. Если выкладка ЗАПИСОК
# ходит на сервер под другим ssh-пользователем (а это разные репозитории с
# разными секретами SERVER_USER — знать наверняка мы не можем), она его
# просто не прочитает, мост тихо останется выключенным, и человеку придётся
# лезть руками разбираться с правами. Чтобы этого вопроса не существовало
# вовсе, кладём копию в /var/www/zapiski — каталог, который выкладка ЗАПИСОК
# заведомо читает и пишет, — и отдаём её владельцу ЭТОГО каталога, кем бы он
# ни был. Права те же 600: сосед читает как свой файл, посторонние — никак.
# Каталога может не быть, если провижн ЗАПИСОК ещё не отработал: тогда просто
# пропускаем, это не ошибка нашей выкладки.
if [ -d /var/www/zapiski ]; then
  zapiski_owner=$(stat -c '%u:%g' /var/www/zapiski)
  ( umask 077; printf '%s\n' "$analytics_ingest_secret" > /var/www/zapiski/.ingest-secret )
  chmod 600 /var/www/zapiski/.ingest-secret
  chown "$zapiski_owner" /var/www/zapiski/.ingest-secret
  log 'ANALYTICS_INGEST_SECRET also placed in /var/www/zapiski/.ingest-secret (owned by that directory owner).'
else
  log 'ЗАПИСКИ directory /var/www/zapiski is absent; skipping the second copy of the ingest secret.'
fi

# Аналитический слой (O-260817-17, ТЗ_management_dashboard.md) написан и
# покрыт тестами целиком, но CLAUDE.md §5.2 / устав §6.1 требуют, чтобы новая
# функциональность ехала за флагом, выключенным по умолчанию
# (src/lib/analytics/flags.ts), пока человек явно не включит. Учредитель
# включил прямым распоряжением: после этого прохода деплоя должно работать
# всё, кроме резервной копии (которая тут ни при чём — она делается
# несколькими строками ниже, безусловно, для любого деплоя, флагами не
# управляется). Решение зафиксировано здесь явно, а не молча — чтобы
# следующий читатель видел причину, а не самоуправство скрипта. ensure_env, а
# не upsert_env: если человек когда-нибудь выставит значение в .env руками,
# деплой его не перебьёт.
ensure_env ANALYTICS_INGEST_ENABLED 'true'
ensure_env ANALYTICS_TRACKING_ENABLED 'true'

log "AUTH_SECRET fingerprint: $(grep '^AUTH_SECRET=' .env | cut -d= -f2- | cut -c1-8)..."

vpn_enabled=0
if [ -n "${MIERU_SERVER:-}" ] && [ -n "${MIERU_PORT:-}" ] && [ -n "${MIERU_USERNAME:-}" ] && [ -n "${MIERU_PASSWORD:-}" ]; then
  log 'Preparing sing-box configuration.'
  escaped_server=$(printf '%s' "$MIERU_SERVER" | sed 's/[&|]/\\&/g')
  escaped_port=$(printf '%s' "$MIERU_PORT" | sed 's/[&|]/\\&/g')
  escaped_username=$(printf '%s' "$MIERU_USERNAME" | sed 's/[&|]/\\&/g')
  escaped_password=$(printf '%s' "$MIERU_PASSWORD" | sed 's/[&|]/\\&/g')
  sed \
    -e "s|\${MIERU_SERVER}|${escaped_server}|g" \
    -e "s|\${MIERU_PORT}|${escaped_port}|g" \
    -e "s|\${MIERU_USERNAME}|${escaped_username}|g" \
    -e "s|\${MIERU_PASSWORD}|${escaped_password}|g" \
    deploy/singbox-config.template.json > deploy/singbox-config.json

  if docker run --rm \
      -v "$(pwd)/deploy/singbox-config.json:/c.json:ro" \
      ghcr.io/sagernet/sing-box:latest check -c /c.json; then
    vpn_enabled=1
    upsert_env TELEGRAM_PROXY 'http://singbox:1080'
  else
    log 'WARNING: sing-box configuration check failed; deploying without VPN sidecar.'
    upsert_env TELEGRAM_PROXY ''
  fi
else
  upsert_env TELEGRAM_PROXY ''
fi

old_image_id=$(docker inspect --format '{{.Image}}' cmpas-app 2>/dev/null || true)
old_image_ref=$(docker inspect --format '{{.Config.Image}}' cmpas-app 2>/dev/null || true)

backup_dir='/var/backups/cmpas'
mkdir -p "$backup_dir"
if docker ps --format '{{.Names}}' | grep -qx 'cmpas-postgres'; then
  backup_file="$backup_dir/db_backup_$(date +%Y%m%d_%H%M%S).sql"
  log "Creating database backup: ${backup_file}"
  docker exec cmpas-postgres pg_dump -U postgres -d cmpas_db > "${backup_file}.tmp"
  mv "${backup_file}.tmp" "$backup_file"
  ls -t "$backup_dir"/db_backup_*.sql 2>/dev/null | tail -n +11 | xargs -r rm -f
else
  log 'PostgreSQL is not currently running; this is treated as an initial/startup deployment.'
fi

log 'Validating Docker Compose configuration.'
docker compose config --quiet

log 'Building the new application image while the old app remains online.'
# --profile infra-pulse: без него `docker compose build` не видит сервис
# infra-pulse вовсе (у него отдельная цель infra-pulse-collector в том же
# Dockerfile) — образ для коллектора иначе не собирался бы ни разу.
docker compose --profile infra-pulse build app infra-pulse

systemctl stop exim4 postfix sendmail 2>/dev/null || true
systemctl disable exim4 postfix sendmail 2>/dev/null || true

if [ "$vpn_enabled" = '1' ]; then
  export COMPOSE_PROFILES=vpn
  docker compose --profile vpn up -d postgres mailer singbox
else
  docker compose up -d postgres mailer
fi

wait_for_postgres
log 'PostgreSQL is ready.'

log 'Attempting Prisma migrations. A failure here is recorded and must be justified by strict schema verification below.'
migrations_failed=0
if docker compose run --rm --no-deps app node node_modules/prisma/build/index.js migrate deploy; then
  log 'Prisma migrations applied.'
else
  migrations_failed=1
  log 'WARNING: Prisma migrate deploy failed. Deploy continues only because strict schema verification now checks EVERY column the app expects; if anything is missing the deploy stops before the app is recreated.'
fi

log 'Applying beta schema safety net.'
docker cp deploy/beta-mvp-schema-fixes.sql cmpas-postgres:/tmp/beta-mvp-schema-fixes.sql
docker exec cmpas-postgres psql -v ON_ERROR_STOP=1 -U postgres -d cmpas_db -f /tmp/beta-mvp-schema-fixes.sql

log 'Running strict schema verification against the new image.'
if ! docker compose run --rm --no-deps app node scripts/verify-production-schema.js; then
  log 'ERROR: database does not match the schema the new application expects. Not touching the running app.'
  if [ "$migrations_failed" = '1' ]; then
    log 'ERROR: prisma migrate deploy had already failed above — that is the likely cause.'
  fi
  log_deploy schema_guard_stopped 'verify-production-schema.js failed'
  exit 1
fi

# infra-pulse-collector's role (O-260817-12) — provisioned here, not in
# docker/init-postgres.sh, because that script only runs on a brand-new
# empty data directory and this database already has one. Runs every
# deploy, after migrations, so InfraPulse (which the grants below reference)
# is guaranteed to exist by now. Idempotent: safe to run against a role and
# grants that already exist.
if [ -n "$infra_pulse_password" ] && docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc \
    "SELECT to_regclass('public.\"InfraPulse\"') IS NOT NULL;" 2>/dev/null | grep -qx t; then
  role_exists=$(docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc \
    "SELECT 1 FROM pg_roles WHERE rolname = 'infra_pulse_reader';" 2>/dev/null || true)
  # `-v name=value` substitution (:'name') only runs through psql's normal
  # input processing, not through -c — piped over stdin instead, same as
  # log_deploy above.
  if [ -z "$role_exists" ]; then
    docker exec -i cmpas-postgres psql -U postgres -d cmpas_db -v ON_ERROR_STOP=0 -v pw="$infra_pulse_password" \
      >/dev/null 2>&1 <<-'EOSQL' || log 'WARNING: infra_pulse_reader role creation failed.'
		CREATE ROLE infra_pulse_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'pw';
	EOSQL
  else
    docker exec -i cmpas-postgres psql -U postgres -d cmpas_db -v ON_ERROR_STOP=0 -v pw="$infra_pulse_password" \
      >/dev/null 2>&1 <<-'EOSQL' || log 'WARNING: infra_pulse_reader password update failed.'
		ALTER ROLE infra_pulse_reader PASSWORD :'pw';
	EOSQL
  fi
  # SELECT everywhere (existing app data, read-only); INSERT/DELETE on
  # InfraPulse only — the collector's own output table, nothing else.
  docker exec cmpas-postgres psql -U postgres -d cmpas_db -v ON_ERROR_STOP=0 \
    -c 'GRANT CONNECT ON DATABASE cmpas_db TO infra_pulse_reader;
        GRANT USAGE ON SCHEMA public TO infra_pulse_reader;
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO infra_pulse_reader;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO infra_pulse_reader;
        GRANT INSERT, DELETE ON "InfraPulse" TO infra_pulse_reader;' \
    >/dev/null 2>&1 || log 'WARNING: infra_pulse_reader grants failed.'

  # Сам подъём коллектора (O-260817-12). docker-compose.yml намеренно
  # прячет infra-pulse за profiles: ["infra-pulse"] — тот же приём, что и у
  # singbox чуть выше, — но, в отличие от singbox, явного вызова с этим
  # профилем для него нигде в скрипте не было. Итог в проде: сервис ни разу
  # не поднимался ни одним деплоем, и все восемь карточек панели, которые
  # он кормит («Техника», «Каналы»), молчали, хотя сам коллектор написан и
  # покрыт тестами (tests/infra-pulse.test.ts). Вызов — здесь, внутри этого
  # `if`, а не раньше в скрипте: раньше ещё нет ни таблицы InfraPulse (её
  # создают миграции), ни роли infra_pulse_reader (её создают несколькими
  # строками выше) — коллектор, запущенный раньше, просто не смог бы
  # подключиться и ушёл бы в цикл перезапусков.
  log 'Starting the infra-pulse collector.'
  if ! docker compose --profile infra-pulse up -d infra-pulse; then
    log 'WARNING: infra-pulse collector failed to start; site deploy continues regardless — it runs in its own container and its failure must never block or roll back the site (see docker logs cmpas-infra-pulse).'
  fi
else
  log 'Skipping infra-pulse collector start: InfraPulse table or INFRA_PULSE_DB_PASSWORD are not ready yet.'
fi

# Карточка «Стоимость инфраструктуры» (ТЗ_management_dashboard.md §6.1,
# src/lib/infra-pulse/infra-cost.ts) читает SystemConfig.infra_cost_rub — до
# сих пор его заводили SQL-запросом руками. Если INFRA_COST_RUB задан в
# окружении раннера — сеем строку сюда сами; число не выдумываем, кладём
# ровно то, что передали. Если не задан — блок ничего не делает, карточка
# честно молчит, как и раньше. Не перезаписываем уже существующую строку:
# `setInfraCost` в панели (src/app/admin/panel/actions.ts) — единственный
# другой писатель этого ключа, и если человек уже ввёл число через панель,
# повторная выкладка с тем же (или другим) INFRA_COST_RUB не должна тихо
# затирать его ввод — тот же принцип, что у ensure_env выше.
if [ -n "${INFRA_COST_RUB:-}" ]; then
  if printf '%s' "$INFRA_COST_RUB" | grep -qE '^[0-9]+$'; then
    infra_cost_json=$(printf '{"server":%s,"storage":null,"domains":null,"source":"manual","updatedAt":"%s"}' \
      "$INFRA_COST_RUB" "$(date -u +%Y-%m-%dT%H:%M:%SZ)")
    docker exec -i cmpas-postgres psql -U postgres -d cmpas_db -v ON_ERROR_STOP=0 -v value="$infra_cost_json" \
      >/dev/null 2>&1 <<-'EOSQL' || log 'WARNING: SystemConfig.infra_cost_rub seed failed.'
			INSERT INTO "SystemConfig" (key, value, label, category, "updatedAt")
			SELECT 'infra_cost_rub', :'value', 'Стоимость инфраструктуры, ₽/мес', 'panel', now()
			WHERE to_regclass('public."SystemConfig"') IS NOT NULL
			  AND NOT EXISTS (SELECT 1 FROM "SystemConfig" WHERE key = 'infra_cost_rub');
		EOSQL
  else
    log "WARNING: INFRA_COST_RUB='${INFRA_COST_RUB}' is not a plain non-negative integer; skipping SystemConfig seed."
  fi
fi

log 'Recreating only the application container.'
if ! docker compose up -d --no-deps --force-recreate app; then
  rollback_app "$old_image_id" "$old_image_ref" || true
  log_deploy rolled_back 'docker compose up --force-recreate app failed'
  exit 1
fi

if ! wait_for_app; then
  log 'ERROR: new application did not become healthy.'
  docker ps -a --filter name=cmpas-app --format '{{.Names}} | {{.Status}}'
  docker logs cmpas-app --tail 300 2>&1 || true
  rollback_app "$old_image_id" "$old_image_ref" || true
  log_deploy rolled_back 'new app container did not become healthy'
  exit 1
fi

log 'New application is healthy.'
docker compose exec -T app node scripts/verify-production-schema.js

if auth_status=$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/auth/session); then
  :
else
  auth_status='000'
fi
log "Auth endpoint status: ${auth_status}"
if [ "$auth_status" = '000' ] || [ "$auth_status" -ge 500 ]; then
  log 'ERROR: auth endpoint verification failed.'
  rollback_app "$old_image_id" "$old_image_ref" || true
  log_deploy rolled_back 'auth endpoint check failed after deploy'
  exit 1
fi

# Обратное заполнение Subscription (задача B2, scripts/backfill-subscriptions.ts)
# — однократный проход по истории Payment/User, идемпотентен
# (Subscription.userId уникален — повторный прогон не создаёт дублей, см.
# комментарий в самом скрипте). Запускается здесь: миграции уже применены
# (Subscription создаётся ими) и приложение только что подтвердило здоровье
# проверкой auth-эндпоинта выше — не раньше.
#
# Сам скрипт — TypeScript, подключает Prisma напрямую и требует tsx + полное
# дерево исходников. У образа `app` (Dockerfile, target: runner) их нет: он
# нарочно копирует только .next/standalone и пару отдельных .js-скриптов
# (см. verify-production-schema.js выше). У infra-pulse — ровно то, что
# нужно: та же стадия `builder`, тот же полный `npm install` со всеми
# devDependencies (tsx в их числе) и `COPY . .` — и этот образ уже собран
# несколькими строками выше вместе с app, пересобирать не нужно. DATABASE_URL
# у infra-pulse по умолчанию — read-only роль infra_pulse_reader, поэтому
# здесь он переопределяется на обычного пользователя приложения из .env, у
# которого есть право писать в Subscription.
#
# Ошибка НЕ валит выкладку: это дозаполнение истории, а не условие
# работоспособности приложения — сайт уже поднят и здоров к этому моменту.
log 'Running Subscription backfill (idempotent, scripts/backfill-subscriptions.ts).'
app_database_url=$(grep '^DATABASE_URL=' .env 2>/dev/null | cut -d= -f2- || true)
# --profile infra-pulse: тот же явный флаг, что у build/up этого сервиса
# выше — сервис спрятан за профилем в docker-compose.yml, и `run` его тоже
# не видит без этого флага.
if ! docker compose --profile infra-pulse run --rm --no-deps -e DATABASE_URL="$app_database_url" infra-pulse \
    npx tsx scripts/backfill-subscriptions.ts; then
  log 'WARNING: Subscription backfill failed; this only fills historical data and must not block the deploy (retry manually: docker compose --profile infra-pulse run --rm --no-deps -e DATABASE_URL=... infra-pulse npx tsx scripts/backfill-subscriptions.ts).'
fi

tg_token=$(grep '^TELEGRAM_BOT_TOKEN=' .env 2>/dev/null | cut -d= -f2- || true)
tg_api_url=$(grep '^TELEGRAM_API_URL=' .env 2>/dev/null | cut -d= -f2- || true)
tg_api_url=${tg_api_url:-https://api.telegram.org}
tg_webhook_secret=$(grep '^TELEGRAM_WEBHOOK_SECRET=' .env 2>/dev/null | cut -d= -f2- || true)
if [ -n "$tg_token" ]; then
  curl -fsS -X POST "${tg_api_url}/bot${tg_token}/setWebhook" \
    -H 'Content-Type: application/json' \
    -d "{\"url\":\"https://cmpas.ru/api/telegram/webhook\",\"drop_pending_updates\":false,\"secret_token\":\"${tg_webhook_secret}\"}" \
    >/dev/null || log 'WARNING: Telegram webhook registration failed.'
fi

max_token=$(grep '^MAX_BOT_TOKEN=' .env 2>/dev/null | cut -d= -f2- || true)
max_webhook_secret=$(grep '^MAX_WEBHOOK_SECRET=' .env 2>/dev/null | cut -d= -f2- || true)
if [ -n "$max_token" ]; then
  curl -sS -X DELETE 'https://botapi.max.ru/subscriptions' -H "Authorization: ${max_token}" >/dev/null || true
  curl -fsS -X POST 'https://botapi.max.ru/subscriptions' \
    -H "Authorization: ${max_token}" \
    -H 'Content-Type: application/json' \
    -d "{\"url\":\"https://cmpas.ru/api/max/webhook\",\"update_types\":[\"bot_started\",\"message_created\",\"message_callback\"],\"secret\":\"${max_webhook_secret}\"}" \
    >/dev/null || log 'WARNING: MAX webhook registration failed.'
fi

docker image prune -f >/dev/null || true
log_deploy success "$([ "$migrations_failed" = '1' ] && echo 'migrate deploy had failed but schema verification passed' || echo '')"
log 'Deployment completed successfully.'
