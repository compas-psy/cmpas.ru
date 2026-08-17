#!/usr/bin/env bash
# Заводит журнал миграций на боевой базе, не выполняя сами миграции.
#
# Зачем. В базе нет таблицы _prisma_migrations: схема доезжала другим путём,
# и `prisma migrate deploy` падал на каждой выкладке, ничего не применяя.
# Пока это не исправлено, любая новая миграция молча не применяется.
#
# Что делает. Отмечает каждую миграцию из prisma/migrations как уже применённую
# (`migrate resolve --applied`). Данные не трогаются: пишется только журнал.
#
# Отказывается работать, если журнал уже есть — повторный прогон безвреден.
set -euo pipefail

cd /var/www/cmpas.ru

log() { echo "[baseline] $*"; }

has_table=$(docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc \
  "SELECT to_regclass('public._prisma_migrations') IS NOT NULL;")

if [ "$has_table" = 't' ]; then
  log "Журнал миграций уже существует. Ничего не делаю."
  docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc \
    "SELECT 'записей=' || count(*) FROM _prisma_migrations;"
  exit 0
fi

log "Журнала миграций нет. Снимаю копию базы перед тем, как что-либо менять."
mkdir -p /var/backups/cmpas
dump="/var/backups/cmpas/cmpas_db_$(date +%F_%H%M%S)_pre-baseline.dump"
docker exec cmpas-postgres pg_dump -U postgres -d cmpas_db -Fc > "$dump"
bytes=$(stat -c %s "$dump")
log "Копия: $dump ($bytes байт)"
if [ "$bytes" -lt 10240 ]; then
  log "ОШИБКА: копия подозрительно мала. Останавливаюсь, ничего не менял."
  rm -f "$dump"
  exit 1
fi
docker run --rm -v /var/backups/cmpas:/b:ro postgres:15-alpine \
  pg_restore --list "/b/$(basename "$dump")" > /dev/null
log "Копия читается."

log "Отмечаю существующие миграции применёнными."
count=0
for dir in prisma/migrations/*/; do
  name=$(basename "$dir")
  [ "$name" = 'migration_lock.toml' ] && continue
  # < /dev/null обязателен: скрипт приходит на сервер через stdin, а docker
  # compose run без этого съедает остаток скрипта и всё, что идёт после цикла,
  # молча не выполняется. Первый прогон 17.08 на этом и оборвался.
  docker compose run --rm --no-deps app \
    node node_modules/prisma/build/index.js migrate resolve --applied "$name" < /dev/null
  count=$((count + 1))
done
log "Отмечено миграций: $count"

log "Состояние журнала после операции:"
docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc \
  "SELECT 'записей=' || count(*) FROM _prisma_migrations;"
docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc \
  "SELECT 'незавершённых=' || count(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;"

log "Проверяю, что база по-прежнему соответствует схеме приложения."
docker compose run --rm --no-deps app node scripts/verify-production-schema.js < /dev/null

log "Готово. Данные не изменялись, заведён только журнал миграций."
