package ru.cmpas.app.presentation.auth

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Нативный вход через провайдера: чем заводится SDK и что уходит на сервер.
 *
 * Проверки читают исходники. Это слабее прогона экрана, но Compose
 * UI-тестов в модуле нет, а оба правила ниже держатся иначе только на
 * памяти — и оба уже однажды стоили бы дорого:
 *
 *  * идентификатор приложения, вписанный в сборку, расходится с оригиналом
 *    МОЛЧА, и узнали бы мы об этом от сломавшегося входа живого человека;
 *  * голый ключ доступа провайдера вместо подписанного JWT — это подмена
 *    токена: ключ, выданный чужому приложению, подходит к справочнику
 *    профиля так же, как наш.
 */
class NativeProviderSignInTest {

    private val loginScreen = File("src/main/java/ru/cmpas/app/presentation/auth/LoginScreen.kt").readText()
    private val loginModel = File("src/main/java/ru/cmpas/app/presentation/auth/LoginViewModel.kt").readText()

    /**
     * Текст БЕЗ комментариев: проверки спрашивают, что делает код, а не о
     * чём написано в пояснении. Файл, объясняющий «идентификатор мы не
     * вписываем», сам же на своё объяснение и отзывался бы.
     */
    private fun withoutComments(source: String): String = source
        .lines()
        .filterNot { it.trimStart().startsWith("//") || it.trimStart().startsWith("*") || it.trimStart().startsWith("/*") }
        .joinToString("\n")

    @Test
    fun `идентификатор приложения берётся у сервера, а не из сборки`() {
        val screen = withoutComments(loginScreen)
        assertTrue(
            "SDK должен заводиться значением из providerAppIds",
            screen.contains("uiState.providerAppIds[LoginViewModel.PROVIDER_YANDEX]"),
        )
        // Конструктор с тремя аргументами существует ровно ради этого:
        // мета-данные манифеста com.yandex.auth.CLIENT_ID — запасной путь
        // SDK, и пользоваться им значит вписать копию в сборку.
        assertTrue(screen.contains("YandexAuthOptions(false, clientId"))
        assertFalse(
            "идентификатора приложения Яндекса в сборке быть не должно",
            screen.contains("com.yandex.auth.CLIENT_ID"),
        )
    }

    @Test
    fun `кнопка провайдера не показывается без идентификатора`() {
        // Три условия, а не два: сервер назвал провайдера, у нас есть SDK и
        // сервер прислал, чем его заводить. Кнопка без третьего уводит
        // человека в ошибку провайдера — то есть в «вход не работает» без
        // причины на экране.
        val model = withoutComments(loginModel)
        assertTrue(model.contains("PROVIDERS_WITH_NATIVE_SDK"))
        assertTrue(model.contains("providerAppIds[name].isNullOrBlank()"))
    }

    @Test
    fun `на сервер уходит подписанный JWT, а не ключ доступа`() {
        val screen = withoutComments(loginScreen)
        val model = withoutComments(loginModel)

        assertTrue("JWT берётся у SDK", screen.contains("sdk.getJwt(result.token)"))
        assertTrue("обмен идёт методом для JWT", model.contains("exchangeProviderJwt("))
        // Ключ доступа не должен попадать ни в обмен, ни в хранилище.
        assertFalse(
            "ключ доступа провайдера на сервер не отправляется",
            screen.contains("completeProviderJwtSignIn(LoginViewModel.PROVIDER_YANDEX, result.token"),
        )
        assertFalse(
            "ключ доступа провайдера не сохраняется на устройстве",
            screen.contains("saveSimpasIdSession(result.token"),
        )
    }

    @Test
    fun `getJwt не зовётся на главном потоке`() {
        // Это сетевой вызов. На главном потоке Android бросает
        // NetworkOnMainThreadException, и вход падал бы у каждого.
        val screen = withoutComments(loginScreen)
        assertTrue(screen.contains("withContext(Dispatchers.IO) { sdk.getJwt"))
    }

    @Test
    fun `отмена входа не показывается ошибкой`() {
        // Человек передумал. Красная строка в этом месте — обвинение.
        val screen = withoutComments(loginScreen)
        assertTrue(screen.contains("YandexAuthResult.Cancelled -> viewModel.onProviderSignInAborted(failed = false)"))
    }

    @Test
    fun `ВК в перечень собранных SDK не входит, пока нет его идентификатора`() {
        val model = withoutComments(loginModel)
        assertTrue(model.contains("PROVIDERS_WITH_NATIVE_SDK: Set<String> = setOf(PROVIDER_YANDEX)"))
        // Кружок без собранного SDK — обещание, которое некому исполнить.
        assertFalse(model.contains("setOf(PROVIDER_YANDEX, PROVIDER_VK)"))
    }

    @Test
    fun `прежняя дверь Яндекса не выключена, пока нативная не встала`() {
        // Убрать работающий вход, не собрав замену, — изъятие, а не переезд.
        // Кружок прежней двери показывается ровно тогда, когда нативного
        // Яндекса в перечне нет.
        val screen = withoutComments(loginScreen)
        assertTrue(screen.contains("state.providers.none { it == LoginViewModel.PROVIDER_YANDEX }"))
        assertTrue(withoutComments(loginModel).contains("LEGACY_YANDEX_URL"))
    }
}
