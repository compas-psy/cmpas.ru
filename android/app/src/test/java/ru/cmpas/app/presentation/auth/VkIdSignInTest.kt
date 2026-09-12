package ru.cmpas.app.presentation.auth

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * PKCE и адрес возврата ВК.
 *
 * Проверяется то, что нельзя увидеть глазами в отладке: адрес возврата
 * обязан совпасть с тем, что SDK назвал ВК, СЛОВО В СЛОВО, а вызов PKCE —
 * быть настоящим вызовом, а не переписанным проверочным кодом. Ошибка в
 * любом из двух мест выглядит одинаково — «ВК отказал», — и разбираться
 * пришлось бы по журналам чужого сервера.
 *
 * Robolectric нужен ради android.util.Base64: своей реализации заводить
 * незачем, а настоящая в обычном JVM-тесте не работает.
 */
@RunWith(RobolectricTestRunner::class)
class VkIdSignInTest {

    @Test
    fun `у ВК запрашивается почта — без неё вход не состоится`() {
        // 12.09.2026, живой вход: `422 email_required`. Код SDK отдавал,
        // СИМПАС его обменивал, ВК отвечал профилем БЕЗ адреса — и связывать
        // учётную запись было нечем (И-5: у каждой всегда есть
        // подтверждённая почта).
        //
        // Область доступа в нативном входе называет ПРИЛОЖЕНИЕ: авторизацию
        // начинает оно. В браузерном её ставит сервер СИМПАС, поэтому там
        // почта была, а здесь — нет.
        val screen = File("src/main/java/ru/cmpas/app/presentation/auth/LoginScreen.kt").readText()
        assertTrue("почта обязана запрашиваться", screen.contains("""this.scopes = setOf("email")"""))
        // Ничего сверх почты: ФИО, аватар, пол и день рождения нам негде
        // показывать и незачем хранить.
        assertFalse("лишних прав не просим", screen.contains("vkid.personal_info"))
    }

    @Test
    fun `адрес возврата складывается по правилу самого SDK`() {
        // VKIDDepsProd: "$redirectScheme://$redirectHost/blank.html",
        // где схема — "vk" + идентификатор приложения.
        assertEquals("vk1233445://vk.ru/blank.html", VkIdSignIn.redirectUri("1233445"))
    }

    @Test
    fun `проверочный код годен по RFC 7636`() {
        val verifier = VkIdSignIn.newCodeVerifier()
        assertTrue("длина $verifier", verifier.length in 43..128)
        assertTrue("недопустимые знаки: $verifier", verifier.all { it.isLetterOrDigit() || it in "-._~" })
    }

    @Test
    fun `вызов PKCE — это SHA-256 от проверочного кода, а не он сам`() {
        val verifier = "abcdefghijklmnopqrstuvwxyz0123456789-._~ABCDEFGHIJ"
        val challenge = VkIdSignIn.codeChallenge(verifier)

        assertFalse("вызов повторяет проверочный код", challenge == verifier)
        // Считаем ожидаемое независимо, а не тем же путём, что в коде.
        val digest = MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.US_ASCII))
        val expected = android.util.Base64.encodeToString(
            digest,
            android.util.Base64.URL_SAFE or android.util.Base64.NO_PADDING or android.util.Base64.NO_WRAP,
        )
        assertEquals(expected, challenge)
    }

    @Test
    fun `в вызове PKCE нет знаков, которые ломают адрес`() {
        // base64 обычного вида даёт «+», «/» и «=»; в параметре запроса они
        // означают не то, что в них клали, и ВК отвечает отказом.
        val challenge = VkIdSignIn.codeChallenge(VkIdSignIn.newCodeVerifier())
        assertFalse(challenge.contains("+"))
        assertFalse(challenge.contains("/"))
        assertFalse(challenge.contains("="))
        assertFalse(challenge.contains("\n"))
    }

    @Test
    fun `две попытки входа не делят проверочный код и состояние`() {
        // Один и тот же проверочный код на две попытки означает, что код,
        // перехваченный в первой, обменивается во второй.
        val random = SecureRandom()
        assertFalse(VkIdSignIn.newCodeVerifier(random) == VkIdSignIn.newCodeVerifier(random))
        assertFalse(VkIdSignIn.newState(random) == VkIdSignIn.newState(random))
    }
}
