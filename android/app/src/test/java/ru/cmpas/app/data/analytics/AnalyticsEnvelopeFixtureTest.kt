package ru.cmpas.app.data.analytics

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.cmpas.app.data.api.AnalyticsEventEnvelope
import java.io.File

/**
 * Выкладывает НАСТОЯЩИЙ конверт, собранный настоящим AnalyticsRecorder — тем
 * самым кодом, который зовут экраны приложения.
 *
 * Зачем это существует. В репозитории уже был стыковочный тест приёмника, и он
 * сам про себя честно писал, что фикстура МОМЕНТОВ «ВЫВЕДЕНА ЧТЕНИЕМ» кода
 * Kotlin, потому что Gradle в той среде не поднимался. Такая фикстура проверяет
 * представление автора о собственном коде, а не сам код: обе стороны могут
 * ошибаться одинаково и не заметить этого никогда.
 *
 * Здесь Gradle есть — значит фикстуру надо не писать руками, а получать
 * запуском. Файл, который пишет этот тест, в CI прогоняется через НАСТОЯЩИЙ
 * маршрут POST /api/mobile/analytics и НАСТОЯЩИЙ валидатор приёмника из этого
 * же репозитория (tests/android-envelope-contract.test.ts).
 *
 * Тест не проверяет конверт сам — он его ПРОИЗВОДИТ. Проверяет другая сторона.
 * Единственное, что здесь утверждается, — что файл непуст и содержит все семь
 * событий: иначе стык проверялся бы на пустом месте и выглядел бы зелёным.
 */
class AnalyticsEnvelopeFixtureTest {

    private val json = Json { prettyPrint = true; encodeDefaults = true }

    @Test
    fun `выложить конверты всех семи событий для проверки приёмником`() = runBlocking {
        val produced = mutableListOf<AnalyticsEventEnvelope>()
        var counter = 0

        // Настоящий Recorder с настоящей схемой. Подменены только два внешних
        // источника недетерминированности — часы и генератор идентификаторов, —
        // чтобы фикстура была воспроизводимой. Сборка конверта, фильтрация
        // свойств и допустимые значения при этом остаются настоящими.
        val recorder = AnalyticsRecorder(
            isConsentGranted = { true },
            enqueue = { produced += it },
            eventId = { "00000000-0000-4000-8000-%012d".format(++counter) },
            now = { java.time.Instant.parse("2026-08-23T10:00:00Z") },
        )

        recorder.recordAppOpened(firstLaunch = true)
        recorder.recordSessionCreated(
            delivered = true,
            repeatBatch = false,
            daysAheadBucket = DaysAheadBucket.WITHIN_WEEK,
        )
        recorder.recordSessionStatusChanged(to = SessionStatusTarget.COMPLETED, delivered = true)
        recorder.recordSessionNoteSaved(
            delivered = true,
            mode = NoteMode.BLOCKS,
            blocksFilled = 3,
            sinceSessionBucket = SinceSessionBucket.SAME_DAY,
        )
        recorder.recordSessionNoteAbandoned(hadInput = true)
        recorder.recordClientCreated(delivered = false)
        recorder.recordClientInviteCreated(channel = InviteChannel.TELEGRAM, delivered = true)

        assertEquals("не все семь событий собрались", 7, produced.size)

        val payload = json.encodeToString(
            kotlinx.serialization.builtins.ListSerializer(AnalyticsEventEnvelope.serializer()),
            produced,
        )

        // Страховка: конверт не имеет права нести поля, которые подставляет
        // сервер, — иначе клиент мог бы объявить себя чужим аккаунтом.
        assertTrue("конверт несёт account_id", !payload.contains("account_id"))
        assertTrue("конверт несёт device_id", !payload.contains("device_id"))
        assertTrue("конверт несёт product", !payload.contains("\"product\""))

        val out = File("build/analytics-fixture/practice-android-envelopes.json")
        out.parentFile?.mkdirs()
        out.writeText(payload)
    }
}
