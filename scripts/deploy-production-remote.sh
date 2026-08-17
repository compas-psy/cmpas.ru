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
  DADATA_API_KEY; do
  value="${!key:-}"
  if [ -n "$value" ]; then
    upsert_env "$key" "$value"
  fi
done

webhook_secret=$(grep '^TELEGRAM_WEBHOOK_SECRET=' .env 2>/dev/null | cut -d= -f2- || true)
if [ -z "$webhook_secret" ]; then
  upsert_env TELEGRAM_WEBHOOK_SECRET "$(openssl rand -hex 32)"
fi

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
docker compose build app

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
  exit 1
fi

log 'Recreating only the application container.'
if ! docker compose up -d --no-deps --force-recreate app; then
  rollback_app "$old_image_id" "$old_image_ref" || true
  exit 1
fi

if ! wait_for_app; then
  log 'ERROR: new application did not become healthy.'
  docker ps -a --filter name=cmpas-app --format '{{.Names}} | {{.Status}}'
  docker logs cmpas-app --tail 300 2>&1 || true
  rollback_app "$old_image_id" "$old_image_ref" || true
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
log 'Deployment completed successfully.'
