package ru.cmpas.app.presentation.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Подпись на кнопке влезает целиком — на любом экране.
 *
 * Проверка написана по живому случаю 10.09.2026: учредитель в один день увидел
 * «Запис…» на карточке дня и «Б… Не… Пе…» на экране встречи. До этого ошибку
 * дважды лечили словами и кеглем — и оба раза она возвращалась на следующей
 * подписи. Здесь проверяется третий, настоящий ответ: если в ряд не влезает,
 * кнопка уходит на второй ряд.
 *
 * Ширины взяты не с потолка: 360 точек — обычный телефон, 320 — узкий (такие
 * ещё в ходу), 284 и 218 — то, что остаётся от них внутри карточки после
 * отступов экрана и самой карточки.
 */
class ButtonRowFitTest {

    // ── Оценка ширины ──

    @Test
    fun `иконка и поля занимают больше места, чем сама подпись`() {
        // Это и была причина «Б… Не… Пе…»: место отняли не буквы.
        val withIcon = buttonWidthDp("Была", 15f, compact = false, hasIcon = true)
        val compact = buttonWidthDp("Была", 14f, compact = true, hasIcon = false)
        assertTrue("некомпактная кнопка должна быть заметно шире", withIcon > compact + 30f)
    }

    // ── Ряд из трёх на экране встречи ──

    @Test
    fun `три подписи с иконками не помещаются в узкий экран`() {
        // Ровно то, что учредитель увидел как «Б… Не… Пе…».
        val labels = listOf("Была", "Не пришли", "Перенесли")
        assertFalse(buttonsFitInRow(labels, availableDp = 284f, fontSizeSp = 15f, compact = false, hasIcon = true))
    }

    @Test
    fun `без иконок три подписи всё равно не помещаются в узкий экран`() {
        // Снятия иконок мало: место делится на троих, и «Не пришли» не влезает
        // и так. Поэтому компактный вид — только половина ответа.
        val labels = listOf("Была", "Не пришли", "Перенесли")
        assertFalse(buttonsFitInRow(labels, availableDp = 284f, fontSizeSp = 14f, compact = true, hasIcon = false))
    }

    @Test
    fun `на узком экране «Перенесли» уезжает вниз, а не обрезается`() {
        val labels = listOf("Была", "Не пришли", "Перенесли")
        val rows = packButtonRows(labels, availableDp = 284f, fontSizeSp = 14f, compact = true, hasIcon = false)

        assertEquals("две первые кнопки остаются рядом, третья уходит вниз", listOf(listOf(0, 1), listOf(2)), rows)
        // Каждый получившийся ряд обязан помещаться — иначе перенос бесполезен.
        for (row in rows) {
            assertTrue(
                "ряд $row не помещается",
                buttonsFitInRow(row.map { labels[it] }, 284f, 14f, compact = true, hasIcon = false),
            )
        }
    }

    @Test
    fun `на широком экране все три остаются в одном ряду`() {
        val labels = listOf("Была", "Не пришли", "Перенесли")
        val rows = packButtonRows(labels, availableDp = 340f, fontSizeSp = 14f, compact = true, hasIcon = false)
        assertEquals(listOf(listOf(0, 1, 2)), rows)
    }

    @Test
    fun `порядок ответов не меняется ради плотности`() {
        // «Была» и «Не пришли» — разные ответы на один вопрос, и первый из них
        // главный. Переставить их местами значило бы сменить смысл экрана.
        val labels = listOf("Была", "Не пришли", "Перенесли")
        val order = packButtonRows(labels, 284f, 14f, compact = true, hasIcon = false).flatten()
        assertEquals(listOf(0, 1, 2), order)
    }

    // ── Ряд из двух на карточке дня ──

    @Test
    fun `«Записать снова» не помещалось в карточку ни при каком кегле`() {
        // Ровно то, что учредитель увидел как «Запис…». Проверка держит
        // причину, по которой подпись стала одним словом.
        assertFalse(buttonsFitInRow(listOf("Заметка", "Записать снова"), 218f, 14f, compact = true, hasIcon = false))
    }

    @Test
    fun `«Записать» помещается рядом с «Заметкой»`() {
        assertTrue(buttonsFitInRow(listOf("Заметка", "Записать"), 218f, 14f, compact = true, hasIcon = false))
    }

    @Test
    fun `«Была» и «Не пришли» помещаются в карточку дня`() {
        assertTrue(buttonsFitInRow(listOf("Была", "Не пришли"), 218f, 14f, compact = true, hasIcon = false))
    }

    // ── Крайние случаи ──

    @Test
    fun `одна кнопка на ряд — последнее средство, но ряд всё равно отдаётся`() {
        // Если подпись не помещается даже в одиночку, кнопку всё равно надо
        // показать: дальше сработает уменьшение шрифта. Не показать кнопку
        // вовсе — хуже, чем показать её мелко.
        val rows = packButtonRows(listOf("Очень длинная подпись на кнопке"), 100f, 15f, compact = false, hasIcon = true)
        assertEquals(listOf(listOf(0)), rows)
    }

    @Test
    fun `пустой набор не даёт пустого ряда`() {
        assertEquals(emptyList<List<Int>>(), packButtonRows(emptyList(), 300f, 14f, compact = true, hasIcon = false))
    }

    // ── Экраны действительно пользуются этим рядом ──

    private fun source(path: String) = File("src/main/java/ru/cmpas/app/presentation/$path").readText()

    @Test
    fun `тесные ряды собраны FittingActionRow, а не вручную`() {
        // Смысл проверки — не в стиле. Ряд, собранный вручную, снова обрежет
        // подпись, и узнаем мы об этом от человека, а не от сборки.
        for (path in listOf(
            "dashboard/DashboardScreen.kt",
            "session/SessionDetailScreen.kt",
            "clients/ClientDetailScreen.kt",
        )) {
            assertTrue("$path должен собирать ряды через FittingActionRow", source(path).contains("FittingActionRow("))
        }
    }

    @Test
    fun `подпись «Записать снова» на карточке дня больше не встречается`() {
        assertFalse(source("dashboard/DashboardScreen.kt").contains("\"Записать снова\""))
    }

    // ── Ряд не ломает внутренние размеры ──

    /** Текст без комментариев: объяснение «здесь нет X» — не использование X. */
    private fun code(source: String) = source
        .lines()
        .filterNot { it.trimStart().startsWith("//") || it.trimStart().startsWith("*") || it.trimStart().startsWith("/*") }
        .joinToString("\n")

    @Test
    fun `ряд не построен на SubcomposeLayout`() {
        // ЖИВОЙ СЛУЧАЙ, 10.09.2026. Версия 1.2.0 не запускалась вовсе:
        // приложение открывалось пустым и падало, как только приходили данные
        // и рисовалась первая карточка встречи.
        //
        // Первая редакция ряда брала ширину через BoxWithConstraints, а он
        // построен на SubcomposeLayout — тот при запросе ВНУТРЕННИХ размеров
        // бросает исключение. Карточка встречи лежит внутри
        // Row(Modifier.height(IntrinsicSize.Min)), то есть её высоту как раз
        // спрашивают. Спросили — упало.
        //
        // Проверка держит причину, а не приём: пока ряда нет на
        // SubcomposeLayout, этот отказ вернуться не может.
        val row = code(source("components/ActionRow.kt"))

        assertFalse("BoxWithConstraints не поддерживает внутренние размеры", row.contains("BoxWithConstraints"))
        assertFalse(row.contains("SubcomposeLayout"))
        assertTrue("ширина берётся обычным обмером", row.contains("onSizeChanged"))
    }

    @Test
    fun `карточка дня по-прежнему просит внутренние размеры`() {
        // Половина причины живёт здесь: если этот Row однажды перестанет
        // спрашивать высоту, проверка выше потеряет смысл — и об этом надо
        // узнать, а не тихо ослабить защиту.
        assertTrue(
            "полоса времени и нить тянутся по высоте карточки",
            code(source("dashboard/DashboardScreen.kt")).contains("height(IntrinsicSize.Min)"),
        )
    }
}
