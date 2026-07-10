#!/usr/bin/env sh
set -u

PRISMA_CLI="node node_modules/prisma/build/index.js"
MIGRATION_OK=0

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required before starting CMPAS" >&2
  exit 1
fi

echo "[startup] Applying pending Prisma migrations..."
if $PRISMA_CLI migrate deploy; then
  MIGRATION_OK=1
  echo "[startup] Prisma migrations applied successfully."
else
  echo "[startup] WARNING: prisma migrate deploy failed." >&2
  echo "[startup] This can happen on the legacy production database when _prisma_migrations contains an unfinished entry." >&2
  echo "[startup] Applying idempotent recovery SQL; the app will start only if schema verification passes." >&2

  if ! $PRISMA_CLI db execute \
      --schema prisma/schema.prisma \
      --file deploy/schema-fixes.sql; then
    echo "[startup] WARNING: historical schema safety net reported an error; continuing to strict verification." >&2
  fi
fi

echo "[startup] Applying idempotent beta schema safety net..."
if ! $PRISMA_CLI db execute \
    --schema prisma/schema.prisma \
    --file deploy/beta-mvp-schema-fixes.sql; then
  echo "[startup] WARNING: beta schema safety net reported an error; strict verification will decide whether startup is safe." >&2
fi

echo "[startup] Verifying required production schema..."
node scripts/verify-production-schema.js

if [ "$MIGRATION_OK" != "1" ]; then
  echo "[startup] WARNING: runtime schema is valid, but Prisma migration history still requires separate maintenance." >&2
fi

echo "[startup] Schema is ready. Starting Next.js..."
exec node server.js
