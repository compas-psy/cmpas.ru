#!/usr/bin/env bash
# Сборка конфигурации sing-box из шаблона.
#
# Отдельным скриптом, а не строчками внутри выкладки, по одной причине:
# подстановку нужно проверять тестом. Внутри deploy-production-remote.sh
# её проверить нельзя — тот скрипт по дороге ходит в docker, в базу и в
# реестр образов. Здесь же нет ничего, кроме sed, и сторож
# (tests/singbox-config-render.test.ts) зовёт ровно этот код, а не его
# пересказ.
#
# Вход — переменные окружения, выход — файл (путь первым аргументом,
# по умолчанию deploy/singbox-config.json).
#
#   HYSTERIA_SERVER    адрес сервера тоннеля       (обязательно)
#   HYSTERIA_PORT      порт                        (обязательно)
#   HYSTERIA_PASSWORD  пароль                      (обязательно)
#   HYSTERIA_SNI       имя в TLS      (по умолчанию — адрес сервера)
#   HYSTERIA_INSECURE  не проверять сертификат тоннеля (по умолчанию true)
#
# Про insecure=true: у типового hysteria2-сервера сертификат самоподписанный
# и выписан на IP, проверять его нечем. Это ослабляет TLS ТОЛЬКО на участке
# до тоннеля. Трафик к api.telegram.org внутри остаётся обычным HTTPS и
# проверяется самим Node от начала до конца: оператор тоннеля видит, что мы
# идём на api.telegram.org, но не содержимое — ровно как любой прокси.
# Появится настоящий сертификат на домене — HYSTERIA_SNI ставится в домен,
# HYSTERIA_INSECURE в false, и проверка включается без правок кода.
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
template="${script_dir}/../deploy/singbox-config.template.json"
out="${1:-${script_dir}/../deploy/singbox-config.json}"

missing=''
[ -n "${HYSTERIA_SERVER:-}" ] || missing="${missing} HYSTERIA_SERVER"
[ -n "${HYSTERIA_PORT:-}" ] || missing="${missing} HYSTERIA_PORT"
[ -n "${HYSTERIA_PASSWORD:-}" ] || missing="${missing} HYSTERIA_PASSWORD"
if [ -n "$missing" ]; then
  echo "ОСТАНОВ: не заданы обязательные переменные тоннеля:${missing}." >&2
  echo "Заводятся в секретах окружения выкладки; в репозиторий не коммитить." >&2
  exit 1
fi

case "${HYSTERIA_PORT}" in
  ''|*[!0-9]*)
    echo "ОСТАНОВ: HYSTERIA_PORT='${HYSTERIA_PORT}' — не число. В конфигурации порт стоит без кавычек, и нечисло сделает файл невалидным JSON." >&2
    exit 1
    ;;
esac

sni="${HYSTERIA_SNI:-$HYSTERIA_SERVER}"
insecure="${HYSTERIA_INSECURE:-true}"
case "$insecure" in
  true|false) ;;
  *)
    echo "WARNING: HYSTERIA_INSECURE='${insecure}' — не true и не false, беру true." >&2
    insecure=true
    ;;
esac

# Экранируем разделитель sed и & — иначе пароль со спецсимволом молча
# подставится не тем, чем задан.
esc() { printf '%s' "$1" | sed 's/[&|\\]/\\&/g'; }

sed \
  -e "s|\${HYSTERIA_SERVER}|$(esc "$HYSTERIA_SERVER")|g" \
  -e "s|\${HYSTERIA_PORT}|$(esc "$HYSTERIA_PORT")|g" \
  -e "s|\${HYSTERIA_PASSWORD}|$(esc "$HYSTERIA_PASSWORD")|g" \
  -e "s|\${HYSTERIA_SNI}|$(esc "$sni")|g" \
  -e "s|\${HYSTERIA_INSECURE}|${insecure}|g" \
  "$template" > "$out"

# Готовый файл содержит пароль — он не должен быть читаем всем подряд.
chmod 600 "$out"
