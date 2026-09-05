package ru.cmpas.app.presentation.calendar

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Приёмка Задачи 22 по составу экрана календаря.
 *
 * Compose UI-тестов в модуле нет (см. DashboardViewModelTest), поэтому
 * утверждения о составе экрана проверяются по исходнику — слабее клика, но
 * сильнее, чем ничего, и ловит ровно то, ради чего задача заведена: мёртвую
 * кнопку и подмену существующих режимов календаря.
 *
 * Список действий шторки проверяется не по тексту исходника, а по самому
 * перечислению CalendarTuneAction: оно и есть контракт — что в нём есть, то
 * шторка и рисует.
 */
class CalendarSurfaceTest {

    private val screen = File("src/main/java/ru/cmpas/app/presentation/calendar/CalendarScreen.kt").readText()
    private val sheet = File("src/main/java/ru/cmpas/app/presentation/calendar/CalendarTuneSheet.kt").readText()
    private val navHost = File("src/main/java/ru/cmpas/app/presentation/navigation/CompasNavHost.kt").readText()

    /** Текст без строк комментариев: объяснение «здесь было X» — не показ X. */
    private fun code(source: String) = source
        .lines()
        .filterNot { it.trimStart().startsWith("//") || it.trimStart().startsWith("*") || it.trimStart().startsWith("/*") }
        .joinToString("\n")

    // ── §1 Мёртвой кнопки больше нет ──

    @Test
    fun `у кнопки настроек больше нет пустого обработчика`() {
        val body = code(screen)
        assertFalse("заглушки не осталось", body.contains("TODO filters"))
        assertFalse("пустой обработчик", body.contains(Regex("""Icons\.Outlined\.Tune[^)]*onClick = \{\s*\}""")))
        assertTrue("кнопка открывает шторку", body.contains("onClick = { tuneOpen = true }"))
        assertTrue(body.contains("CalendarTuneSheet("))
    }

    // ── §2 Шторка: ровно четыре настоящих действия ──

    @Test
    fun `в шторке ровно четыре пункта и все они названы`() {
        assertEquals(
            listOf("Рабочее время", "Кабинеты", "Заблокировать время", "Синхронизация календарей"),
            CalendarTuneAction.entries.map { it.title },
        )
    }

    @Test
    fun `каждый пункт шторки разобран — декоративных нет`() {
        val body = code(screen)
        // Разбор без ветки else: добавится пятый пункт — экран не соберётся,
        // а не покажет молча ничего не делающую строку.
        for (action in CalendarTuneAction.entries) {
            assertTrue("нет обработчика для ${action.name}", body.contains("CalendarTuneAction.${action.name} ->"))
        }
        assertFalse("разбор без общей ветки", code(screen).contains(Regex("""CalendarTuneAction[\s\S]{0,400}?else ->""")))
    }

    @Test
    fun `Рабочее время и Кабинеты ведут в уже существующие экраны`() {
        val body = code(screen)
        assertTrue(body.contains("CalendarTuneAction.WORKING_HOURS -> onWorkingHoursClick()"))
        assertTrue(body.contains("CalendarTuneAction.CABINETS -> onAddressesClick()"))

        val nav = code(navHost)
        assertTrue("расписание — существующий Screen.Schedule", nav.contains("onWorkingHoursClick = { navController.navigate(Screen.Schedule.route) }"))
        assertTrue("кабинеты — существующий Screen.Addresses", nav.contains("onAddressesClick = { navController.navigate(Screen.Addresses.route) }"))
    }

    @Test
    fun `синхронизация открывает настоящую веб-настройку, а не нарисованный экран`() {
        assertEquals("https://cmpas.ru/diary/integrations", CALENDAR_SYNC_URL)
        assertTrue(code(screen).contains("uriHandler.openUri(CALENDAR_SYNC_URL)"))
        // Нативного экрана синхронизации не появилось.
        assertFalse(code(sheet).contains("SyncScreen"))
    }

    // ── §3/§6 Форма блокировки ──

    @Test
    fun `в форме есть дата, время и необязательная причина`() {
        val body = code(sheet)
        assertTrue(body.contains("DateChip(\"Сегодня\""))
        assertTrue(body.contains("DateChip(\"Завтра\""))
        assertTrue("выбор конкретной даты", body.contains("showPicker = true"))
        assertTrue(body.contains("TimeInput(\"Начало\""))
        assertTrue(body.contains("TimeInput(\"Конец\""))
        assertTrue(body.contains("Text(\"Причина\")"))
        assertTrue("причина необязательна", body.contains("Необязательно"))
    }

    @Test
    fun `форма закрывается только по подтверждению сервера`() {
        val body = code(screen)
        assertTrue(body.contains("LaunchedEffect(uiState.blockSaved)"))
        assertTrue(body.contains("blockOpen = false"))
        // Кнопка «Заблокировать» шторку не закрывает — этим занимается
        // подтверждение сервера, иначе форма пропала бы вместе с данными.
        assertFalse(body.contains(Regex("""onSave = \{[^}]*blockOpen = false""")))
    }

    // ── §9 Существующие режимы календаря целы ──

    @Test
    fun `День, Неделя, Месяц и Список на месте`() {
        val body = code(screen)
        assertTrue(body.contains("listOf(\"День\", \"Неделя\", \"Месяц\", \"Список\")"))
        assertEquals(
            listOf("DAY", "WEEK", "MONTH", "LIST"),
            CalendarViewMode.entries.map { it.name },
        )
        assertTrue("сетка месяца осталась", body.contains("MonthGrid("))
        assertTrue("список остался", body.contains("CalendarViewMode.LIST"))
    }
}
