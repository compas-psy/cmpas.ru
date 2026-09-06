package ru.cmpas.app.presentation.release

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Задача 27: три пути, которые вели в никуда.
 *
 * Все три выглядели рабочими: кнопка была, тап срабатывал, сообщение
 * уходило. Ломалось то, что после этого — экран несуществующей сессии,
 * заметка к встрече, которой нет, ссылка на страницу, которой нет в вебе.
 * Такие поломки не ловятся компиляцией и не видны на скриншоте, поэтому
 * зафиксированы здесь по исходникам — тем же приёмом, что и в Задачах 20–24.
 */
class DeadPathsTest {

    private fun source(path: String): String {
        val file = File("src/main/java/ru/cmpas/app/$path")
        assertTrue("нет файла $path", file.exists())
        return file.readText()
    }

    @Test
    fun `блок в календаре не открывается как сессия`() {
        val screen = source("presentation/calendar/CalendarScreen.kt")
        // Строка блока больше не получает обработчик нажатия.
        assertTrue(
            "тап по блоку должен быть отключён по префиксу идентификатора",
            screen.contains("CalendarViewModel.BLOCK_ID_PREFIX"),
        )
        assertTrue(
            "у блока не должно быть обработчика нажатия",
            screen.contains("onClick = if (isBlock) null"),
        )
        // И шеврон, обещающий переход, тоже только у настоящих встреч.
        assertTrue(
            "шеврон показывается только там, где есть куда перейти",
            screen.contains("if (onClick != null) Icon(Icons.Outlined.ChevronRight"),
        )
    }

    @Test
    fun `префикс блока объявлен один раз и используется обеими сторонами`() {
        val viewModel = source("presentation/calendar/CalendarViewModel.kt")
        assertTrue("префикс должен быть константой", viewModel.contains("const val BLOCK_ID_PREFIX = \"block-\""))
        assertFalse("идентификатор блока не собирается строкой на месте", viewModel.contains("id = \"block-\$id\""))
    }

    @Test
    fun `заметку нельзя добавить к клиенту без встреч`() {
        val screen = source("presentation/clients/ClientDetailScreen.kt")
        assertFalse(
            "идентификатор сессии не подделывается из идентификатора клиента",
            screen.contains("\"client-\$clientId\""),
        )
        assertTrue(
            "кнопка появляется только при существующей встрече",
            screen.contains("if (noteTarget != null) item {"),
        )
    }

    @Test
    fun `быстрое действие не собирает ссылку на документ само`() {
        val sheet = source("presentation/actions/NewActionSheet.kt")
        assertFalse("маршрута /d в вебе нет — ссылку собирать нельзя", sheet.contains("cmpas.ru/d/"))
        assertFalse("вторая шторка отправки документа не нужна", sheet.contains("SendDocumentSheet("))
        assertTrue(
            "быстрое действие ведёт в карточку клиента, где отправка настоящая",
            sheet.contains("onClientDocument(client.id)"),
        )
    }

    @Test
    fun `карточка клиента умеет открыться сразу на отправке документа`() {
        val routes = source("presentation/navigation/Routes.kt")
        assertTrue("нужен фокус DOCUMENT", routes.contains("DOCUMENT(\"document\")"))
        val detail = source("presentation/clients/ClientDetailScreen.kt")
        assertTrue(
            "фокус DOCUMENT открывает ту же шторку, что и CONSENT",
            detail.contains("focus == ScreenFocus.CONSENT || focus == ScreenFocus.DOCUMENT"),
        )
        val host = source("presentation/navigation/CompasNavHost.kt")
        assertTrue(
            "переход должен нести фокус",
            host.contains("Screen.ClientDetail.createRoute(id, ScreenFocus.DOCUMENT)"),
        )
    }

    @Test
    fun `во всём экранном слое не осталось ссылок на несуществующий маршрут`() {
        val root = File("src/main/java/ru/cmpas/app/presentation")
        val offenders = root.walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .filter { it.readText().contains("cmpas.ru/d/") }
            .map { it.name }
            .toList()
        assertTrue("битая ссылка на документ осталась в: $offenders", offenders.isEmpty())
    }
}
