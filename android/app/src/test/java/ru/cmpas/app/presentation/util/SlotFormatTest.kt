package ru.cmpas.app.presentation.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Отбор свободных слотов по формату встречи.
 *
 * Заведено по живому случаю: специалист выбрал «В кабинете» и среду, а в
 * «Доступном времени» получил восемь слотов, часть которых в расписании
 * настроена как онлайновые. Отбора не было вовсе.
 */
class SlotFormatTest {

    @Test
    fun `очный выбор не показывает онлайновые слоты`() {
        assertFalse(SlotFormat.matches("online", "offline"))
    }

    @Test
    fun `онлайн-выбор не показывает очные слоты`() {
        assertFalse(SlotFormat.matches("offline", "online"))
    }

    @Test
    fun `свой формат показывается`() {
        assertTrue(SlotFormat.matches("online", "online"))
        assertTrue(SlotFormat.matches("offline", "offline"))
    }

    // Решение учредителя: гибридное правило расписания годится обоим.
    @Test
    fun `гибридное правило годится и туда и туда`() {
        assertTrue(SlotFormat.matches("both", "online"))
        assertTrue(SlotFormat.matches("both", "offline"))
    }

    // Словари в системе два: расписание пишет offline, сессия — in_person.
    // Прямое сравнение спрятало бы ВСЕ очные слоты вместо лишних — то есть
    // починка дала бы пустой экран вместо неверного.
    @Test
    fun `in_person и offline — одно и то же`() {
        assertTrue(SlotFormat.matches("offline", "in_person"))
        assertTrue(SlotFormat.matches("offline", "IN_PERSON"))
        assertEquals(SlotFormat.OFFLINE, SlotFormat.normalize("in_person"))
        assertEquals(SlotFormat.OFFLINE, SlotFormat.normalize("IN_PERSON"))
    }

    @Test
    fun `неизвестное значение считается онлайном, как и на сервере`() {
        assertEquals(SlotFormat.ONLINE, SlotFormat.normalize(null))
        assertEquals(SlotFormat.ONLINE, SlotFormat.normalize("что-то"))
    }
}
