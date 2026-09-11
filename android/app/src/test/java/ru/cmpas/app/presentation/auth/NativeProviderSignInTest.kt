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
    fun `SDK заводится только при совпадении идентификаторов`() {
        // Идентификатор SDK берёт из манифеста: публичного способа передать
        // его в рантайме у него нет — конструктор с тремя аргументами
        // internal. Поэтому единственная защита от расхождения — сверка,
        // и SDK не создаётся, пока провайдер не попал в uiState.providers.
        val screen = withoutComments(loginScreen)
        assertTrue(screen.contains("uiState.providerAppIds[LoginViewModel.PROVIDER_YANDEX]"))
        assertTrue(screen.contains("LoginViewModel.PROVIDER_YANDEX in uiState.providers"))
        assertTrue(screen.contains("if (yandexReady) YandexAuthSdk.create(YandexAuthOptions(context))"))
    }

    @Test
    fun `кнопка провайдера показывается только при совпадении идентификаторов`() {
        // Копию убрать нельзя — можно убрать её молчание. Разошлись
        // значения: кнопки нет, человек видит прежнюю дверь вместо «вход не
        // работает» без причины.
        val model = withoutComments(loginModel)
        assertTrue(model.contains("matchesBuiltInAppId(name, methods.providerAppIds[name])"))
        assertTrue(model.contains("builtIn == serverAppId"))
    }

    @Test
    fun `правило совпадения идентификаторов — все четыре случая`() {
        // Проверяется само правило, а не значение секрета в этом прогоне:
        // привязанный к BuildConfig тест менял бы ответ в тот день, когда
        // секрет появится, и проверял бы настройку вместо логики.
        assertTrue(LoginViewModel.appIdMatches("123", "123"))
        // Секрета в сборке нет — адрес возврата собран из заглушки, вход
        // не сработает, кнопки быть не должно.
        assertFalse(LoginViewModel.appIdMatches("", "123"))
        // Сервер не назвал идентификатор — заводить SDK нечем.
        assertFalse(LoginViewModel.appIdMatches("123", null))
        // Разъехались — код, выданный под наш идентификатор, сервер
        // обменяет своим, и провайдер откажет.
        assertFalse(LoginViewModel.appIdMatches("123", "456"))
    }

    @Test
    fun `ВК в перечень собранных не входит, пока нет его идентификатора`() {
        val model = withoutComments(loginModel)
        assertTrue(model.contains("PROVIDER_YANDEX to BuildConfig.YANDEX_NATIVE_CLIENT_ID"))
        assertFalse(model.contains("PROVIDER_VK to BuildConfig"))
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
    fun `прежняя дверь Яндекса не выключена, пока нативная не встала`() {
        // Убрать работающий вход, не собрав замену, — изъятие, а не переезд.
        // Кружок прежней двери показывается ровно тогда, когда нативного
        // Яндекса в перечне нет.
        val screen = withoutComments(loginScreen)
        assertTrue(screen.contains("state.providers.none { it == LoginViewModel.PROVIDER_YANDEX }"))
        assertTrue(withoutComments(loginModel).contains("LEGACY_YANDEX_URL"))
    }
}
