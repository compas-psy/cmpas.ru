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

# Disk hygiene (O-260818-02): build cache accumulated to 51GB with only 24GB
# free out of 89GB — not the 18.08 outage's cause, but the next few deploys
# would have run out of disk mid-build otherwise. Runs at the very start,
# before anything else touches the disk. Only dangling (untagged) images and
# build-cache layers older than a week are removed: a plain `docker image
# prune` (no -a) never touches the image `cmpas-app` currently runs, tagged
# images are never "dangling".
log 'Уборка кэша сборок и неиспользуемых образов старше недели.'
docker builder prune -f --filter 'until=168h' >/dev/null 2>&1 || true
docker image prune -f --filter 'until=168h' >/dev/null 2>&1 || true

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
  SMTP_FROM; do
  value="${!key:-}"
  if [ -n "$value" ]; then
    upsert_env "$key" "$value"
  fi
done

webhook_secret=$(grep '^TELEGRAM_WEBHOOK_SECRET=' .env 2>/dev/null | cut -d= -f2- || true)
if [ -z "$webhook_secret" ]; then
  upsert_env TELEGRAM_WEBHOOK_SECRET "$(openssl rand -hex 32)"
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

log "AUTH_SECRET fingerprint: $(grep '^AUTH_SECRET=' .env | cut -d= -f2- | cut -c1-8)..."

# VPN sidecar removed (O-260818-02): docs/ops/db-doctor.md's 18.08
# diagnostics found cmpas-singbox permanently in "Restarting (1)" —
# investigated and reproduced locally: `sing-box check` on
# deploy/singbox-config.template.json fails unconditionally with
# "unknown outbound type: mieru", on every sing-box release that exists
# (mieru is an unrelated, independent proxy project — sagernet/sing-box has
# never had a "mieru" outbound type). This config could not have ever
# produced a working tunnel; the branch below always fell through to the
# "check failed" `else`, so TELEGRAM_PROXY has always been unset on every
# real deploy and src/lib/telegram-proxy.ts has always run in its already-
# documented not-configured fallback. A silently, permanently restarting
# container that never did anything is worse than no container — removing
# it rather than leaving it flapping. The server itself still has the old
# container from before this was noticed; clean it up on this deploy too.
docker rm -f cmpas-singbox >/dev/null 2>&1 || true
upsert_env TELEGRAM_PROXY ''

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

available_gb=$(($(df --output=avail -k / | tail -n 1 | tr -d ' ') / 1024 / 1024))
if [ "$available_gb" -lt 10 ]; then
  log "ERROR: свободно ${available_gb}ГБ на /, нужно не меньше 10ГБ — сборка образа не запускается. Освободить: docker builder prune, docker image prune, старые дампы в ${backup_dir}."
  log_deploy disk_guard_stopped "only ${available_gb}GB free before build"
  exit 1
fi
log "Свободно ${available_gb}ГБ на /."

log 'Building the new application image while the old app remains online.'
docker compose build app

systemctl stop exim4 postfix sendmail 2>/dev/null || true
systemctl disable exim4 postfix sendmail 2>/dev/null || true

docker compose up -d postgres mailer

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
if [ -n "$max_token" ]; then
  curl -sS -X DELETE 'https://botapi.max.ru/subscriptions' -H "Authorization: ${max_token}" >/dev/null || true
  curl -fsS -X POST 'https://botapi.max.ru/subscriptions' \
    -H "Authorization: ${max_token}" \
    -H 'Content-Type: application/json' \
    -d '{"url":"https://cmpas.ru/api/max/webhook","update_types":["bot_started","message_created","message_callback"]}' \
    >/dev/null || log 'WARNING: MAX webhook registration failed.'
fi

docker image prune -f >/dev/null || true
log_deploy success "$([ "$migrations_failed" = '1' ] && echo 'migrate deploy had failed but schema verification passed' || echo '')"
log 'Deployment completed successfully.'
