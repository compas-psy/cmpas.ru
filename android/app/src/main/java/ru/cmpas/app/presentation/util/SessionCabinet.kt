package ru.cmpas.app.presentation.util

/**
 * Откуда у очной встречи берётся кабинет и когда её вообще можно сохранять.
 *
 * До этого правила не было нигде: экран «Добавить запись» слал кабинет только
 * тогда, когда он приезжал вместе с выбранным свободным слотом. На пути
 * «Другое время» слота нет — и очная встреча сохранялась БЕЗ МЕСТА. Снаружи
 * это выглядит как обычная запись: время есть, клиент есть, формат «В
 * кабинете» — а куда человеку приезжать, не написано нигде.
 *
 * Правило живёт здесь, а не в разметке экрана, ровно потому, что его надо
 * проверять: в разметке оно проверяется только глазами.
 */
object SessionCabinet {

    /**
     * Кабинет, который в самом деле уедет в запись.
     *
     * Слот главнее ручного выбора: кабинет закреплён за слотом расписанием, и
     * разойтись с ним значило бы записать человека в один кабинет, а занять
     * час в другом. У онлайновой встречи кабинета нет по определению —
     * присланный сервер и так отбрасывает, но слать его отсюда незачем.
     */
    fun effectiveAddressId(
        chosenFormat: String,
        slotAddressId: String?,
        pickedAddressId: String?,
    ): String? {
        if (SlotFormat.normalize(chosenFormat) != SlotFormat.OFFLINE) return null
        return slotAddressId ?: pickedAddressId
    }

    /** Нужно ли вообще спрашивать кабинет: только у очной встречи. */
    fun isRequired(chosenFormat: String): Boolean =
        SlotFormat.normalize(chosenFormat) == SlotFormat.OFFLINE

    /**
     * Можно ли сохранять запись — со стороны кабинета.
     *
     * Если кабинетов не заведено ни одного, сохранение НЕ блокируется:
     * практика без кабинетов упёрлась бы в кнопку, которая не нажимается и не
     * объясняет почему. Экран в этом случае говорит вслух, что встреча
     * сохранится без места.
     */
    fun isReady(
        chosenFormat: String,
        effectiveAddressId: String?,
        hasAddresses: Boolean,
    ): Boolean {
        if (!isRequired(chosenFormat)) return true
        if (!hasAddresses) return true
        return !effectiveAddressId.isNullOrBlank()
    }
}
