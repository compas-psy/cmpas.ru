package ru.cmpas.app.data.local

import androidx.test.core.app.ApplicationProvider
import kotlinx.serialization.json.buildJsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import ru.cmpas.app.data.api.AnalyticsEventEnvelope

/**
 * Очередь аналитики на настоящем SharedPreferences (Robolectric) — своя,
 * отдельная от очереди досылки практики. Проверяет то, что специфично для
 * этого хранилища: потолок размера, точечное удаление подтверждённого
 * (partial-failure semantics со стороны AnalyticsTransport) и полную очистку
 * по отзыву согласия.
 */
@RunWith(RobolectricTestRunner::class)
class AnalyticsEventStoreTest {

    private lateinit var store: AnalyticsEventStore

    @Before
    fun setUp() {
        store = AnalyticsEventStore(ApplicationProvider.getApplicationContext())
    }

    private fun envelope(id: String) = AnalyticsEventEnvelope(
        event = "client_created",
        ts = "2026-08-23T10:00:00Z",
        props = buildJsonObject { },
        schemaVersion = 1,
        eventId = id,
    )

    @Test
    fun `enqueue сохраняет порядок постановки`() {
        store.enqueue(envelope("a"))
        store.enqueue(envelope("b"))
        store.enqueue(envelope("c"))

        assertEquals(listOf("a", "b", "c"), store.peek(10).map { it.eventId })
    }

    @Test
    fun `removeByEventIds удаляет только перечисленные — остальное остаётся в порядке`() {
        store.enqueue(envelope("a"))
        store.enqueue(envelope("b"))
        store.enqueue(envelope("c"))

        store.removeByEventIds(setOf("b"))

        assertEquals(listOf("a", "c"), store.peek(10).map { it.eventId })
    }

    @Test
    fun `clear стирает очередь целиком — так работает отзыв согласия`() {
        store.enqueue(envelope("a"))
        store.enqueue(envelope("b"))

        store.clear()

        assertEquals(0, store.size())
        assertTrue(store.peek(10).isEmpty())
    }

    @Test
    fun `потолок размера обрезает самые старые события`() {
        repeat(510) { i -> store.enqueue(envelope("id-$i")) }

        assertEquals(500, store.size())
        // Первые 10 (id-0 … id-9) должны были вытесниться.
        assertTrue(store.peek(1).single().eventId == "id-10")
    }

    @Test
    fun `peek не удаляет события — их убирает только removeByEventIds`() {
        store.enqueue(envelope("a"))
        store.peek(10)
        assertEquals(1, store.size())
    }
}
