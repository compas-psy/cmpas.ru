package ru.cmpas.app.presentation.notifications

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import ru.cmpas.app.domain.model.AttentionItem

/**
 * Приёмка Задачи 23 §2: пункт «требует внимания» ведёт к ДЕЙСТВИЮ, которым
 * проблему закрывают, а не к объекту, в котором она обнаружена.
 *
 * Раньше правило было «есть sessionId — открываем сессию, иначе клиента».
 * У пункта про сессию заполнены оба идентификатора, поэтому человек попадал
 * на верхушку карточки и дальше искал, чем именно чинить: заметку, оплату,
 * согласие. Пункт называет действие — значит и вести обязан прямо в него.
 *
 * Compose UI-тестов в модуле нет (см. DashboardViewModelTest), поэтому
 * проверяется не вёрстка, а вынесенное из неё решение — attentionTarget(),
 * которым строка и пользуется.
 */
class AttentionTargetTest {

    private fun attention(
        type: String,
        sessionId: String? = null,
        clientId: String? = null,
        batchId: String? = null,
    ) = AttentionItem(type = type, label = "тест", sessionId = sessionId, clientId = clientId, batchId = batchId)

    @Test
    fun `сессия без заметки ведёт в заметку по этой сессии`() {
        val target = attentionTarget(attention("session_without_notes", sessionId = "S1", clientId = "C1"))

        assertEquals(AttentionTarget.WriteNote("S1"), target)
    }

    @Test
    fun `неоплаченная сессия ведёт в оплату этой сессии`() {
        val target = attentionTarget(attention("session_unpaid", sessionId = "S2", clientId = "C2"))

        assertEquals(AttentionTarget.MarkPayment("S2"), target)
    }

    @Test
    fun `клиент без согласия ведёт в согласие этого клиента`() {
        val target = attentionTarget(attention("client_without_consent", clientId = "C1", sessionId = "S3"))

        // У пункта есть и sessionId — но тип говорит о согласии, значит цель
        // клиентская. Прежнее правило увело бы отсюда в сессию.
        assertEquals(AttentionTarget.RequestConsent("C1"), target)
    }

    @Test
    fun `разбор импорта не получает выдуманной цели`() {
        assertNull(attentionTarget(attention("import_review", batchId = "b-1")))
        // Даже если сервер однажды приложит к нему идентификаторы: экрана
        // разбора импорта в приложении нет, и вести «куда-нибудь похоже» хуже,
        // чем оставить строку некликабельной.
        assertNull(attentionTarget(attention("import_review", sessionId = "S9", clientId = "C9")))
    }

    @Test
    fun `тип не может уйти в чужую цель только потому, что заполнены оба идентификатора`() {
        val both = listOf(
            "session_without_notes" to AttentionTarget.WriteNote("S1"),
            "session_unpaid" to AttentionTarget.MarkPayment("S1"),
            "client_without_consent" to AttentionTarget.RequestConsent("C1"),
        )

        for ((type, expected) in both) {
            assertEquals(type, expected, attentionTarget(attention(type, sessionId = "S1", clientId = "C1")))
        }
    }

    @Test
    fun `без нужного идентификатора цели нет — переход не выдумывается`() {
        assertNull(attentionTarget(attention("session_without_notes", clientId = "C1")))
        assertNull(attentionTarget(attention("session_unpaid", clientId = "C1")))
        assertNull(attentionTarget(attention("client_without_consent", sessionId = "S1")))
        assertNull(attentionTarget(attention("session_without_notes", sessionId = "  ")))
    }

    @Test
    fun `неизвестный серверу тип цели не получает`() {
        assertNull(attentionTarget(attention("something_new", sessionId = "S1", clientId = "C1")))
    }
}
