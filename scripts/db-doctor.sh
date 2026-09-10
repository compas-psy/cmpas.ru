#!/usr/bin/env bash
# ВРЕМЕННЫЙ скрипт: снести зависший контейнер вчерашней выкладки и проверить,
# что даёт вторая дорога до Telegram (getChat) на живом клиенте.
set -uo pipefail

echo "### 1. Зависший контейнер вчерашней выкладки"
docker ps -a --filter 'name=infra-pulse-run' --format '{{.Names}}  {{.Status}}' 2>/dev/null | head -5
echo "--- сношу ---"
for c in $(docker ps -a --filter 'name=infra-pulse-run' --format '{{.Names}}' 2>/dev/null); do
  if docker rm -f "$c" >/dev/null 2>&1; then echo "снесён: $c"; else echo "не снёсся: $c"; fi
done
echo "--- после ---"
docker ps -a --filter 'name=infra-pulse-run' --format '{{.Names}}  {{.Status}}' 2>/dev/null | head -5
echo "--- пусто = чисто"

q() { docker exec cmpas-postgres psql -U postgres -d cmpas_db -tAc "$1" 2>&1 || true; }

echo "### 2. Аватарки: к скольким клиентам есть за чем идти"
q "SELECT count(*) FILTER (WHERE \"telegramChatId\" IS NOT NULL) || '|' ||
          count(*) FILTER (WHERE \"maxDialogId\" IS NOT NULL) || '|' ||
          count(*) FILTER (WHERE \"maxChatId\" IS NOT NULL) || '|' || count(*)
   FROM \"DiaryClient\";"
echo "--- telegram|max_диалог|max_привязан|всего"

echo "### 3. Аватарки: что писал маршрут после выкладки"
docker logs -t cmpas-app --since 60m 2>&1 | grep -F '[avatar]' | tail -25
echo "--- пусто = список клиентов после выкладки ещё не открывали"

# ГЛАВНОЕ. Проверяем ту самую вторую дорогу — getChat, — и не гадаем, а
# спрашиваем Telegram напрямую про живого привязанного клиента.
#
# Ходим ЧЕРЕЗ САЙДКАР с хоста: прямой дороги до api.telegram.org с этого
# сервера нет (проверено — обрыв по таймауту), а через 127.0.0.1:1080 ходит
# сама выкладка, когда регистрирует вебхук. Значит дорога рабочая.
#
# В вывод идут ТОЛЬКО числа и «да/нет»: ни ключа бота, ни идентификатора
# человека, ни самой фотографии. Ключ уходит в curl файлом конфигурации через
# stdin, а не аргументом: список процессов виден всем, кто есть на сервере.
echo "### 4. Что отвечает Telegram про живого клиента: обе ручки"
tg_token="$(grep -E '^TELEGRAM_BOT_TOKEN=' /var/www/cmpas.ru/.env 2>/dev/null | head -1 | cut -d= -f2-)"
tg_uid="$(q "SELECT \"telegramChatId\" FROM \"DiaryClient\" WHERE \"telegramChatId\" IS NOT NULL ORDER BY \"updatedAt\" DESC LIMIT 1;" | tr -d ' \r\n')"

if [ -z "$tg_token" ] || [ -z "$tg_uid" ]; then
  echo "нет ключа бота или привязанного клиента — проверять нечего"
else
  ask() {
    printf 'url = "https://api.telegram.org/bot%s/%s"\nproxy = "http://127.0.0.1:1080"\n' "$tg_token" "$1" \
      | curl -sS -K - --max-time 20 2>/dev/null
  }

  photos="$(ask "getUserProfilePhotos?user_id=${tg_uid}&limit=1")"
  printf 'getUserProfilePhotos: '
  if [ -z "$photos" ]; then
    echo "НЕ ОТВЕТИЛ"
  else
    echo "$photos" | grep -o '"total_count":[0-9]*' | head -1 || echo "ответ без total_count"
  fi

  chat="$(ask "getChat?chat_id=${tg_uid}")"
  printf 'getChat: '
  if [ -z "$chat" ]; then
    echo "НЕ ОТВЕТИЛ"
  elif echo "$chat" | grep -q '"small_file_id"'; then
    echo 'ФОТОГРАФИЯ ЕСТЬ (поле small_file_id присутствует)'
  elif echo "$chat" | grep -q '"ok":true'; then
    echo 'ответил, но фотографии в чате нет'
  else
    echo "ответил отказом: $(echo "$chat" | grep -o '"description":"[^"]*"' | head -1)"
  fi

  echo "--- total_count:0 + getChat ФОТОГРАФИЯ ЕСТЬ = вторая дорога решает задачу"
  echo "--- обе пусты = фотография закрыта от бота настройками приватности, чинить нечего"
fi
