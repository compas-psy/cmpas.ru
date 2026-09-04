package ru.cmpas.app.presentation.notifications

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.cmpas.app.domain.model.AttentionItem
import ru.cmpas.app.domain.model.PracticeNotification

/**
 * §6 приёмка Задачи 17 для строки «требует внимания».
 *
 * Сам NotificationCenterSheet — Composable, а Compose UI-тестов в модуле нет
 * (тот же выбор и та же причина, что в DashboardViewModelTest): проверяется
 * не вёрстка, а вынесенное из неё решение — attentionTarget(), которым строка
 * дословно и пользуется, решая, куда вести по нажатию.
 */
class AttentionTargetTest {

    private fun attention(
        type: String,
        sessionId: String? = null,
        clientId: String? = null,
        batchId: String? = null,
    ) = AttentionItem(id = "$type:x", type = type, label = "…", sessionId = sessionId, clientId = clientId, batchId = batchId)

    @Test
    fun `сессия без заметки открывает именно эту сессию`() {
        val target = attentionTarget(attention("session_without_notes", sessionId = "s-1", clientId = "c-1"))
        assertEquals(AttentionTarget.OpenSession("s-1"), target)
    }

    @Test
    fun `неотмеченная оплата открывает именно эту сессию, а не карточку клиента`() {
        val target = attentionTarget(attention("session_unpaid", sessionId = "s-2", clientId = "c-2"))
        assertEquals(AttentionTarget.OpenSession("s-2"), target)
    }

    @Test
    fun `клиент без согласия открывает именно этого клиента`() {
        val target = attentionTarget(attention("client_without_consent", clientId = "c-9"))
        assertEquals(AttentionTarget.OpenClient("c-9"), target)
    }

    @Test
    fun `разбор импорта никуда не ведёт — экрана разбора в приложении пока нет`() {
        assertNull(attentionTarget(attention("import_review", batchId = "b-1")))
    }

    @Test
    fun `пункт без идентификаторов не притворяется кликабельным`() {
        assertNull(attentionTarget(attention("session_without_notes")))
        assertNull(attentionTarget(attention("session_without_notes", sessionId = "")))
    }

    @Test
    fun `у каждого типа задачи свой значок, отличный от значка по умолчанию`() {
        val icons = listOf("session_without_notes", "session_unpaid", "client_without_consent", "import_review")
            .map { attentionIcon(it) }
        assertEquals(icons.size, icons.distinct().size)
        assertTrue(icons.none { it == attentionIcon("что-то незнакомое") })
    }

    /**
     * §7: у задачи нет и не должно быть собственного состояния «прочитано»,
     * «скрыто», «отложено» — она живёт ровно столько, сколько существует
     * проблема. Прочитано/непрочитано — свойство истории уведомлений, и
     * остаётся только там: это две разные модели и две разные секции.
     */
    @Test
    fun `у задачи нет read-state — он есть только у истории уведомлений`() {
        val taskFields = AttentionItem::class.java.declaredFields.map { it.name }
        val notificationFields = PracticeNotification::class.java.declaredFields.map { it.name }

        assertTrue(taskFields.none { it in listOf("unread", "readAt", "dismissedAt", "snoozedUntil") })
        assertTrue(notificationFields.contains("unread"))
    }
}
