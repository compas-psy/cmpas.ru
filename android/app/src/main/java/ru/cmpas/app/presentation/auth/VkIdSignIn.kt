package ru.cmpas.app.presentation.auth

import ru.cmpas.app.BuildConfig
import java.security.MessageDigest
import java.security.SecureRandom
import android.util.Base64

/**
 * Нативный вход ВК: что приложение задумывает ДО входа и что обязано
 * назвать серверу ПОСЛЕ.
 *
 * Обмен кода на личность остаётся у СИМПАС — приложение кода на токен не
 * меняет и ключа ВК для этого не имеет. Но в нативном входе авторизацию
 * начинает приложение, а не сервер, поэтому проверочный код PKCE, строку
 * состояния и адрес возврата знает только оно. Сервер требует их все:
 * без любого из трёх ВК откажет, и слать заведомо негодный запрос незачем
 * (СИМПАС, issue #172).
 *
 * Здесь нет ни одного обращения к Android SDK, кроме Base64, — чтобы
 * правила ниже проверялись обычным тестом, а не эмулятором.
 */
object VkIdSignIn {

    /**
     * Адрес возврата, который SDK ВК складывает из мета-данных манифеста:
     * `${VKIDRedirectScheme}://${VKIDRedirectHost}/blank.html`
     * (VKIDDepsProd.serviceCredentials). Схема — это `vk` плюс
     * идентификатор приложения.
     *
     * Значение обязано совпасть с тем, что SDK назвал ВК, СЛОВО В СЛОВО:
     * ВК сверяет адрес при обмене кода и при расхождении отказывает. Поэтому
     * оно складывается по тому же правилу, а не пишется руками во второй раз.
     */
    fun redirectUri(appId: String): String = "vk$appId://${BuildConfig.VK_REDIRECT_HOST}/blank.html"

    /**
     * Проверочный код PKCE: 43–128 символов из [A-Za-z0-9-._~] (RFC 7636).
     *
     * Секретом не является — это одноразовая величина одной попытки входа.
     * Смысл его в другом: код, перехваченный по дороге, без проверочного
     * кода не обменивается.
     */
    fun newCodeVerifier(random: SecureRandom = SecureRandom()): String {
        val bytes = ByteArray(64)
        random.nextBytes(bytes)
        return base64Url(bytes)
    }

    /** Вызов PKCE: BASE64URL(SHA-256(проверочный код)), без выравнивания. */
    fun codeChallenge(codeVerifier: String): String =
        base64Url(MessageDigest.getInstance("SHA-256").digest(codeVerifier.toByteArray(Charsets.US_ASCII)))

    /**
     * Строка состояния. Её задаёт приложение и её же предъявляет серверу:
     * ответ провайдера, пришедший с чужим состоянием, — это ответ на чужую
     * попытку входа.
     */
    fun newState(random: SecureRandom = SecureRandom()): String {
        val bytes = ByteArray(16)
        random.nextBytes(bytes)
        return base64Url(bytes)
    }

    private fun base64Url(bytes: ByteArray): String =
        Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
}
