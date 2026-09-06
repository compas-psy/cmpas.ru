package ru.cmpas.app.presentation.session

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.cmpas.app.domain.model.PaymentStatus
import java.io.File

/**
 * Приёмка Задачи 23 §8: неоплата ведёт в настоящее действие оплаты.
 *
 * Действие существовало и раньше — SessionDetailViewModel.setPaymentStatus()
 * пишет paymentStatus сессии на сервер тем же полем, которым живёт остальной
 * продукт. Кнопки к нему на экране сессии не было вовсе: отметить оплату из
 * карточки было нечем, а пункт «требует внимания» приводил на верхушку
 * карточки, где сделать с неоплатой было ничего нельзя.
 *
 * Нового платёжного механизма при этом не заводится: приложение отмечает
 * факт, известный специалисту, и никаких ссылок на оплату не показывает —
 * выдуманная ссылка уже была удалена в Задаче 20 и возвращаться не должна.
 */
class SessionPaymentSurfaceTest {

    private val screen = File("src/main/java/ru/cmpas/app/presentation/session/SessionDetailScreen.kt").readText()
    private val viewModel = File("src/main/java/ru/cmpas/app/presentation/session/SessionDetailViewModel.kt").readText()

    private fun code(source: String) = source
        .lines()
        .filterNot { it.trimStart().startsWith("//") || it.trimStart().startsWith("*") || it.trimStart().startsWith("/*") }
        .joinToString("\n")

    @Test
    fun `оплата пишется существующим серверным действием`() {
        assertTrue(
            "сервер, а не состояние экрана",
            code(viewModel).contains("api.updateSession(sessionId, UpdateSessionRequest(paymentStatus = status))"),
        )
        assertTrue("экран зовёт именно его", code(screen).contains("viewModel.setPaymentStatus(session.id, status)"))
    }

    @Test
    fun `на карточке сессии есть чем отметить оплату`() {
        val body = code(screen)
        assertTrue("кнопка", body.contains("onClick = { showPayment = true }"))
        assertTrue("шторка", body.contains("PaymentSheet("))
        assertTrue(body.contains("text = \"Отметить оплаченной\""))
        assertTrue(body.contains("PaymentStatus.PAID"))
    }

    @Test
    fun `приход из внимания сразу раскрывает оплату`() {
        val body = code(screen)
        assertTrue(body.contains("focus: ScreenFocus? = null"))
        assertTrue(body.contains("if (focus == ScreenFocus.PAYMENT && uiState.session != null) showPayment = true"))
    }

    @Test
    fun `выдуманных ссылок на оплату не появилось`() {
        val body = code(screen)
        assertFalse(body.contains("cmpas.ru/pay"))
        assertFalse(body.contains("paymentLink"))
        assertFalse("платёжной страницы приложение не открывает", body.contains("openUri"))
    }

    @Test
    fun `состояние оплаты называется словами, а не кодом`() {
        assertEquals("Оплачено", paymentStatusLabel(PaymentStatus.PAID))
        assertEquals("Не оплачено", paymentStatusLabel(PaymentStatus.UNPAID))
        assertEquals("Оплачено частично", paymentStatusLabel(PaymentStatus.PARTIAL))
        assertEquals("Оплата не требуется", paymentStatusLabel(PaymentStatus.NOT_REQUIRED))
    }
}
