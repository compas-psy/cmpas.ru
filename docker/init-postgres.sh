#!/bin/bash
# This script ensures the postgres password is always correct,
# even if the volume was created with a different password.
# It runs on every container start via the postgres entrypoint.

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    ALTER USER postgres PASSWORD 'postgres';
EOSQL
