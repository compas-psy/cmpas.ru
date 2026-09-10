package ru.cmpas.app.presentation.components

/**
 * РЯД КНОПОК НЕ ОБЕЩАЕТ ТОГО, ЧЕГО НЕ МОЖЕТ ПОКАЗАТЬ.
 *
 * История этого файла — три захода на одну и ту же ошибку.
 *
 * Заход первый: подписи обрезались, и я укоротил слова. Помогло ровно до
 * следующей подписи.
 *
 * Заход второй: я добавил уменьшение шрифта (FittedLabel в CompasControls).
 * Оно спасает короткие подписи и не спасает длинные: ниже 11 пунктов опускаться
 * нельзя — подпись, которую не прочесть, не лучше обрезанной, — а «Записать
 * снова» не помещается и при одиннадцати. Учредитель увидел «Запис…» и
 * «Б… Не… Пе…» в один день.
 *
 * Заход третий, этот. Причина не в словах и не в шрифте: три кнопки просто не
 * помещаются в ширину карточки, сколько их ни ужимай. Значит решать должен не
 * шрифт, а РАСКЛАДКА — если в один ряд не влезает, кнопки уходят на второй ряд.
 * Вертикали в списке достаточно всегда, ширины экрана — нет.
 *
 * Ширина подписи здесь ОЦЕНИВАЕТСЯ, а не измеряется: настоящий обмер доступен
 * только во время отрисовки, а решение о числе рядов нужно принять до неё.
 * Оценка намеренно с запасом — лишний перенос человек не заметит, обрезанную
 * подпись заметит сразу.
 */

/**
 * Средняя ширина знака в долях кегля.
 *
 * Считано по кириллическим подписям наших кнопок в полужирном начертании
 * системного шрифта. Заглушки и цифры уже, «ш» и «щ» шире; 0.58 покрывает
 * наши подписи с небольшим запасом.
 */
private const val AVERAGE_GLYPH = 0.58f

/** Поля по бокам кнопки — те же числа, что в PrimaryButton/GhostButton. */
private const val PADDING_COMPACT = 12f
private const val PADDING_WIDE = 18f

/** Иконка и отступ рядом с ней — только в некомпактном виде. */
private const val ICON_WIDTH = 18f
private const val ICON_GAP = 8f

/** Расстояние между кнопками в ряду. */
const val BUTTON_ROW_GAP = 8f

/** Сколько места нужно одной кнопке с такой подписью. */
fun buttonWidthDp(text: String, fontSizeSp: Float, compact: Boolean, hasIcon: Boolean): Float {
    val padding = if (compact) PADDING_COMPACT else PADDING_WIDE
    val icon = if (hasIcon && !compact) ICON_WIDTH + ICON_GAP else 0f
    return text.length * fontSizeSp * AVERAGE_GLYPH + padding * 2 + icon
}

/**
 * Помещается ли этот набор кнопок в один ряд.
 *
 * Кнопки в ряду равной ширины (у всех weight(1f)), поэтому решает не сумма, а
 * САМАЯ ДЛИННАЯ подпись: место делится поровну, и если широкой кнопке не
 * хватило, узкие соседки этого не исправят.
 */
fun buttonsFitInRow(
    labels: List<String>,
    availableDp: Float,
    fontSizeSp: Float,
    compact: Boolean,
    hasIcon: Boolean,
): Boolean {
    if (labels.isEmpty()) return true
    val share = (availableDp - BUTTON_ROW_GAP * (labels.size - 1)) / labels.size
    return labels.all { buttonWidthDp(it, fontSizeSp, compact, hasIcon) <= share }
}

/**
 * Разложить подписи по рядам так, чтобы каждая помещалась целиком.
 *
 * Возвращаются НОМЕРА подписей, а не сами подписи: вызывающему нужно достать
 * по ним обработчик нажатия и вид кнопки, а одинаковые подписи в наборе
 * встречаются (два «Отменить» на разных экранах — не редкость).
 *
 * Порядок кнопок сохраняется: человек читает их слева направо и сверху вниз,
 * и переставлять местами «Была» и «Не пришли» ради плотности нельзя — это
 * разные ответы на один вопрос, и первый из них главный.
 *
 * Одна кнопка на ряд — последнее средство. Если и в одиночку подпись не
 * помещается, ряд всё равно отдаётся: дальше сработает уменьшение шрифта в
 * FittedLabel, и это честнее, чем не показать кнопку вовсе.
 */
fun packButtonRows(
    labels: List<String>,
    availableDp: Float,
    fontSizeSp: Float,
    compact: Boolean,
    hasIcon: Boolean,
): List<List<Int>> {
    if (labels.isEmpty()) return emptyList()
    val rows = mutableListOf<List<Int>>()
    var current = mutableListOf<Int>()
    for (index in labels.indices) {
        val trial = current + index
        if (current.isEmpty() || buttonsFitInRow(trial.map { labels[it] }, availableDp, fontSizeSp, compact, hasIcon)) {
            current = trial.toMutableList()
        } else {
            rows.add(current)
            current = mutableListOf(index)
        }
    }
    rows.add(current)
    return rows
}
