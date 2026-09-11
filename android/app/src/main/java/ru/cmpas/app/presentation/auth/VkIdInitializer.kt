package ru.cmpas.app.presentation.auth

import android.content.Context
import android.util.Log
import com.vk.id.VKID
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Однократное заведение SDK ВК.
 *
 * `VKID.init` в релизной сборке бросает на повторном вызове
 * («You've already initialized VKID»), а экран входа пересобирается сколько
 * угодно раз: поворот телефона, возврат с другого экрана, новый ответ
 * сервера о способах входа. Поэтому заведение — здесь, один раз на процесс.
 *
 * Инициализация вынесена из Application намеренно. SDK читает идентификатор
 * и ключ из мета-данных манифеста и на негодных значениях бросает; в
 * Application.onCreate это означало бы, что приложение не запускается ВООБЩЕ
 * из-за неверно заполненного секрета ВК. Здесь худший исход — кнопки ВК нет,
 * а прежние способы входа работают.
 */
object VkIdInitializer {

    private val started = AtomicBoolean(false)

    @Volatile
    private var ready: Boolean = false

    /**
     * @return удалось ли завести SDK. Нет — кнопку ВК показывать нельзя.
     */
    fun ensureInitialized(context: Context): Boolean {
        if (started.compareAndSet(false, true)) {
            ready = runCatching { VKID.init(context) }
                .onFailure {
                    // Причина — в журнале разработчика, не на экране: человеку
                    // в этот момент нужна работающая дверь, а не наш диагноз.
                    // Ни идентификатора, ни ключа в сообщении нет.
                    Log.w(TAG, "VK ID SDK не завёлся: ${it.javaClass.simpleName}")
                }
                .isSuccess
        }
        return ready
    }

    private const val TAG = "VkIdInitializer"
}
