#!/usr/bin/env bash
# Установка корня Государственного удостоверяющего центра Минцифры.
#
# Зачем. Сертификат securepay.tinkoff.ru выдан «Russian Trusted Sub CA»
# (Минцифры). Этого корня нет в стандартном наборе Debian, поэтому сервер
# отвергал соединение с платёжным шлюзом как самоподписанное, и приём
# платежей не работал бы ни с тестовыми ключами, ни с боевыми.
#
# Решение учредителя от 18.08.2026: доверять этому центру на уровне всей
# системы сервера.
#
# Скрипт печатает отпечатки скачанных сертификатов — доверие добавляется
# осознанно, а не «что скачалось, то и поставили».
set -euo pipefail

ROOT_URL='https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt'
SUB_URL='https://gu-st.ru/content/lending/russian_trusted_sub_ca_pem.crt'
DEST=/usr/local/share/ca-certificates
BUNDLE_DIR=/etc/ssl/ru-ca

log() { echo "[ru-ca] $*"; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

log "Скачиваю корневой и промежуточный сертификаты Минцифры."
curl -fsS --max-time 30 -o "$tmp/root.crt" "$ROOT_URL"
curl -fsS --max-time 30 -o "$tmp/sub.crt" "$SUB_URL"

for f in root sub; do
  if ! openssl x509 -in "$tmp/$f.crt" -noout >/dev/null 2>&1; then
    log "ОШИБКА: $f.crt не является сертификатом. Ничего не установлено."
    exit 1
  fi
  log "--- $f ---"
  openssl x509 -in "$tmp/$f.crt" -noout -subject -issuer -dates
  log "отпечаток SHA-256: $(openssl x509 -in "$tmp/$f.crt" -noout -fingerprint -sha256 | cut -d= -f2)"
done

log "Устанавливаю в доверенные системы."
install -m 0644 "$tmp/root.crt" "$DEST/russian_trusted_root_ca.crt"
install -m 0644 "$tmp/sub.crt"  "$DEST/russian_trusted_sub_ca.crt"
update-ca-certificates

log "Складываю связку для контейнера приложения."
mkdir -p "$BUNDLE_DIR"
# Между сертификатами обязательно должен быть перевод строки: если файл не
# заканчивается им, строка -----END----- склеивается с -----BEGIN----- и Node
# отвергает связку целиком с «bad end line». Awk добавляет его сам.
awk 1 "$tmp/root.crt" "$tmp/sub.crt" > "$BUNDLE_DIR/russian-trusted.pem"

# Проверяем, что связка читается, а не просто создана.
if ! openssl storeutl -noout -certs "$BUNDLE_DIR/russian-trusted.pem" >/dev/null 2>&1; then
  count=$(grep -c 'BEGIN CERTIFICATE' "$BUNDLE_DIR/russian-trusted.pem" || echo 0)
  log "ВНИМАНИЕ: не удалось разобрать связку штатной проверкой, сертификатов в файле: $count"
fi
log "Связка собрана, сертификатов внутри: $(grep -c 'BEGIN CERTIFICATE' "$BUNDLE_DIR/russian-trusted.pem")"

log "Проверяю связку глазами Node:"
NODE_EXTRA_CA_CERTS="$BUNDLE_DIR/russian-trusted.pem" node -e "
  const https=require('https');
  const r=https.request({host:'securepay.tinkoff.ru',path:'/v2/GetState',method:'POST',timeout:15000},res=>{
    console.log('[ru-ca] Node получил код ' + res.statusCode); process.exit(0);
  });
  r.on('error',e=>{ console.log('[ru-ca] Node не смог: ' + e.message); process.exit(1); });
  r.on('timeout',()=>{ console.log('[ru-ca] Node: таймаут'); process.exit(1); });
  r.end('{}');
" || log "ВНИМАНИЕ: Node по-прежнему не доверяет цепочке" 
chmod 0644 "$BUNDLE_DIR/russian-trusted.pem"

log "Проверяю платёжный шлюз с хоста:"
curl -sS -o /dev/null -w '[ru-ca] код ответа %{http_code}\n' --max-time 20 https://securepay.tinkoff.ru/v2/GetState || {
  log "ОШИБКА: шлюз по-прежнему недоступен."
  exit 1
}

log "Готово. Доверие установлено, шлюз отвечает."
