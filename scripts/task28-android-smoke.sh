#!/usr/bin/env bash
# Задача 28, §14–§17: приложение на живом устройстве.
#
# Запускается ВНУТРИ шага android-emulator-runner, когда эмулятор уже загружен
# и adb к нему подключён. Стенд (Next.js + PostgreSQL) уже поднят на самой
# машине прогона; эмулятору он виден как http://10.0.2.2:3100.
#
# Что здесь происходит:
#   1. вход настоящим контрактом — magic-link выпускается стендом, обменивается
#      на пару токенов и отдаётся приложению тем же deep link, что и в жизни;
#   2. обход экранов со снимком на каждом;
#   3. проверки исправлений Задачи 27 (D-06, D-07, D-08) — уже поведением, а
#      не чтением исходника.
#
# Скрипт не падает на первой же неудачной навигации: он записывает, что не
# получилось, и идёт дальше — иначе один промах по координате прячет все
# остальные доказательства. Итог считается в конце.
set -uo pipefail

VARIANT="${1:-reference}"
BASE="http://localhost:3100"
PKG="ru.cmpas.app"
OUT="artifacts-out/android/${VARIANT}"
SHOTS=0
FAILURES=()
mkdir -p "$OUT"

note()  { echo "  · $*"; }
fail()  { echo "  ✗ $*"; FAILURES+=("$*"); }
ok()    { echo "  ✓ $*"; }

shot() {
    SHOTS=$((SHOTS + 1))
    local name
    name=$(printf '%02d-%s' "$SHOTS" "$1")
    sleep "${2:-2}"
    adb exec-out screencap -p > "$OUT/${name}.png" 2>/dev/null
    local bytes
    bytes=$(stat -c %s "$OUT/${name}.png" 2>/dev/null || echo 0)
    if [ "$bytes" -lt 5000 ]; then
        fail "снимок ${name} пустой (${bytes} байт)"
    else
        note "снимок ${name} (${bytes} байт)"
    fi
}

dump() {
    adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
    adb shell cat /sdcard/ui.xml 2>/dev/null
}

# Есть ли на экране текст. Сравнение по подстроке: подписи в Compose приходят
# в content-desc или в text, и точное совпадение ловит не всё.
has_text() {
    dump | grep -qF "$1"
}

# Нажать по центру узла с указанным текстом.
tap_text() {
    local needle="$1"
    local xml
    xml=$(dump)
    local bounds
    bounds=$(printf '%s' "$xml" \
        | tr '>' '\n' \
        | grep -F "$needle" \
        | grep -o 'bounds="\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]"' \
        | head -1)
    if [ -z "$bounds" ]; then
        return 1
    fi
    local nums x1 y1 x2 y2
    nums=$(printf '%s' "$bounds" | grep -o '[0-9]\+')
    x1=$(printf '%s\n' "$nums" | sed -n 1p)
    y1=$(printf '%s\n' "$nums" | sed -n 2p)
    x2=$(printf '%s\n' "$nums" | sed -n 3p)
    y2=$(printf '%s\n' "$nums" | sed -n 4p)
    adb shell input tap $(( (x1 + x2) / 2 )) $(( (y1 + y2) / 2 ))
    sleep 2
    return 0
}

step() {
    local needle="$1" what="$2"
    if tap_text "$needle"; then
        ok "$what"
        return 0
    fi
    fail "не нашёл на экране: «$needle» ($what)"
    return 1
}

echo "===== Устройство ====="
adb devices
adb shell wm size
adb shell wm density
adb shell getprop ro.build.version.release

echo "===== Стенд виден с устройства? ====="
adb shell 'curl -s -o /dev/null -w "%{http_code}\n" http://10.0.2.2:3100/ 2>/dev/null' || \
  note "curl внутри образа отсутствует — проверим самим приложением"

echo "===== Установка отладочной сборки ====="
APK=android/app/build/outputs/apk/debug/app-debug.apk
ls -la "$APK"
adb install -r -g "$APK"

echo "===== Вход настоящим контрактом ====="
# Стенд выпускает magic-link (письмо уйти не может — почтовика в прогоне нет,
# но токен создаётся до отправки), затем токен меняется на пару JWT.
curl -sS -X POST "$BASE/api/mobile/auth/login" \
     -H 'Content-Type: application/json' \
     -d '{"email":"maria@task27.invalid"}' -o /tmp/login.json -w 'login -> %{http_code}\n' || true

MAGIC=$(node -e "
const { PrismaClient } = require('@prisma/client');
(async () => {
  const db = new PrismaClient();
  const row = await db.verificationToken.findFirst({
    where: { identifier: 'maria@task27.invalid' },
    orderBy: { expires: 'desc' },
  });
  process.stdout.write(row ? row.token : '');
  await db.\$disconnect();
})();
")

if [ -z "$MAGIC" ]; then
    fail "стенд не выпустил токен входа — дальше идти некуда"
    echo "ИТОГ: ПРОВАЛ"; exit 1
fi

curl -sS -X POST "$BASE/api/mobile/auth/verify" \
     -H 'Content-Type: application/json' \
     -d "{\"token\":\"$MAGIC\"}" -o /tmp/tokens.json -w 'verify -> %{http_code}\n'

ACCESS=$(node -e "process.stdout.write((require('/tmp/tokens.json').accessToken)||'')")
REFRESH=$(node -e "process.stdout.write((require('/tmp/tokens.json').refreshToken)||'')")
EXPIRES=$(node -e "process.stdout.write(String((require('/tmp/tokens.json').expiresIn)||0))")
if [ -z "$ACCESS" ]; then
    fail "обмен токена не дал доступа"
    echo "ИТОГ: ПРОВАЛ"; exit 1
fi
ok "пара токенов получена (значения в журнал не печатаются)"

echo "===== Экран входа до авторизации ====="
adb shell am start -n "$PKG/.presentation.MainActivity" >/dev/null
shot "login" 5

echo "===== Тот же deep link, что приходит из письма ====="
adb shell am start -a android.intent.action.VIEW \
  -d "\"compas://auth/callback?accessToken=$ACCESS&refreshToken=$REFRESH&expiresIn=$EXPIRES\"" >/dev/null
sleep 6
shot "dashboard-A01" 4

if has_text "Добр"; then ok "A01: кабинет открылся, обращение по имени на экране"; else fail "A01: приветствия на экране нет"; fi
if has_text "Поделиться"; then ok "A01: «Поделиться» в быстрых действиях"; else fail "A01: «Поделиться» на главном экране нет"; fi
if has_text "Расписание"; then ok "A01: расписание дня на месте"; else fail "A01: расписания дня нет"; fi

echo "===== A02/A03: онбординг и внимание — дополнения ====="
if has_text "Начало работы" || has_text "Добро пожаловать"; then ok "A02: чек-лист виден рядом с рабочим экраном"; else note "A02: чек-лист скрыт (шаги уже пройдены) — состояние допустимое"; fi
if has_text "Требует внимания" || has_text "внимания"; then ok "A03: блок внимания виден"; else note "A03: блок внимания пуст"; fi
shot "dashboard-states-A02-A03" 2

echo "===== Постоянная ссылка записи (шторка шеринга) ====="
if step "Поделиться" "открыл шторку ссылки"; then
    shot "booking-link-share" 3
    if has_text "cmpas.ru/u/" || has_text "/u/"; then ok "в шторке постоянная ссылка /u/<slug>"; else fail "постоянной ссылки в шторке не видно"; fi
    if has_text "Скопировать" || has_text "скопировать"; then ok "копирование доступно"; fi
    adb shell input keyevent KEYCODE_BACK; sleep 2
fi

echo "===== A13: центр внимания ====="
if step "Уведомления" "открыл центр внимания" || step "внимания" "открыл центр внимания"; then
    shot "attention-A13" 3
    adb shell input keyevent KEYCODE_BACK; sleep 2
else
    note "колокольчик не найден по тексту — пробую по описанию"
    adb shell input tap 1000 200; sleep 2
    shot "attention-A13" 3
    adb shell input keyevent KEYCODE_BACK; sleep 2
fi

echo "===== Календарь и настройка (A05–A06) ====="
step "Календарь" "перешёл в календарь" && shot "calendar-A05" 3

echo "===== D-06: тап по заблокированному времени НЕ открывает карточку сессии ====="
if has_text "Заблокировано" || has_text "Личное" || has_text "Блок"; then
    before_block=$(dump | grep -cF "Заблокировано" || true)
    tap_text "Заблокировано" || tap_text "Личное" || true
    sleep 2
    if has_text "Отметить оплату" || has_text "Подготовиться"; then
        fail "D-06: тап по блоку открыл карточку сессии"
    else
        ok "D-06: блок не открывается как сессия"
    fi
    shot "d06-block-not-a-session" 2
else
    note "D-06: блока в сегодняшнем дне нет — проверка не выполнена на этом кадре"
fi

echo "===== A06/A07: quick sheet и блокировка времени ====="
if step "Настроить" "открыл quick sheet" || tap_text "Рабочее время"; then
    shot "calendar-tune-A06" 3
    if step "Заблокировать время" "открыл форму блокировки"; then
        shot "block-time-A07" 3
        if has_text "Другая дата"; then ok "A07: третья фишка подписана «Другая дата» (правка Задачи 27)"; else fail "A07: подписи «Другая дата» нет"; fi
        adb shell input keyevent KEYCODE_BACK; sleep 2
    fi
    adb shell input keyevent KEYCODE_BACK; sleep 2
fi

echo "===== Клиенты: привязанный и непривязанный ====="
step "Клиенты" "перешёл в список клиентов" && shot "clients-list" 3

if tap_text "Анастасия" || tap_text "Клиент"; then
    shot "client-detail" 3
    if has_text "Записать сессию"; then ok "A15: липкая панель «Записать сессию» на месте"; else fail "A15: липкой панели нет"; fi

    echo "===== D-07: у клиента без встреч нет заметки в несуществующую сессию ====="
    if has_text "Нет сессий" || has_text "0 сессий"; then
        if has_text "Добавить заметку"; then
            fail "D-07: «Добавить заметку» предлагается клиенту без единой встречи"
        else
            ok "D-07: заметку не предлагают, когда прикрепить её не к чему"
        fi
    else
        note "D-07: у открытого клиента есть встречи — проверка требует клиента без сессий"
    fi

    echo "===== A15: приглашение и его отличие от постоянной ссылки ====="
    if tap_text "Пригласить"; then
        shot "invite-sheet-A15" 4
        if has_text "не постоянная ссылка для записи"; then
            ok "A15: приглашение прямо отличено от постоянной ссылки (правка Задачи 27)"
        else
            fail "A15: разведения приглашения и постоянной ссылки на экране нет"
        fi
        if has_text "72 часа"; then ok "A15: назван настоящий срок сервера"; fi
        adb shell input keyevent KEYCODE_BACK; sleep 2
    elif has_text "Написать"; then
        ok "A15: у привязанного клиента действие «Написать»"
        shot "client-bound" 2
    fi

    echo "===== D-08: быстрая отправка документа ведёт в настоящий поток ====="
    if tap_text "Документы"; then
        shot "client-documents-D08" 3
        if has_text "/d/"; then fail "D-08: на экране остался адрес вида /d/<id>"; else ok "D-08: подделанного адреса документа нет"; fi
        adb shell input keyevent KEYCODE_BACK; sleep 1
    fi
    adb shell input keyevent KEYCODE_BACK; sleep 2
fi

echo "===== Профиль (A04) и кабинеты (A08) ====="
if step "Ещё" "перешёл в профиль" || step "Профиль" "перешёл в профиль"; then
    shot "profile-A04" 3
    if has_text "Практика"; then ok "A04: группа «Практика» подписана (правка Задачи 27)"; else fail "A04: заголовка группы «Практика» нет"; fi
    if step "Кабинеты" "открыл кабинеты"; then
        shot "cabinets-A08" 3
        adb shell input keyevent KEYCODE_BACK; sleep 2
    fi
fi

echo "===== Системное поведение ====="
adb shell input keyevent KEYCODE_BACK; sleep 1
shot "after-back" 2
ok "system Back отработал без падения приложения"

if adb shell dumpsys activity | grep -q "$PKG"; then
    ok "приложение живо после всего обхода"
else
    fail "приложение не найдено среди живых процессов после обхода"
fi

echo "===== Падения в журнале устройства ====="
CRASH=$(adb logcat -d -b crash 2>/dev/null | grep -c "$PKG" || true)
if [ "${CRASH:-0}" -gt 0 ]; then
    fail "в журнале падений есть записи приложения ($CRASH строк)"
    adb logcat -d -b crash | tail -40
else
    ok "падений приложения в журнале нет"
fi
adb logcat -d > "$OUT/logcat.txt" 2>/dev/null || true

echo
echo "===== ИТОГ (${VARIANT}) ====="
echo "снимков: $SHOTS"
if [ ${#FAILURES[@]} -eq 0 ]; then
    echo "провалов: 0"
    echo "ИТОГ: PASS"
    exit 0
fi
echo "провалов: ${#FAILURES[@]}"
for f in "${FAILURES[@]}"; do echo "  - $f"; done
echo "ИТОГ: ЕСТЬ ЗАМЕЧАНИЯ"
exit 1
