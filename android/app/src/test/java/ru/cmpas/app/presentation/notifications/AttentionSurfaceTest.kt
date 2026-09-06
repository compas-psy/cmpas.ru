package ru.cmpas.app.presentation.notifications

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.cmpas.app.presentation.navigation.ScreenFocus
import java.io.File

/**
 * Приёмка Задачи 23 по составу шторки уведомлений и по тому, куда именно
 * приводит каждый пункт «требует внимания».
 *
 * Compose UI-тестов в модуле нет (см. DashboardViewModelTest), поэтому
 * порядок секций и разводка переходов проверяются по исходнику: слабее
 * клика, но ловит ровно то, ради чего задача заведена, — смешивание
 * «требует внимания» с историей и возврат к переходу «куда-нибудь».
 */
class AttentionSurfaceTest {

    private val sheet = File("src/main/java/ru/cmpas/app/presentation/notifications/NotificationCenterSheet.kt").readText()
    private val navHost = File("src/main/java/ru/cmpas/app/presentation/navigation/CompasNavHost.kt").readText()

    private fun code(source: String) = source
        .lines()
        .filterNot { it.trimStart().startsWith("//") || it.trimStart().startsWith("*") || it.trimStart().startsWith("/*") }
        .joinToString("\n")

    // ── §1 Две разные секции, и «требует внимания» сверху ──

    @Test
    fun `требует внимания идёт выше истории уведомлений`() {
        val body = code(sheet)
        val attention = body.indexOf("Eyebrow(\"Требует внимания\")")
        val today = body.indexOf("Eyebrow(\"Сегодня\")")
        val earlier = body.indexOf("Eyebrow(\"Ранее\")")

        assertTrue("секция внимания есть", attention >= 0)
        assertTrue("история есть", today >= 0 && earlier >= 0)
        assertTrue("внимание выше истории", attention < today && attention < earlier)
    }

    @Test
    fun `история остаётся отдельной секцией со своим прочитано`() {
        val body = code(sheet)
        // История живёт своей жизнью: у неё загрузка, пустое состояние и
        // отметка прочитанного, которых у «требует внимания» нет и не должно
        // быть — это вычисляемое состояние практики, а не журнал.
        assertTrue(body.contains("markVisibleRead"))
        assertTrue(body.contains("uiState.items"))
        assertTrue(body.contains("NotificationRow("))
        // Пункты внимания рисуются отдельно от строк истории.
        assertTrue(body.contains("attentionItems.forEachIndexed"))
        assertFalse("внимание не подмешивается в список истории", body.contains("uiState.items + attentionItems"))
        assertFalse(body.contains("attentionItems + uiState.items"))
    }

    // ── §2 Каждый тип ведёт в своё действие ──

    @Test
    fun `у шторки три отдельных адресата для внимания и два для истории`() {
        val body = code(sheet)
        for (callback in listOf("onWriteNote", "onMarkPayment", "onRequestConsent")) {
            assertTrue("нет колбэка $callback", body.contains("$callback: (String) -> Unit"))
        }
        assertTrue(body.contains("is AttentionTarget.WriteNote -> onWriteNote(target.sessionId)"))
        assertTrue(body.contains("is AttentionTarget.MarkPayment -> onMarkPayment(target.sessionId)"))
        assertTrue(body.contains("is AttentionTarget.RequestConsent -> onRequestConsent(target.clientId)"))
        // Прежнее «сессия важнее клиента» ушло вместе со своими целями.
        assertFalse(body.contains("AttentionTarget.OpenSession"))
        assertFalse(body.contains("AttentionTarget.OpenClient"))
    }

    @Test
    fun `переходы ведут в существующие экраны на нужном шаге`() {
        val nav = code(navHost)
        assertTrue(
            "заметка — существующий экран заметки по этой сессии",
            nav.contains("onWriteNote = { id -> navController.navigate(Screen.PostSessionNote.createRoute(id)) }"),
        )
        assertTrue(
            "оплата — карточка сессии, раскрытая на оплате",
            nav.contains("onMarkPayment = { id -> navController.navigate(Screen.SessionDetail.createRoute(id, ScreenFocus.PAYMENT)) }"),
        )
        assertTrue(
            "согласие — карточка клиента, раскрытая на документе",
            nav.contains("onRequestConsent = { id -> navController.navigate(Screen.ClientDetail.createRoute(id, ScreenFocus.CONSENT)) }"),
        )
    }

    @Test
    fun `фокус экрана — перечисление, а не свободная строка`() {
        assertEquals(ScreenFocus.CONSENT, ScreenFocus.from("consent"))
        assertEquals(ScreenFocus.PAYMENT, ScreenFocus.from("payment"))
        // Опечатка не открывает экран «наполовину»: неизвестное значение —
        // это обычный заход, а не молча пропущенное действие.
        assertEquals(null, ScreenFocus.from("consnet"))
        assertEquals(null, ScreenFocus.from(null))
    }
}
