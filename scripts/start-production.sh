#!/usr/bin/env sh
set -eu

PRISMA_CLI="node node_modules/prisma/build/index.js"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required before starting CMPAS" >&2
  exit 1
fi

echo "[startup] Applying idempotent beta schema fixes..."
$PRISMA_CLI db execute \
  --schema prisma/schema.prisma \
  --file deploy/beta-mvp-schema-fixes.sql

echo "[startup] Applying pending Prisma migrations..."
$PRISMA_CLI migrate deploy

echo "[startup] Schema is ready. Starting Next.js..."
exec node server.js
