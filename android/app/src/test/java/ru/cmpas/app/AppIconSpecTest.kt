package ru.cmpas.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * ИКОНКА ПРИЛОЖЕНИЯ ПО СПЕЦИФИКАЦИИ СИМПАСа.
 *
 * Знак дерева один на все девять сервисов семейства, поэтому единственное,
 * что может разъехаться, — крупность дерева внутри плитки. И она разъехалась:
 * до 14.09.2026 здесь стоял `scale 0.20013` — дерево высотой ~62 dp, то есть
 * 0,86 от видимой зоны вместо 0,60. Рядом с иконками других сервисов наша
 * распирала плитку до краёв: на домашнем экране это выглядит как приложения
 * разных компаний.
 *
 * Причина — классическая и названная в самой спецификации: крупность считали
 * от холста 108 dp, а маска лаунчера показывает центральные 72 dp.
 *
 * Числа здесь не «подобраны красиво», а взяты из ICON-SPEC:
 *   высота дерева = 0,60 × 72 = 43,2 dp
 *   scale к исходному пути 500×500 = 0,139355
 *   центр 54 · 54, отсюда translate = 54 − 250 × scale = 19,16125
 *
 * Тест сравнивает не картинку, а ровно эти числа: картинку человек не
 * заметит, а число в diff видно сразу.
 */
class AppIconSpecTest {

    private val foreground = File("src/main/res/drawable/ic_launcher_foreground.xml").readText()
    private val monochrome = File("src/main/res/drawable/ic_launcher_monochrome.xml").readText()
    private val colors = File("src/main/res/values/colors.xml").readText()

    private fun attr(xml: String, name: String): String =
        Regex("""android:$name="([^"]+)"""").find(xml)?.groupValues?.get(1)
            ?: error("в слое нет $name")

    @Test
    fun `дерево занимает ровно 0,60 видимой зоны`() {
        // Видимая зона — центральные 72 dp из холста 108. Считать от 108 и
        // есть та самая ошибка, из-за которой иконка выходит на треть крупнее.
        val scale = attr(foreground, "scaleX").toDouble()
        val treeHeightDp = 310.0 * scale // высота bbox знака в исходном viewBox
        val ratio = treeHeightDp / 72.0
        assertEquals("крупность дерева от видимой зоны 72 dp", 0.60, ratio, 0.02)
    }

    @Test
    fun `передний и монохромный слои одной крупности`() {
        // Разъехавшись, они дадут разный силуэт в обычной и тематической иконке.
        assertEquals(attr(foreground, "scaleX"), attr(monochrome, "scaleX"))
        assertEquals(attr(foreground, "translateX"), attr(monochrome, "translateX"))
    }

    @Test
    fun `дерево по центру плитки`() {
        // Спецификация запрещает оптическую подгонку: центр bbox знака уже
        // совпадает с центром viewBox. Раньше по горизонтали стоял сдвиг
        // 3.931477 против 3.9675 по вертикали — знак был смещён.
        val scale = attr(foreground, "scaleX").toDouble()
        val expected = 54.0 - 250.0 * scale
        assertEquals(expected, attr(foreground, "translateX").toDouble(), 0.001)
        assertEquals(expected, attr(foreground, "translateY").toDouble(), 0.001)
        assertEquals(attr(foreground, "scaleX"), attr(foreground, "scaleY"))
    }

    @Test
    fun `дерево не выходит за безопасный круг 66 dp`() {
        val scale = attr(foreground, "scaleX").toDouble()
        assertTrue("высота", 310.0 * scale <= 66.0)
        assertTrue("ширина", 290.0 * scale <= 66.0)
    }

    @Test
    fun `пара цветов — ПРАКТИКА, посимвольно`() {
        assertTrue("фон сервиса", colors.contains("<color name=\"ic_launcher_background\">#1D4735</color>"))
        assertTrue("дерево", foreground.contains("android:fillColor=\"#F7F8F4\""))
        // Монохром — маска: система перекрашивает его сама, полутонов быть не должно.
        assertTrue("монохром сплошной чёрный", monochrome.contains("android:fillColor=\"#000000\""))
    }

    @Test
    fun `слои не скругляют углы и не заливают фон сами`() {
        // Маску даёт лаунчер; своё скругление поверх системного — двойной контур.
        listOf(foreground, monochrome).forEach { layer ->
            assertFalse("в слое появился собственный фон", layer.contains("<rect"))
        }
    }
}
