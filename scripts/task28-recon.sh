#!/usr/bin/env bash
# Task 28: разведка боевого сервера ПЕРЕД restore-тестом. Только чтение:
# ни одной команды, которая что-либо создаёт, меняет или удаляет.
#
# Нужно понять, чем на сервере можно провести production-style проверку
# истории миграций, не трогая боевую базу: есть ли образ приложения с Prisma
# внутри, куда падают копии, сколько свободного места под временную базу и
# как называется сеть контейнеров.
set -uo pipefail

echo "### Дата на сервере"
date -u '+%Y-%m-%dT%H:%M:%SZ'

echo "### Свободное место"
df -h / | tail -1

echo "### Контейнеры"
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}' 2>&1 | head -20

echo "### Образ приложения"
docker inspect cmpas-app --format '{{.Config.Image}}' 2>&1 | head -2

echo "### Есть ли Prisma и миграции внутри образа приложения"
docker exec cmpas-app sh -c 'ls node_modules/prisma/build/index.js 2>/dev/null; ls prisma/migrations 2>/dev/null | wc -l' 2>&1 | head -3

echo "### Сеть, в которой живёт postgres"
docker inspect cmpas-postgres --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>&1 | head -2

echo "### Версия PostgreSQL"
docker exec cmpas-postgres psql -U postgres -tAc 'SHOW server_version;' 2>&1 | head -2

echo "### Базы в кластере (имена, размеры)"
docker exec cmpas-postgres psql -U postgres -tAc \
  "SELECT datname || '  ' || pg_size_pretty(pg_database_size(datname)) FROM pg_database WHERE datistemplate = false;" 2>&1 | head -10

echo "### Копии базы: сколько всего и три самые свежие"
ls -1t /var/backups/cmpas/cmpas_db_*.dump 2>/dev/null | wc -l
ls -lt --time-style=long-iso /var/backups/cmpas/cmpas_db_*.dump 2>/dev/null | head -3 | awk '{print $6, $7, $5" байт", $8}'

echo "### Журнал миграций боевой базы: сколько записей и три последние"
docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc \
  "SELECT count(*) FROM _prisma_migrations;" 2>&1 | head -2
docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc \
  "SELECT migration_name FROM _prisma_migrations ORDER BY started_at DESC LIMIT 3;" 2>&1 | head -4

echo "### Незавершённые и откаченные миграции (ожидается 0)"
docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc \
  "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;" 2>&1 | head -2

echo "### Счётчики главных таблиц (только числа)"
docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc "
  SELECT 'User '            || count(*) FROM \"User\"
  UNION ALL SELECT 'DiaryClient '        || count(*) FROM \"DiaryClient\"
  UNION ALL SELECT 'DiarySession '       || count(*) FROM \"DiarySession\"
  UNION ALL SELECT 'PsychologistAddress '|| count(*) FROM \"PsychologistAddress\"
  UNION ALL SELECT 'AvailabilitySlot '   || count(*) FROM \"AvailabilitySlot\"
  UNION ALL SELECT 'ScheduleRule '       || count(*) FROM \"ScheduleRule\";" 2>&1 | head -10

echo "### Опорная запись Задачи 0 (только факт наличия)"
docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc \
  "SELECT 'cmtl7k6pw008gxppuhxzz5pj8 существует: ' || (count(*) > 0) FROM \"DiarySession\" WHERE id = 'cmtl7k6pw008gxppuhxzz5pj8';" 2>&1 | head -2

echo "### Node на хосте (запасной путь)"
(command -v node && node -v) 2>&1 | head -2
echo "### node_modules в рабочем каталоге выкладки"
ls -d /var/www/cmpas.ru/node_modules 2>&1 | head -1

echo "### КОНЕЦ РАЗВЕДКИ"
