#!/usr/bin/env bash
# Сторож имён сборки. Общий для трёх продуктов СИМПАС.
#
# Записанное в документе правило забывается — падающая сборка нет. Поэтому
# правило живёт здесь, а не только в CLAUDE.md, и CI обязан звать этот скрипт
# на ГОТОВОМ артефакте, а не на шаблоне.
#
# Правило:
#   имя файла        simpas-<продукт>-<версия>.apk
#   тег релиза       <продукт>-v<версия>
#   постоянная ссылка https://cmpas.ru/updates/latest/<продукт>.apk
#
# <продукт> — ровно одно из: praktika, zapiski, momenty.
#
# Почему приставка simpas, а не kompas или compas: она по имени СИСТЕМЫ,
# объединяющей три продукта, а не по имени одного из них. До этого правила
# КОМПАС транслитерировался тремя способами одновременно — kompas в МОМЕНТАХ,
# compas в ПРАКТИКЕ, cmpas в домене.
#
# Без хеша коммита и без номера прогона: человек видит это имя в загрузках, и
# суффикс вида -a3f9c21 ему ничего не сообщает. Версии достаточно. Релиз
# соответствует ВЕРСИИ, а не прогону сборки: пересобрали ту же версию —
# обновляем существующий релиз, новый не создаём.
#
# Использование:
#   check-release-naming.sh <имя-файла.apk> <тег-релиза> [ожидаемый-продукт]
# Код возврата 0 — имена верны, 1 — нет (с объяснением, чего не хватает).

set -uo pipefail

PRODUCTS='praktika|zapiski|momenty'
FILE_RE="^simpas-(${PRODUCTS})-([0-9]+\.[0-9]+\.[0-9]+)\.apk$"
TAG_RE="^(${PRODUCTS})-v([0-9]+\.[0-9]+\.[0-9]+)$"

fail() {
    echo "ИМЯ СБОРКИ НЕ ПО ПРАВИЛУ: $1" >&2
    echo "  правило: имя simpas-<продукт>-<версия>.apk, тег <продукт>-v<версия>" >&2
    echo "  продукт — одно из: praktika, zapiski, momenty" >&2
    echo "  без хеша коммита и без номера прогона — релиз соответствует версии, а не прогону" >&2
    exit 1
}

[ $# -ge 2 ] || fail "нужно два аргумента: имя файла и тег релиза (получено $#)"

filename=$(basename -- "$1")
tag="$2"
expected_product="${3:-}"

[[ "$filename" =~ $FILE_RE ]] || fail "имя файла «$filename» не отвечает шаблону simpas-<продукт>-<версия>.apk"
file_product="${BASH_REMATCH[1]}"
file_version="${BASH_REMATCH[2]}"

[[ "$tag" =~ $TAG_RE ]] || fail "тег «$tag» не отвечает шаблону <продукт>-v<версия>"
tag_product="${BASH_REMATCH[1]}"
tag_version="${BASH_REMATCH[2]}"

[ "$file_product" = "$tag_product" ] \
    || fail "продукт в имени файла ($file_product) и в теге ($tag_product) разный"
[ "$file_version" = "$tag_version" ] \
    || fail "версия в имени файла ($file_version) и в теге ($tag_version) разная"

if [ -n "$expected_product" ] && [ "$file_product" != "$expected_product" ]; then
    fail "этот репозиторий выпускает продукт «$expected_product», а имена говорят про «$file_product»"
fi

echo "имена по правилу: продукт $file_product, версия $file_version"
echo "  файл: $filename"
echo "  тег:  $tag"
echo "  ссылка: https://cmpas.ru/updates/latest/${file_product}.apk"
