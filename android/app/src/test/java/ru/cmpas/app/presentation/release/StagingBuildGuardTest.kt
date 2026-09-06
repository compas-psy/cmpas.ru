package ru.cmpas.app.presentation.release

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Задача 28 добавила возможность собрать приложение против одноразового
 * стенда: `-PapiBaseUrl=...`. Возможность полезная и опасная одновременно —
 * если она протечёт в релиз, люди получат приложение, которое ходит не туда,
 * или которому разрешён открытый HTTP.
 *
 * Этот сторож держит обе границы:
 *   1) без внешнего свойства адрес остаётся боевым;
 *   2) разрешение на открытый HTTP живёт только в манифесте debug-варианта.
 */
class StagingBuildGuardTest {

    private val gradle = File("build.gradle.kts").readText()

    @Test
    fun `без внешнего свойства адрес остаётся боевым`() {
        assertTrue(
            "значение по умолчанию — боевой адрес",
            gradle.contains("?: \"https://cmpas.ru/api/mobile/\""),
        )
        assertTrue(
            "адрес приходит из свойства сборки, а не из окружения раннера",
            gradle.contains("project.findProperty(\"apiBaseUrl\")"),
        )
    }

    @Test
    fun `открытый HTTP разрешён только отладочной сборке`() {
        val debugManifest = File("src/debug/AndroidManifest.xml")
        assertTrue("манифест отладки на месте", debugManifest.exists())
        assertTrue(
            "разрешение объявлено именно там",
            debugManifest.readText().contains("android:usesCleartextTraffic=\"true\""),
        )
        val mainManifest = File("src/main/AndroidManifest.xml").readText()
        assertFalse(
            "в основном манифесте открытого HTTP нет",
            mainManifest.contains("usesCleartextTraffic"),
        )
        assertFalse(
            "и сетевой конфигурации, разрешающей его, тоже",
            mainManifest.contains("networkSecurityConfig"),
        )
    }

    @Test
    fun `релизная сборка не переопределяет адрес отдельно`() {
        // Если однажды в release-блоке появится собственный buildConfigField
        // с адресом, он молча разойдётся с defaultConfig — и понять, куда
        // ходит выпущенное приложение, станет можно только сборкой.
        val releaseBlock = gradle.substringAfter("release {").substringBefore("\n        }")
        assertFalse(releaseBlock.contains("API_BASE_URL"))
    }
}
