package ru.cmpas.app.presentation.dashboard

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Приёмка Задачи 20 по главному экрану и профилю.
 *
 * Compose UI-тестов в модуле нет (см. DashboardViewModelTest: androidx.compose.
 * ui.test в зависимостях отсутствует, и тащить его ради этой задачи — отдельное
 * решение, а не побочный эффект). Поэтому утверждения о составе экрана
 * проверяются по исходнику: это слабее клика по кнопке, но сильнее, чем ничего,
 * и ловит ровно то, ради чего задача заведена, — возврат выдуманных данных и
 * подмену обычного дашборда экраном-заглушкой.
 *
 * Читается ИСХОДНИК, а не ресурсы: демо-данные были вписаны прямо в разметку.
 */
class DashboardSurfaceTest {

    private val dashboard = File("src/main/java/ru/cmpas/app/presentation/dashboard/DashboardScreen.kt").readText()
    private val settings = File("src/main/java/ru/cmpas/app/presentation/settings/SettingsScreen.kt").readText()
    private val navHost = File("src/main/java/ru/cmpas/app/presentation/navigation/CompasNavHost.kt").readText()

    /** Текст без строк комментариев: объяснение «здесь было X» — не показ X. */
    private fun code(source: String) = source
        .lines()
        .filterNot { it.trimStart().startsWith("//") || it.trimStart().startsWith("*") || it.trimStart().startsWith("/*") }
        .joinToString("\n")

    // ── §1 Дашборд остаётся дашбордом ──

    @Test
    fun `онбординг и внимание — дополнения, а не подмена экрана`() {
        val body = code(dashboard)
        // Ни одной ранней остановки отрисовки по признаку онбординга или
        // списка задач: иначе обычный дашборд подменялся бы заглушкой.
        assertFalse(body.contains(Regex("""if \(uiState\.needsOnboarding\)[^{]*\{\s*return""")))
        assertFalse(body.contains(Regex("""if \(uiState\.attentionItems[^)]*\)[^{]*\{\s*return""")))
        // Онбординг — обычный элемент того же списка.
        assertTrue(body.contains("if (uiState.needsOnboarding)"))
        assertTrue(body.contains("OnboardingBridgeCard"))
    }

    @Test
    fun `ядро дашборда на экране всегда`() {
        val body = code(dashboard)
        assertTrue("приветствие", body.contains("Добрый день"))
        assertTrue("дата", body.contains("uiState.todayFormatted"))
        assertTrue("герой следующей сессии", body.contains("HeroNextSession"))
        assertTrue("расписание дня", body.contains("uiState.todaySessions"))
        assertTrue("раздел расписания", body.contains("SectionTitle(\"Расписание\""))
    }

    @Test
    fun `показатели дашборда — серверные, а не вписанные`() {
        val body = code(dashboard)
        assertTrue(body.contains("\${uiState.todaySessions.size}"))
        assertTrue(body.contains("\${uiState.weekSessionsCount}"))
        assertTrue(body.contains("\${uiState.newClientsCount}"))
    }

    // ── §2/§3 Быстрые действия и компактный шеринг ──

    @Test
    fun `ряд быстрых действий — Запись, Клиент, Поделиться`() {
        val body = code(dashboard)
        assertTrue(body.contains("QuickAction(Icons.Outlined.EventAvailable, \"Запись\""))
        assertTrue(body.contains("QuickAction(Icons.Outlined.PersonAdd, \"Клиент\""))
        assertTrue(body.contains("QuickAction(Icons.Outlined.Share, \"Поделиться\""))
    }

    @Test
    fun `Запись и Клиент ведут в существующие экраны создания`() {
        val body = code(dashboard)
        assertTrue(body.contains("onCreateSession = onCreateSession"))
        assertTrue(body.contains("onCreateClient = onCreateClient"))

        // Навигация — на те же адреса, что у календаря и списка клиентов.
        val nav = code(navHost)
        assertTrue(nav.contains("onCreateSession = { navController.navigate(Screen.QuickAction.createRoute(\"new-session\")) }"))
        assertTrue(nav.contains("onCreateClient = { navController.navigate(Screen.QuickAction.createRoute(\"new-client\")) }"))
    }

    @Test
    fun `постоянной большой карточки шеринга на главном экране нет`() {
        val body = code(dashboard)
        assertFalse("большая витрина ссылки убрана", body.contains("BookingShareCard"))
        assertFalse("прямого системного шеринга с главного экрана нет", body.contains("shareBookingLink("))
        // Действие осталось: оно открывает ту же единственную шторку.
        assertTrue(body.contains("BookingLinkSheet(uiState.bookingLink"))
    }

    @Test
    fun `Поделиться работает ровно с постоянной ссылкой записи`() {
        val body = code(dashboard)
        assertTrue(body.contains("shareEnabled = uiState.bookingLink != null"))
        // Приглашение в мессенджер — другая сущность и другой поток.
        assertFalse(body.contains("/connect/"))
        assertFalse(body.contains("inviteLink"))
        assertFalse(body.contains("token"))
    }

    // ── §6–§11 Профиль без выдуманных данных ──

    @Test
    fun `в профиле нет придуманных показателей практики`() {
        val body = code(settings)
        assertFalse(body.contains("\"24\""))
        assertFalse(body.contains("\"312\""))
        assertFalse(body.contains("\"4,9\""))
        assertFalse("оценки в продукте нет", body.contains("\"оценка\""))
    }

    @Test
    fun `в профиле нет выдуманной ссылки на оплату и декоративного QR`() {
        val body = code(settings)
        assertFalse(body.contains("cmpas.ru/pay"))
        assertFalse(body.contains("paymentLink"))
        assertFalse("нарисованный QR никуда не вёл", body.contains("QrBox"))
    }

    @Test
    fun `состояние мессенджеров берётся с сервера`() {
        val body = code(settings)
        assertFalse("имя бота экран знать не может", body.contains("CompasProBot"))
        assertTrue(body.contains("uiState.user?.telegramConnected"))
        assertTrue(body.contains("uiState.user?.maxConnected"))
        // Ни одного жёстко проставленного признака подключения.
        assertFalse(body.contains(Regex("""ConnectionRow\([^)]*,\s*(true|false)\)\s*\{""")))
    }

    @Test
    fun `специализация не выдумывается`() {
        val body = code(settings)
        assertFalse(body.contains("схема-терапия"))
        assertTrue("нейтральный запасной вариант", body.contains("\"Профиль специалиста\""))
    }

    @Test
    fun `версия приложения — фактически собранная`() {
        val body = code(settings)
        assertTrue(body.contains("BuildConfig.VERSION_NAME"))
        assertFalse(body.contains(Regex("""Версия 1\.0\.\d""")))
    }

    @Test
    fun `остались только серверные напоминания с настоящей частотой`() {
        val body = code(settings)
        assertTrue(body.contains("\"За 24 часа\""))
        assertTrue(body.contains("\"За 1 час\""))
        assertFalse("такой рассылки на сервере нет", body.contains("За 2 часа"))
        assertFalse("нет серверного поля", body.contains("\"Об оплате\""))
        assertFalse("нет серверного поля", body.contains("\"О документах\""))
    }

    @Test
    fun `тумблеры напоминаний не живут в памяти экрана`() {
        val body = code(settings)
        // Ни одного локального состояния тумблеров: раньше их было четыре, и
        // все они забывались при переустановке.
        assertFalse(body.contains("var dayBefore"))
        assertFalse(body.contains("var twoHoursBefore"))
        assertFalse(body.contains("var paymentReminder"))
        assertFalse(body.contains("var consentReminder"))
        // Переключение идёт через серверное действие.
        assertTrue(body.contains("viewModel.setClientReminder(ReminderKind.DAY_BEFORE"))
        assertTrue(body.contains("viewModel.setClientReminder(ReminderKind.HOUR_BEFORE"))
        // Пока серверное состояние неизвестно, тумблеров нет вовсе.
        assertTrue(body.contains("uiState.reminders?.let"))
    }

    @Test
    fun `подпись подключения не врёт, пока состояние неизвестно`() {
        assertEquals("Подключён", ru.cmpas.app.presentation.settings.connectionSubtitle(true))
        assertEquals("Не подключён", ru.cmpas.app.presentation.settings.connectionSubtitle(false))
        assertEquals("Проверяем подключение…", ru.cmpas.app.presentation.settings.connectionSubtitle(null))
    }
}
