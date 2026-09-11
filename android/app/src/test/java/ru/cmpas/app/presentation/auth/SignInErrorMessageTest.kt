package ru.cmpas.app.presentation.auth

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.cmpas.simpasid.SimpasIdException

/**
 * Отказ входа называет причину, а не одну фразу на все случаи.
 *
 * Было: любой отказ показывался как «вход временно недоступен, мы уже
 * чиним». Для половины отказов это неправда — чинить нечего, и ждать
 * бесполезно. Человек, которому провайдер не отдал подтверждённой почты,
 * жал бы кнопку до вечера, хотя нужное действие мы знаем в момент отказа.
 *
 * Коды взяты из перечня стороны СИМПАС и сверены с их сервером.
 */
class SignInErrorMessageTest {

    private fun refusal(code: String?) = SimpasIdException("отказ", code, 400)

    @Test
    fun `провайдер без подтверждённой почты — зовём войти по почте`() {
        val message = LoginViewModel.signInErrorMessage(refusal("email_required"))
        assertTrue(message.contains("по почте"))
        assertFalse("ждать тут нечего", message.contains("Мы уже чиним"))
    }

    @Test
    fun `личность занята — человека отправляют в его же учётную запись`() {
        val message = LoginViewModel.signInErrorMessage(refusal("identity_taken"))
        assertTrue(message.contains("уже связан"))
        assertFalse(message.contains("Мы уже чиним"))
    }

    @Test
    fun `исчерпаны попытки — названо ожидание, а не поломка`() {
        val message = LoginViewModel.signInErrorMessage(refusal("too_many_attempts"))
        assertTrue(message.contains("Слишком много попыток"))
    }

    @Test
    fun `провайдер не подтвердил вход — предложен второй путь`() {
        val message = LoginViewModel.signInErrorMessage(refusal("invalid_provider_code"))
        assertTrue(message.contains("по почте"))
    }

    @Test
    fun `способ входа выключен у СИМПАС — не наша поломка`() {
        val message = LoginViewModel.signInErrorMessage(refusal("provider_unavailable"))
        assertTrue(message.contains("недоступен"))
        assertTrue(message.contains("по почте"))
    }

    // ЭТО НАША ОШИБКА, И ОБЩАЯ ФРАЗА ЗДЕСЬ ЧЕСТНА.
    //
    // forbidden_client и invalid_request означают неверную настройку или
    // сломанный запрос. Человеку правда нечего делать, и выдумывать ему
    // действие было бы хуже молчания.
    @Test
    fun `наша ошибка настройки — общая фраза`() {
        for (code in listOf("forbidden_client", "invalid_request", null, "что-то новое")) {
            assertEquals(LoginViewModel.SIGN_IN_UNAVAILABLE, LoginViewModel.signInErrorMessage(refusal(code)))
        }
    }

    @Test
    fun `обычная ошибка сети — тоже общая фраза`() {
        assertEquals(
            LoginViewModel.SIGN_IN_UNAVAILABLE,
            LoginViewModel.signInErrorMessage(java.io.IOException("сеть отвалилась")),
        )
    }

    // Требование рецепта СИМПАС, и оно верное: код ошибки и адрес сервера
    // человеку ничего не объясняют, а тревогу добавляют.
    @Test
    fun `ни кода ошибки, ни адреса сервера в тексте нет`() {
        val codes = listOf("email_required", "identity_taken", "too_many_attempts",
                           "invalid_provider_code", "provider_unavailable", "forbidden_client")
        for (code in codes) {
            val message = LoginViewModel.signInErrorMessage(refusal(code))
            assertFalse(message, message.contains(code))
            assertFalse(message, message.contains("cmpas.ru"))
            assertFalse(message, message.contains("http"))
        }
    }
}
