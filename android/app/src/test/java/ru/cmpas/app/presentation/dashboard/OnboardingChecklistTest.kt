package ru.cmpas.app.presentation.dashboard

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.cmpas.app.domain.model.PracticeOnboardingSteps
import java.io.File

/**
 * Приёмка Задачи 24 по чек-листу настройки в приложении.
 *
 * Раньше здесь были три нарисованные плашки «Клиент · Расписание ·
 * Мессенджер»: они не зависели ни от чего, не нажимались и не менялись —
 * настроенная практика видела ровно то же, что пустая. Теперь шаги приходят с
 * сервера, те же четыре, что в вебе, и «мессенджера» среди них нет: он не
 * входит в четыре продуктовых шага MVP.
 *
 * Второе правило — чек-лист ДОПОЛНЯЕТ дашборд, а не заменяет его. Второй
 * блокирующий экран после legal-гейта продукту не нужен.
 */
class OnboardingChecklistTest {

    private val dashboard = File("src/main/java/ru/cmpas/app/presentation/dashboard/DashboardScreen.kt").readText()
    private val viewModel = File("src/main/java/ru/cmpas/app/presentation/dashboard/DashboardViewModel.kt").readText()
    private val sheet = File("src/main/java/ru/cmpas/app/presentation/components/BookingLinkSheet.kt").readText()

    private fun code(source: String) = source
        .lines()
        .filterNot { it.trimStart().startsWith("//") || it.trimStart().startsWith("*") || it.trimStart().startsWith("/*") }
        .joinToString("\n")

    // ── Четыре шага, те же что в вебе ──

    @Test
    fun `шагов ровно четыре и называются они так же, как в вебе`() {
        assertEquals(
            listOf("Клиенты", "Расписание", "Запись", "Поделиться"),
            OnboardingStep.entries.map { it.title },
        )
    }

    @Test
    fun `мессенджера среди шагов нет`() {
        assertFalse(OnboardingStep.entries.any { it.title.contains("essenger") || it.title.contains("ессендж") })
        assertFalse("нарисованных плашек не осталось", code(dashboard).contains("TinySetupStep"))
        assertFalse(code(dashboard).contains("OnboardingBridgeCard"))
    }

    @Test
    fun `каждый шаг читает своё поле серверного состояния`() {
        val done = PracticeOnboardingSteps(client = true, schedule = false, session = true, share = false)

        assertTrue(OnboardingStep.CLIENT.isDone(done))
        assertFalse(OnboardingStep.SCHEDULE.isDone(done))
        assertTrue(OnboardingStep.SESSION.isDone(done))
        assertFalse(OnboardingStep.SHARE.isDone(done))
    }

    @Test
    fun `состояние приходит с сервера, приложение его не считает`() {
        val body = code(viewModel)
        assertTrue(body.contains("onboarding = data.onboarding"))
        // Ни одного собственного вычисления шагов: приложение только
        // показывает и сообщает о двух действиях человека.
        assertFalse(body.contains(Regex("""steps\s*=\s*PracticeOnboardingSteps\(""")))
        assertTrue(body.contains("sendOnboardingAction(\"shared\")"))
        assertTrue(body.contains("sendOnboardingAction(\"dismiss\")"))
    }

    @Test
    fun `отказ сервера состояние на экране не меняет`() {
        assertTrue(
            "состояние заменяется только успешным ответом",
            code(viewModel).contains("if (body != null) _uiState.update { it.copy(onboarding = body) }"),
        )
    }

    // ── Чек-лист дополняет дашборд ──

    @Test
    fun `ядро дашборда остаётся видимым при любом состоянии онбординга`() {
        val body = code(dashboard)
        // Ни одной ранней остановки отрисовки по онбордингу.
        assertFalse(body.contains(Regex("""onboarding[^\n]*\{\s*return""")))
        assertTrue("герой следующей сессии", body.contains("HeroNextSession"))
        assertTrue("расписание дня", body.contains("uiState.todaySessions"))
        // Чек-лист — обычный элемент того же списка.
        assertTrue(body.contains("OnboardingChecklistCard("))
    }

    @Test
    fun `скрытый или пройденный чек-лист не показывается`() {
        assertTrue(code(dashboard).contains("takeIf { !it.dismissed && !it.completed }"))
    }

    @Test
    fun `пустой практике предлагают перенос, и это настоящий веб-поток импорта`() {
        val body = code(dashboard)
        assertTrue(body.contains("if (onboarding.empty)"))
        assertTrue(body.contains("text = \"Перенести практику\""))
        assertEquals("https://cmpas.ru/diary/clients/import-calendar", PRACTICE_MIGRATION_URL)
        // «С нуля» ничего не отмечает выполненным — это сам чек-лист ниже.
        assertTrue(body.contains("Или начните с нуля"))
    }

    // ── §4/§6 «Поделиться» закрывает только действие ──

    @Test
    fun `шаг Поделиться открывает шторку, а не отмечается сам`() {
        val body = code(dashboard)
        assertTrue(body.contains("OnboardingStep.SHARE -> showBookingSheet = true"))
        // Открытие шторки не зовёт подтверждение — его зовёт сама шторка,
        // и только с состоявшегося действия.
        assertFalse(body.contains(Regex("""SHARE ->[^\n]*confirmBookingLinkShared""")))
        assertTrue(body.contains("onShared = viewModel::confirmBookingLinkShared"))
    }

    @Test
    fun `в шторке отмечаются копирование и принятый системой шеринг`() {
        val body = code(sheet)
        assertTrue("копирование", body.contains("copied = true\n                    onShared()"))
        assertTrue("системный шеринг только при успехе", body.contains("if (shareBookingLink(context, bookingLink)) onShared()"))
        assertTrue("неудачный запуск не считается", body.contains(".isSuccess"))
        // QR рисуется сразу при открытии — по нему не отличить «показал
        // клиенту» от «заглянул и закрыл», поэтому шагом он здесь не служит.
        val qrBlock = body.substringAfter("QrCodeImage(content = bookingLink)").substringBefore("GlassCard(")
        assertFalse(qrBlock.contains("onShared()"))
    }
}
