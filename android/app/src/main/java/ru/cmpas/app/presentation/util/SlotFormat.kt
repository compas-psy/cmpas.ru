package ru.cmpas.app.presentation.util

/**
 * Годится ли слот расписания выбранному формату встречи.
 *
 * Правило задано учредителем: «В кабинете» — только очные слоты, «Онлайн» —
 * только онлайновые, а гибридное правило расписания («Онлайн + Кабинет»)
 * показывается и там и там.
 *
 * До этого отбора не было вовсе: экран «Добавить запись» показывал все
 * свободные часы дня независимо от выбранного формата, и специалист,
 * выбравший «В кабинете», видел среди них утренние онлайновые.
 *
 * Словари форматов в системе два: расписание пишет «offline», сессия —
 * «in_person». Сравнивать их напрямую нельзя: значения разные, а смысл
 * один, и молчаливое несовпадение спрятало бы все очные слоты вместо
 * лишних. Поэтому оба приводятся к одному виду здесь.
 */
object SlotFormat {

    const val ONLINE = "online"
    const val OFFLINE = "offline"

    /** Гибрид: правило допускает обе формы встречи. */
    const val BOTH = "both"

    /** «in_person», «IN_PERSON», «offline» — одно и то же. */
    fun normalize(value: String?): String = when (value?.trim()?.lowercase()) {
        "offline", "in_person", "inperson" -> OFFLINE
        BOTH -> BOTH
        else -> ONLINE
    }

    /**
     * @param slotFormat формат слота, как его отдал сервер
     * @param chosenFormat формат, выбранный на экране
     */
    fun matches(slotFormat: String?, chosenFormat: String?): Boolean {
        val slot = slotFormat?.trim()?.lowercase()
        // Гибрид годится всегда — это и есть решение учредителя про
        // «гибридное расписание выдаёт и те и другие».
        if (slot == BOTH) return true
        return normalize(slotFormat) == normalize(chosenFormat)
    }
}
