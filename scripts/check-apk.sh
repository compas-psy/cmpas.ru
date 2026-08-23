#!/usr/bin/env bash
# Сторож готового пакета. Общий для трёх продуктов СИМПАС.
#
# Проверяется ГОТОВЫЙ APK, а не шаблон манифеста. Разница не формальная:
# манифест — это намерение, а в пакет разрешения попадают ещё и из библиотек,
# через слияние манифестов, и debuggable может проставить не тот buildType,
# который вы читали глазами. Проверять надо то, что уедет людям.
#
# Три отказа, каждый роняет сборку:
#   1. пакет помечен debuggable — к нему подключается отладчик и вычитывается
#      память вместе с любыми зашитыми в сборку секретами;
#   2. подпись не тем ключом — чужая подпись означает, что обновление поверх
#      установленного не встанет, а CN=Android Debug означает, что пакет вовсе
#      не подписан постоянным ключом;
#   3. разрешение, которого нет в объявленном списке — незамеченное разрешение
#      из библиотеки меняет то, что видит человек при установке.
#
# Использование:
#   check-apk.sh <путь-к-apk> <ожидаемый-отпечаток-sha256> <файл-со-списком-разрешений>
# Отпечаток — в нижнем регистре, без двоеточий.

set -uo pipefail

fail() { echo "::error::$1"; echo "ОТКАЗ: $1" >&2; exit 1; }

# ── Разборщики вывода инструментов ────────────────────────────────────────
#
# Вынесены отдельными функциями и доступны снаружи (--parse-signers,
# --parse-permissions) НЕ для красоты: настоящий APK в тестовой среде не
# собрать, и из-за этого оба разбора не проверялись ничем. Оба и сломались на
# первом же настоящем пакете (прогон 277):
#
#   * отпечаток: сторож искал строку «Signer #1 certificate SHA-256 digest»,
#     а apksigner из build-tools 37 печатает метку иначе — отпечаток не
#     прочитался вовсе;
#   * разрешения: разбор использовал match($0, /../, arr) — трёхаргументный
#     match есть только в GNU awk, а на раннере GitHub awk это mawk, где та же
#     строка даёт синтаксическую ошибку и ноль результатов.
#
# Теперь оба разбора не зависят ни от точной метки, ни от диалекта awk, и оба
# проверяются на образцах в tests/apk-guard.test.ts.

# Читает вывод `apksigner verify --print-certs` со стандартного входа и
# печатает уникальные отпечатки SHA-256 в нижнем регистре, по одному в строке.
# Метка до двоеточия не важна: apksigner печатает и «Signer #1 certificate
# SHA-256 digest:», и «Signer (minSdkVersion=..., maxSdkVersion=...) #1
# certificate SHA-256 digest:» — цепляться за конкретную форму значит снова
# сломаться от обновления build-tools.
parse_signers() {
    sed -n 's/^.*certificate SHA-256 digest:[[:space:]]*//p' \
        | tr -d ':[:space:]' \
        | tr '[:upper:]' '[:lower:]' \
        | grep -E '^[0-9a-f]{64}$' \
        | sort -u
}

# Читает вывод `aapt2 dump permissions` или `aapt2 dump badging` и печатает
# имена разрешений. Кавычки бывают и одинарные, и двойные; префикс бывает
# uses-permission и uses-permission-sdk-23 — берём все.
parse_permissions() {
    sed -n \
        -e "s/^[[:space:]]*uses-permission[^:]*:[[:space:]]*name='\([^']*\)'.*/\1/p" \
        -e 's/^[[:space:]]*uses-permission[^:]*:[[:space:]]*name="\([^"]*\)".*/\1/p' \
        | sort -u
}

# Точки входа для проверки самих разборщиков без APK.
case "${1:-}" in
    --parse-signers) parse_signers; exit 0 ;;
    --parse-permissions) parse_permissions; exit 0 ;;
esac

[ $# -ge 3 ] || fail "нужно три аргумента: apk, ожидаемый отпечаток, файл со списком разрешений"

APK="$1"
EXPECTED_SIGNER="$(echo "$2" | tr -d ': ' | tr '[:upper:]' '[:lower:]')"
ALLOWED_FILE="$3"

[ -s "$APK" ] || fail "пакет не найден или пуст: $APK"
[ -s "$ALLOWED_FILE" ] || fail "список разрешений не найден или пуст: $ALLOWED_FILE"

# Инструменты берём из build-tools SDK. Версия не жёсткая: берём самую свежую
# из установленных, иначе сторож ломается от каждого обновления образа раннера.
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
[ -n "$SDK" ] || fail "не задан ANDROID_HOME/ANDROID_SDK_ROOT — нечем разбирать пакет"
TOOLS="$(ls -d "$SDK"/build-tools/* 2>/dev/null | sort -V | tail -1)"
[ -n "$TOOLS" ] || fail "в $SDK нет build-tools — нечем разбирать пакет"
AAPT2="$TOOLS/aapt2"
APKSIGNER="$TOOLS/apksigner"
[ -x "$AAPT2" ] || fail "нет $AAPT2"
[ -x "$APKSIGNER" ] || fail "нет $APKSIGNER"

echo "═══ Сторож пакета: $(basename "$APK") ═══"
echo "инструменты: $TOOLS"
echo

# ── 1. Отладочный пакет ───────────────────────────────────────────────────
echo "── Отладочный ли пакет ──"
BADGING="$("$AAPT2" dump badging "$APK" 2>&1)" || fail "aapt2 не смог прочитать пакет"
if echo "$BADGING" | grep -qi "application-debuggable"; then
    echo "$BADGING" | grep -i "application-debuggable"
    fail "пакет помечен debuggable — к нему подключается отладчик и вычитывается память; Google Play такие пакеты не принимает"
fi
echo "не debuggable — хорошо"
echo "$BADGING" | grep -E "^package:|^application-label:" | head -3
echo

# ── 2. Подпись ────────────────────────────────────────────────────────────
echo "── Подпись ──"
CERTS="$("$APKSIGNER" verify --print-certs --verbose "$APK" 2>&1)" || {
    echo "$CERTS"
    fail "apksigner не подтвердил подпись пакета"
}
echo "$CERTS" | grep -E "Verified using|Signer #1 certificate (DN|SHA-256)" || true

if echo "$CERTS" | grep -qi "CN=Android Debug"; then
    fail "пакет подписан отладочным ключом (CN=Android Debug) — постоянным ключом он не подписан вовсе"
fi

DIGESTS="$(printf '%s\n' "$CERTS" | parse_signers)"
if [ -z "$DIGESTS" ]; then
    # Печатаем ВЕСЬ вывод: молчаливый отказ «не смог прочитать» заставляет
    # тратить целый прогон раннера только чтобы увидеть, что там было.
    echo "── полный вывод apksigner ──"
    printf '%s\n' "$CERTS"
    fail "не удалось прочитать отпечаток подписи из вывода apksigner (вывод выше)"
fi

COUNT="$(printf '%s\n' "$DIGESTS" | wc -l | tr -d ' ')"
if [ "$COUNT" != "1" ]; then
    printf '  найдено отпечатков: %s\n' "$COUNT"
    printf '  %s\n' $DIGESTS
    fail "в пакете больше одного разного ключа подписи — так подпись перестаёт что-либо значить"
fi

ACTUAL_SIGNER="$DIGESTS"
if [ "$ACTUAL_SIGNER" != "$EXPECTED_SIGNER" ]; then
    echo "  ожидали: $EXPECTED_SIGNER"
    echo "  в пакете: $ACTUAL_SIGNER"
    fail "пакет подписан НЕ ТЕМ ключом — обновление поверх установленных копий не встанет"
fi
echo "подпись та же, что ожидалась: $ACTUAL_SIGNER"
echo

# ── 3. Разрешения ─────────────────────────────────────────────────────────
echo "── Разрешения ──"
# Список читаем без комментариев и пустых строк.
mapfile -t ALLOWED < <(sed -e 's/#.*//' -e 's/[[:space:]]//g' "$ALLOWED_FILE" | grep -v '^$' | sort -u)
# Читаем ДВА источника и объединяем: dump permissions и уже снятый badging.
# Формат вывода aapt2 менялся между версиями, и если изменится один — второй
# всё равно назовёт разрешения. Объединение строго осторожнее: лишний
# найденный элемент приведёт к отказу, пропущенный — к молчаливому пропуску.
PERM_RAW="$("$AAPT2" dump permissions "$APK" 2>&1)"
mapfile -t ACTUAL < <(
    { printf '%s\n' "$PERM_RAW"; printf '%s\n' "$BADGING"; } | parse_permissions
)

if [ "${#ACTUAL[@]}" -eq 0 ]; then
    # Молча решить «разрешений нет» значило бы пропустить любое из них.
    echo "── вывод aapt2 dump permissions ──"
    printf '%s\n' "$PERM_RAW" | head -20
    fail "не удалось разобрать разрешения из пакета — сторож не имеет права считать, что их нет"
fi

echo "в пакете (${#ACTUAL[@]}):"
printf '  %s\n' "${ACTUAL[@]}"
echo "объявлено в $ALLOWED_FILE (${#ALLOWED[@]}):"
printf '  %s\n' "${ALLOWED[@]}"
echo

UNDECLARED=()
for p in "${ACTUAL[@]}"; do
    found=0
    for a in "${ALLOWED[@]}"; do [ "$p" = "$a" ] && found=1 && break; done
    [ "$found" = 0 ] && UNDECLARED+=("$p")
done

if [ "${#UNDECLARED[@]}" -gt 0 ]; then
    printf '  незаявленное: %s\n' "${UNDECLARED[@]}"
    fail "в пакете есть разрешения, которых нет в объявленном списке — вероятно, пришли из библиотеки при слиянии манифестов. Либо обоснуйте и внесите в $ALLOWED_FILE, либо уберите."
fi

# Обратная сторона: объявили и не используем — не отказ, но человек обязан
# увидеть. Список разрешений, который расходится с пакетом, перестаёт быть
# описанием и становится пожеланием.
for a in "${ALLOWED[@]}"; do
    found=0
    for p in "${ACTUAL[@]}"; do [ "$a" = "$p" ] && found=1 && break; done
    [ "$found" = 0 ] && echo "::warning::$a объявлено в $ALLOWED_FILE, но в пакете его нет — список устарел"
done

echo "все разрешения пакета объявлены"
echo
echo "═══ Пакет проверен: не отладочный, подписан ожидаемым ключом, разрешения заявлены ═══"
