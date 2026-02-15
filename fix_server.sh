#!/bin/bash
set -x

# 1. Kill process on port 25
fuser -k 25/tcp || true

# 2. Go to project dir
cd /var/www/cmpas.ru || exit 1

# 3. Create .env file manually because it's not in git
# Using values from deploy-docker.yml
cat <<EOF > .env
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/cmpas_db
YANDEX_CLIENT_ID=1b261cbc153045beb7d707389fc27515
YANDEX_CLIENT_SECRET=b3b7316b0f72442485f441c63ba59cba
AUTH_SECRET=changeme-in-production-please-secret-key
EMAIL_SERVER_HOST=mailer
EMAIL_SERVER_PORT=25
EMAIL_FROM=noreply@cmpas.ru
AUTH_TRUST_HOST=true
AUTH_URL=https://cmpas.ru
TELEGRAM_BOT_TOKEN=7770000000:AAHG_xxxxxxxxxxxxxxxxx
TELEGRAM_CHAT_ID=123456789
EOF

# 4. Restart containers
docker compose down
docker compose up -d --build --force-recreate

# 5. Wait for DB
echo "Waiting for DB..."
sleep 10

# 6. Reset postgres password
docker exec cmpas-postgres psql -U postgres -c "ALTER USER postgres PASSWORD 'postgres';" || true

# 7. Restart app
docker compose restart app

# 8. Check
sleep 5
docker compose ps
docker compose logs app --tail=20
