package ru.cmpas.app.presentation.connect

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Юридическая конструкция экранов входа и первого подключения.
 *
 * Это не косметика: нарушение любого из четырёх правил блокирует приёмку у
 * стороны СИМПАС (docs/integration/practice-android.md, шаг 7), а два из них
 * — про акцепт чужого документа — стоят дороже приёмки.
 *
 * Проверки читают исходники. Это слабее, чем прогон экрана, но Compose
 * UI-тестов в модуле нет, а без всякой проверки правило держится только на
 * памяти — и однажды не удержится.
 */
class LegalAcceptanceRulesTest {

    private val connectScreen = File("src/main/java/ru/cmpas/app/presentation/connect/ServiceConnectScreen.kt").readText()
    private val connectModel = File("src/main/java/ru/cmpas/app/presentation/connect/ServiceConnectViewModel.kt").readText()
    private val loginScreen = File("src/main/java/ru/cmpas/app/presentation/auth/LoginScreen.kt").readText()

    /**
     * Текст БЕЗ комментариев.
     *
     * Проверки ниже спрашивают, что видит человек, а не о чём написано в
     * пояснении. Без этой чистки файл, объясняющий «юридической строки
     * здесь нет», сам же на неё и отзывался бы — проверка ловила бы
     * собственный комментарий и врала в обе стороны.
     */
    private fun withoutComments(source: String): String = source
        .lines()
        .filterNot { it.trimStart().startsWith("//") || it.trimStart().startsWith("*") || it.trimStart().startsWith("/*") }
        .joinToString("\n")

    @Test
    fun `акцепт даётся действием — кнопка называет действие, а не «принять»`() {
        assertTrue(connectScreen.contains("Начать работу в ПРАКТИКЕ"))
        // «Принять» превращает экран в формальность, которую пролистывают.
        assertFalse("кнопки «Принять» быть не должно", withoutComments(connectScreen).contains("\"Принять\""))
    }

    @Test
    fun `обязательного чекбокса на экране подключения нет`() {
        // Единственный обязательный чекбокс во всей Экосистеме — заверение
        // психолога перед первым клиентом, и он живёт не здесь.
        assertFalse(withoutComments(connectScreen).contains("Checkbox"))
    }

    @Test
    fun `редакция берётся у сервера, а не вписана в сборку`() {
        // Вписанный номер меняется без выпуска приложения и однажды покажет
        // человеку не ту редакцию, которую он принимает.
        assertTrue(connectModel.contains("simpasId.legalDocuments()"))
        assertFalse("номер редакции не вписывается", Regex("""version\s*=\s*"\d""").containsMatchIn(withoutComments(connectModel)))
    }

    @Test
    fun `документа без опубликованной редакции нет — и экран не показывается`() {
        assertTrue(connectModel.contains("firstOrNull { it.product == PRODUCT }"))
        assertTrue(connectModel.contains("NothingToAccept"))
    }

    @Test
    fun `акцепт на чужую редакцию не записывается молча`() {
        // Сервер отвергает расхождение кодом 409. Приложение обязано
        // перечитать документ и показать экран заново, а не «как-нибудь».
        assertTrue(connectModel.contains("GrantResult.StaleVersion"))
        assertTrue(connectModel.contains("Условия обновились"))
    }

    @Test
    fun `ссылка ведёт на конкретную редакцию`() {
        assertTrue(connectScreen.contains("current.url"))
        assertTrue(connectScreen.contains("редакция \${current.version}"))
    }

    @Test
    fun `на экране входа нет юридической строки про Соглашение и Политику`() {
        // Пользовательское соглашение принимается в СИМПАС. Повторный акцепт
        // в продукте создаёт вторую запись о том же факте, с другим временем
        // и другим источником.
        val visible = withoutComments(loginScreen)
        for (forbidden in listOf("Пользовательское соглашение", "Политик", "принимаю", "Принимая")) {
            assertFalse(
                "на экране входа не должно быть «$forbidden»",
                visible.contains(forbidden),
            )
        }
    }

    @Test
    fun `строки про тридцать дней на месте юридической больше нет`() {
        assertFalse(withoutComments(loginScreen).contains("30 дней бесплатно"))
    }

    @Test
    fun `прежние входы не отняты — они переехали в запасную дверь`() {
        // Убрать работающий вход, не собрав нативную замену, значит отнять
        // его у тех, кто им пользуется.
        assertTrue(loginScreen.contains("Другие способы входа"))
        assertTrue(loginScreen.contains("Войти через Яндекс"))
    }

    @Test
    fun `состав кнопок провайдеров — пересечение, и ни один перечень не зашит`() {
        val model = File("src/main/java/ru/cmpas/app/presentation/auth/LoginViewModel.kt").readText()
        assertTrue(model.contains("methods.providers.filter"))
        assertTrue(model.contains("PROVIDERS_WITH_NATIVE_SDK"))
    }

    @Test
    fun `недоступность единого входа названа человеческими словами`() {
        val model = File("src/main/java/ru/cmpas/app/presentation/auth/LoginViewModel.kt").readText()
        assertTrue(model.contains("Вход временно недоступен. Мы уже чиним. Попробуйте через несколько минут."))
    }

    @Test
    fun `вендоренный клиент СИМПАС называет свой источник`() {
        // Копия без происхождения расходится с оригиналом молча.
        val vendored = File("src/main/java/ru/cmpas/simpasid/SimpasIdClient.kt").readText()
        assertTrue(vendored.startsWith("// ВЕНДОРЕННАЯ КОПИЯ"))
        assertTrue(vendored.contains("compas-psy/auth"))
        assertTrue(vendored.contains("Взято: коммит"))
    }
}
