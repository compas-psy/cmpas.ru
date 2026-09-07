/**
 * Годится ли слот расписания выбранному формату встречи.
 *
 * Правило: «в кабинете» — только очные слоты, «онлайн» — только
 * онлайновые, гибридное правило расписания («Онлайн + Кабинет») годится и
 * туда и туда.
 *
 * Отбора не было ни в приложении, ни в вебе: обе формы записи показывали
 * все свободные часы дня подряд, независимо от выбранного формата.
 * Специалист, выбравший «в кабинете», видел среди них утренние
 * онлайновые.
 *
 * Словари форматов в системе два: расписание пишет «offline», сессия —
 * «in_person». Сравнивать напрямую нельзя — значения разные, смысл один, и
 * молчаливое несовпадение спрятало бы ВСЕ очные слоты вместо лишних, то
 * есть починка дала бы пустой экран вместо неверного.
 */

export const SLOT_ONLINE = 'online';
export const SLOT_OFFLINE = 'offline';
/** Гибрид: правило допускает обе формы встречи. */
export const SLOT_BOTH = 'both';

/** «in_person», «IN_PERSON», «offline» — одно и то же. */
export function normalizeSlotFormat(value: string | null | undefined): string {
    switch ((value || '').trim().toLowerCase()) {
        case 'offline':
        case 'in_person':
        case 'inperson':
            return SLOT_OFFLINE;
        case SLOT_BOTH:
            return SLOT_BOTH;
        default:
            return SLOT_ONLINE;
    }
}

export function slotMatchesFormat(slotFormat: string | null | undefined, chosenFormat: string | null | undefined): boolean {
    // Гибрид годится всегда.
    if ((slotFormat || '').trim().toLowerCase() === SLOT_BOTH) return true;
    return normalizeSlotFormat(slotFormat) === normalizeSlotFormat(chosenFormat);
}
