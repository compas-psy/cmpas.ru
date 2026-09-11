package ru.cmpas.app.presentation.release

import org.junit.Assert.assertFalse
import org.junit.Assert.assertEquals
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
    fun `A04 — разделы профиля названы и идут в утверждённом порядке`() {
        // Порядок разделов — решение учредителя от 11.09.2026: Практика,
        // Мессенджеры, Уведомления, Аналитика. Раньше проверялось только
        // НАЛИЧИЕ подписей, и настройки редкого случая спокойно стояли выше
        // ежедневных дел.
        //
        // «Мессенджеры и данные» стали просто «Мессенджерами»: данные и
        // конфиденциальность живут в разделе «Практика», и держать слово
        // «данные» в заголовке про каналы связи значило обещать не то.
        val settings = source("presentation/settings/SettingsScreen.kt")
        val order = listOf("Практика", "Мессенджеры", "Уведомления", "Аналитика")
            .map { title ->
                val at = settings.indexOf("SectionTitle(\"" + title + "\")")
                assertTrue("группа «" + title + "» подписана", at >= 0)
                at
            }
        assertEquals("разделы идут в утверждённом порядке", order.sorted(), order)
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

    @Test
    fun `A08 — подписи кнопок кабинета не обрезаются половиной ширины`() {
        val addresses = source("presentation/settings/AddressesScreen.kt")
        // Обе подписи длинные. Пока каждая кнопка занимала половину ряда,
        // «Редактировать» показывалось как «Редактиров», а «Сделать
        // основным» — как «Сделать», то есть переставало называть действие.
        assertFalse(
            "кнопка правки во всю ширину, а не в половину ряда",
            addresses.contains(Regex("""text = "Редактировать",\s*onClick = onEdit,\s*modifier = Modifier\.weight""")),
        )
        assertFalse(
            "кнопка «сделать основным» во всю ширину",
            addresses.contains(Regex("""text = "Сделать основным",\s*onClick = onMakePrimary,\s*modifier = Modifier\.weight""")),
        )
        assertTrue(addresses.contains(Regex("""text = "Редактировать",\s*onClick = onEdit,\s*modifier = Modifier\.fillMaxWidth\(\)""")))
        assertTrue(addresses.contains(Regex("""text = "Сделать основным",\s*onClick = onMakePrimary,\s*modifier = Modifier\.fillMaxWidth\(\)""")))
        // И если подпись всё же не поместится — многоточие, а не молчаливый
        // обрез посреди слова.
        val controls = source("presentation/components/CompasControls.kt")
        assertTrue(
            "GhostButton показывает многоточие при нехватке места",
            controls.contains("overflow = TextOverflow.Ellipsis"),
        )
    }
}
