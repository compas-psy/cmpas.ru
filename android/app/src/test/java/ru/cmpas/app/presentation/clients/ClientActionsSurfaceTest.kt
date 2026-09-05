package ru.cmpas.app.presentation.clients

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.cmpas.app.domain.model.OnboardingDoc
import java.io.File

/**
 * Приёмка Задачи 23 по карточке клиента.
 *
 * Два правила, которые здесь и сторожатся:
 *
 *   • нижняя панель предлагает то, что в этот момент возможно: писать можно
 *     только туда, где связь есть. «Написать» непривязанному клиенту — это
 *     кнопка, которой некуда писать, поэтому второе действие зависит от
 *     hasMessenger с сервера, а не от наличия телефона или почты;
 *   • богатая шторка приглашения остаётся богатой. QR, MAX, Telegram,
 *     проверка подключения и повтор — это и есть способ довести клиента до
 *     связи; заменить её кнопкой «скопировать ссылку» значило бы выбросить
 *     работающий кусок продукта.
 *
 * Compose UI-тестов в модуле нет (см. DashboardViewModelTest), поэтому состав
 * экрана проверяется по исходнику.
 */
class ClientActionsSurfaceTest {

    private val screen = File("src/main/java/ru/cmpas/app/presentation/clients/ClientDetailScreen.kt").readText()
    private val comms = File("src/main/java/ru/cmpas/app/presentation/comms/CommunicationSheets.kt").readText()
    private val viewModel = File("src/main/java/ru/cmpas/app/presentation/clients/ClientDetailViewModel.kt").readText()
    private val navHost = File("src/main/java/ru/cmpas/app/presentation/navigation/CompasNavHost.kt").readText()
    private val quickAction = File("src/main/java/ru/cmpas/app/presentation/actions/QuickActionScreen.kt").readText()

    private fun code(source: String) = source
        .lines()
        .filterNot { it.trimStart().startsWith("//") || it.trimStart().startsWith("*") || it.trimStart().startsWith("/*") }
        .joinToString("\n")

    // ── §4 Записать сессию ──

    @Test
    fun `основное действие внизу называется Записать сессию`() {
        val body = code(screen)
        assertTrue(body.contains("text = \"Записать сессию\""))
        assertFalse("прежней подписи не осталось", body.contains("text = \"Добавить запись\""))
    }

    @Test
    fun `запись создаётся для этого клиента в существующей форме`() {
        val body = code(screen)
        assertTrue("кнопка передаёт клиента", body.contains("onClick = { onScheduleClick(clientId) }"))

        val nav = code(navHost)
        assertTrue(
            "та же форма записи, с уже выбранным клиентом",
            nav.contains("onScheduleClick = { id -> navController.navigate(Screen.QuickAction.createRoute(\"new-session\", id)) }"),
        )
        // Второго редактора записи нет: форма одна, у неё лишь появился
        // предвыбранный клиент.
        assertTrue(code(quickAction).contains("initialClientId: String? = null"))
        assertTrue(code(quickAction).contains("mutableStateOf(initialClientId)"))
    }

    // ── §5 Второе действие зависит от связи ──

    @Test
    fun `связь берётся с сервера, а не угадывается по телефону или почте`() {
        val body = code(screen)
        assertTrue(body.contains("val bound = detail?.hasMessenger == true"))
        assertFalse(
            "привязка не выводится из контактов",
            body.contains(Regex("""bound\s*=\s*[^\n]*(phone|email)""")),
        )
    }

    @Test
    fun `привязанному клиенту предлагают Написать, непривязанному — Пригласить`() {
        val body = code(screen)
        val sticky = body.substringAfter("text = \"Записать сессию\"").substringBefore("when (sheet)")

        assertTrue("ветка по привязке", sticky.contains("if (bound)"))
        assertTrue(sticky.contains("text = \"Написать\""))
        assertTrue(sticky.contains("text = \"Пригласить\""))
        assertTrue("написать — существующая шторка сообщения", sticky.contains("sheet = ClientSheet.MESSAGE"))
        assertTrue("пригласить — существующая шторка приглашения", sticky.contains("sheet = ClientSheet.INVITE"))
    }

    @Test
    fun `обе шторки — те, что уже были`() {
        val body = code(screen)
        assertTrue(body.contains("ClientSheet.MESSAGE -> if (client != null) SendMessageSheet("))
        assertTrue(body.contains("ClientSheet.INVITE -> if (client != null) InviteSheet("))
    }

    // ── §6 InviteSheet не урезана ──

    @Test
    fun `шторка приглашения сохраняет QR, MAX и Telegram`() {
        val body = code(comms)
        assertTrue("QR остался", body.contains("QrCodeImage(content = invite.inviteLink)"))
        assertTrue("MAX остался", body.contains("\"MAX\""))
        assertTrue("Telegram остался", body.contains("Telegram"))
    }

    @Test
    fun `шторка приглашения сохраняет проверку подключения и повтор`() {
        assertTrue("повтор", code(comms).contains("onRetry"))
        assertTrue("состояние каналов приходит в шторку", code(comms).contains("channelStatus: ClientChannelStatus?"))
        // Опрос подключения живёт в ViewModel и никуда не делся.
        assertTrue("опрос", code(viewModel).contains("delay(4_000)"))
        assertTrue(code(viewModel).contains("channelStatus = status"))
    }

    @Test
    fun `приглашение не подменяется постоянной ссылкой записи`() {
        val body = code(screen)
        // Постоянная ссылка записи — другой поток и другая сущность.
        assertFalse(body.contains("bookingLink"))
        assertTrue("приглашение генерируется своим вызовом", body.contains("viewModel.generateInviteLink(clientId, inviteChannel)"))
    }

    // ── §7 Согласие — тот же документный поток ──

    @Test
    fun `баннер согласия и приход из внимания выбирают документ одной функцией`() {
        val body = code(screen)
        assertTrue("баннер", body.contains("preferredDocumentId = consentDocumentId(uiState.documents)"))
        assertTrue("фокус экрана", body.contains("ScreenFocus.CONSENT"))
        assertTrue("та же шторка документов", body.contains("sheet = ClientSheet.DOCUMENT"))
        // Второй шторки согласия не появилось.
        assertFalse(body.contains("ConsentSheet("))
    }

    @Test
    fun `выбор документа согласия — по смыслу, и пустой список не выдумывает документ`() {
        val documents = listOf(
            OnboardingDoc(id = "d-terms", title = "Пользовательское соглашение"),
            OnboardingDoc(id = "d-consent", title = "Согласие на обработку данных"),
        )

        // «Соглашение» и «согласие» — разные слова: подставляется именно
        // согласие, а не первый попавшийся документ с похожим корнем.
        assertEquals("d-consent", consentDocumentId(documents))
        assertNull(consentDocumentId(emptyList()))
        assertNull(consentDocumentId(listOf(OnboardingDoc(id = "d-x", title = "Памятка"))))
    }
}
