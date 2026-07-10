#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required before starting CMPAS" >&2
  exit 1
fi

echo "[startup] Verifying required production schema..."
node scripts/verify-production-schema.js

echo "[startup] Schema is ready. Starting Next.js..."
exec node server.js
