package ru.cmpas.app.presentation.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Очная встреча без места.
 *
 * Экран «Добавить запись» слал кабинет только тогда, когда он приезжал вместе
 * с выбранным свободным слотом. На пути «Другое время» слота нет — и встреча
 * с форматом «В кабинете» сохранялась без адреса. Снаружи это выглядит как
 * обычная запись; выясняется в день встречи.
 */
class SessionCabinetTest {

    @Test
    fun `у онлайновой встречи кабинета нет, даже если он выбран`() {
        assertNull(SessionCabinet.effectiveAddressId(SlotFormat.ONLINE, "addr-1", "addr-2"))
    }

    @Test
    fun `кабинет слота главнее выбранного вручную`() {
        // Кабинет закреплён за слотом расписанием: разойтись с ним значит
        // записать человека в один кабинет, а занять час в другом.
        assertEquals("addr-slot", SessionCabinet.effectiveAddressId(SlotFormat.OFFLINE, "addr-slot", "addr-picked"))
    }

    @Test
    fun `без слота берётся выбранный вручную — это и есть путь «Другое время»`() {
        assertEquals("addr-picked", SessionCabinet.effectiveAddressId(SlotFormat.OFFLINE, null, "addr-picked"))
    }

    @Test
    fun `словарь форматов приведён — in_person это тоже очно`() {
        assertEquals("addr-picked", SessionCabinet.effectiveAddressId("in_person", null, "addr-picked"))
        assertTrue(SessionCabinet.isRequired("IN_PERSON"))
    }

    @Test
    fun `онлайновая встреча кабинета не требует`() {
        assertFalse(SessionCabinet.isRequired(SlotFormat.ONLINE))
        assertTrue(SessionCabinet.isReady(SlotFormat.ONLINE, null, hasAddresses = true))
    }

    @Test
    fun `очная встреча без кабинета не сохраняется, когда кабинеты есть`() {
        assertFalse(SessionCabinet.isReady(SlotFormat.OFFLINE, null, hasAddresses = true))
        assertFalse(SessionCabinet.isReady(SlotFormat.OFFLINE, "  ", hasAddresses = true))
    }

    @Test
    fun `очная встреча с кабинетом сохраняется`() {
        assertTrue(SessionCabinet.isReady(SlotFormat.OFFLINE, "addr-1", hasAddresses = true))
    }

    @Test
    fun `практика без заведённых кабинетов не упирается в неработающую кнопку`() {
        // Экран в этом случае говорит вслух, что места у встречи не будет.
        assertTrue(SessionCabinet.isReady(SlotFormat.OFFLINE, null, hasAddresses = false))
    }
}
