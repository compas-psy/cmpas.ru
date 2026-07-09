#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

run_sql() {
  local file="$1"
  if [[ -f "$file" ]]; then
    echo "Applying $file"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
  fi
}

# Historical idempotent deploy fixes first: creates older production tables/columns
# that some environments rely on before Prisma migrations are available.
run_sql "deploy/schema-fixes.sql"

# Beta MVP idempotent additions: legal audit snapshots and FeatureInterest.
# Kept separate so we do not risk corrupting the long legacy schema-fixes file.
run_sql "deploy/beta-mvp-schema-fixes.sql"

# Then let Prisma mark/apply migrations that exist in prisma/migrations.
# This is safe after idempotent SQL; migrations use IF NOT EXISTS where needed
# for beta additions and Prisma handles already-applied migrations normally.
npx prisma migrate deploy
