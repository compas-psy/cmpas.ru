#!/bin/bash
set -e

echo "Starting system repair..."

# 1. Restart Postgres to ensure clean state
echo "Restarting Postgres container..."
docker compose stop postgres
docker compose rm -f postgres
docker compose up -d postgres

# 2. Wait for Postgres to be ready to accept connections
echo "Waiting for Postgres to be ready..."
RETRIES=30
until docker exec cmpas-postgres pg_isready -U postgres || [ $RETRIES -eq 0 ]; do
  echo "Postgres is unavailable - sleeping... ($RETRIES retries left)"
  RETRIES=$((RETRIES-1))
  sleep 2
done

if [ $RETRIES -eq 0 ]; then
  echo "Error: Postgres failed to start within timeout."
  exit 1
fi

echo "Postgres is ready!"

# 3. Reset Password explicitly
echo "Resetting Postgres password to match configuration..."
docker exec cmpas-postgres psql -U postgres -c "ALTER USER postgres PASSWORD 'postgres';"
echo "Password reset complete."

# 4. Restart Application
echo "Restarting Application..."
docker compose restart app

# 5. Wait for App to be healthy
echo "Waiting for App to become healthy..."
APP_RETRIES=30
until docker compose exec -T app wget -q --spider http://localhost:3000/ || [ $APP_RETRIES -eq 0 ]; do
  echo "App is starting... ($APP_RETRIES retries left)"
  APP_RETRIES=$((APP_RETRIES-1))
  sleep 2
done

if [ $APP_RETRIES -eq 0 ]; then
    echo "Warning: App health check timed out, but container is running. Check logs manually."
else
    echo "App is healthy and responded to request!"
fi

echo "Repair complete!"
