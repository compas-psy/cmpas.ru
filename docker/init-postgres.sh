#!/bin/bash
# This script ensures the postgres password is always correct,
# even if the volume was created with a different password.
# It runs on every container start via the postgres entrypoint.

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    ALTER USER postgres PASSWORD 'postgres';
EOSQL

# infra-pulse-collector's read-only DB role (O-260817-12) is NOT provisioned
# here: this script only reliably runs on a brand-new, empty data directory
# (standard docker-entrypoint-initdb.d semantics), and the production
# database already has data — it won't get a fresh init. The role is
# provisioned instead by scripts/deploy-production-remote.sh, which runs on
# every deploy and does so AFTER migrations, once the InfraPulse table this
# role needs write access to actually exists.
