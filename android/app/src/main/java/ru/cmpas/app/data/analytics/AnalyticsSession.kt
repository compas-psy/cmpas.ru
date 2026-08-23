package ru.cmpas.app.data.analytics

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Механика запуска аналитики: когда пишется `app_opened` и когда очередь
 * пытается уехать.
 *
 * Отдельный класс, а не пара строк в ViewModel, по двум причинам.
 *
 * Первая: `app_opened` обязано стрелять один раз за запуск ПРОЦЕССА, а не
 * при каждом заходе на экран. ViewModel живёт короче процесса и создаётся
 * заново при каждом возврате на «Рабочий стол» — счётчик, живущий в ней,
 * считал бы навигацию, а не запуски, и первая же цифра на панели была бы
 * неверной. [opened] — @Singleton, его AtomicBoolean живёт ровно столько,
 * сколько процесс.
 *
 * Вторая: согласие берётся с сервера, а не из локального кэша. До первого
 * успешного обращения кэш пуст, и гейт согласия честно отвечает «нет» —
 * значит без обновления состояния приложение не отправило бы ничего даже
 * у человека, который согласие давно дал в вебе.
 *
 * Наружу не выходит ни одно исключение: падение аналитики не роняет
 * приложение (красная линия учредителя).
 */
@Singleton
class AnalyticsSession @Inject constructor(
    @ApplicationContext context: Context,
    private val consent: AnalyticsConsent,
    private val recorder: AnalyticsRecorder,
    private val transport: AnalyticsTransport,
) {
    private val prefs = context.getSharedPreferences("compas_analytics_session", Context.MODE_PRIVATE)
    private val openedThisProcess = AtomicBoolean(false)

    /**
     * Зовётся при заходе на «Рабочий стол». Отработает полностью только на
     * первом заходе за запуск процесса; на последующих — только досылка.
     */
    suspend fun onAppForeground() {
        runCatching { consent.refresh() }

        if (openedThisProcess.compareAndSet(false, true)) {
            runCatching {
                val everOpened = prefs.getBoolean(KEY_EVER_OPENED, false)
                if (!everOpened) prefs.edit().putBoolean(KEY_EVER_OPENED, true).apply()
                recorder.recordAppOpened(firstLaunch = !everOpened)
            }
        }

        runCatching { transport.flush() }
    }

    /**
     * Очередь пытается уехать. Отдельно от [onAppForeground], потому что
     * поводов для попытки больше одного: возврат на экран, ручное обновление,
     * только что выданное согласие.
     */
    suspend fun flush() {
        runCatching { transport.flush() }
    }

    private companion object {
        /** Был ли хоть один запуск раньше — для признака first_launch. */
        const val KEY_EVER_OPENED = "ever_opened"
    }
}
