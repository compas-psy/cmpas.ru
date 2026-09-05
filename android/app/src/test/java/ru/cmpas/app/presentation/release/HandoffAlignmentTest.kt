package ru.cmpas.app.presentation.release

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Задача 27: сверка Android-поверхностей с утверждённым дизайн-хендоффом
 * (кадры A01–A17, «ПРАКТИКА - Android.dc.html»).
 *
 * Проверяется ровно то, что хендофф называет изменяемым, и ничего сверх:
 * существующие функции сохраняются, даже если их нет на демонстрационном
 * кадре (правило из 00_ЧИТАТЬ_ПЕРВЫМ.md).
 *
 * Как и DeadPathsTest, это сторож по исходнику: Compose UI-тестов в модуле
 * нет. Он слабее клика по кнопке, но переживает переименование ровно
 * настолько, насколько переживает названную строку, — и первый же прогон
 * Задачи 27 показал, чем кончается сторож, которого никто не запускает.
 */
class HandoffAlignmentTest {

    private fun source(path: String) = File("src/main/java/ru/cmpas/app/$path").readText()

    @Test
    fun `A04 — разделы профиля названы, а не идут сплошным списком`() {
        val settings = source("presentation/settings/SettingsScreen.kt")
        assertTrue("группа практики подписана", settings.contains("SectionTitle(\"Практика\")"))
        assertTrue("группа мессенджеров подписана", settings.contains("SectionTitle(\"Мессенджеры и данные\")"))
        assertTrue("группа аналитики подписана", settings.contains("SectionTitle(\"Аналитика\")"))
    }

    @Test
    fun `A07 — третья фишка даты называет выбор, а не заголовок`() {
        val sheet = source("presentation/calendar/CalendarTuneSheet.kt")
        assertTrue(sheet.contains("\"Другая дата\""))
    }

    @Test
    fun `A13 — у строки внимания есть глагол действия, а не одна стрелка`() {
        val sheet = source("presentation/notifications/NotificationCenterSheet.kt")
        assertTrue("глагол берётся из той же цели, что и тап", sheet.contains("attentionActionLabel(target)"))
        assertTrue(sheet.contains("AttentionTarget.WriteNote -> \"Добавить\""))
        assertTrue(sheet.contains("AttentionTarget.RequestConsent -> \"Отправить\""))
    }

    @Test
    fun `A15 — карточка клиента не показывает того, чего в продукте нет`() {
        val screen = source("presentation/clients/ClientDetailScreen.kt")
        // «Д/з» всегда говорил «В порядке»: homeworkStatus не приходит с
        // сервера ни в одном ответе, а в модели он константа. Домашних
        // заданий в продукте нет — это Горизонт 2.
        assertFalse("показателя домашних заданий нет", screen.contains("\"Д/з\""))
        // Сверяется само чтение, а не слово: объяснение «здесь было X» в
        // комментарии — это не показ X.
        assertFalse("и статус, которого никто не присылает, не читается", screen.contains("session?.homeworkStatus"))
        // Два оставшихся показателя настоящие: оба считаются по данным.
        assertTrue(screen.contains("\"Согласие\""))
        assertTrue(screen.contains("\"Оплата\""))
    }

    @Test
    fun `A15 — приглашение отличимо от постоянной ссылки записи`() {
        val sheets = source("presentation/comms/CommunicationSheets.kt")
        assertTrue(
            "шторка приглашения прямо говорит, что это не ссылка записи",
            sheets.contains("не постоянная ссылка для записи"),
        )
        // Срок берётся у сервера (channel-binding.ts, 72 часа), а не из
        // прототипа, где нарисовано «7 дней».
        assertTrue(sheets.contains("Ссылка действует 72 часа"))
    }
}
