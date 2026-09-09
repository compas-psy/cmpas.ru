package ru.cmpas.app

import android.app.Application
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.disk.DiskCache
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.crossfade
import dagger.hilt.android.HiltAndroidApp
import okhttp3.OkHttpClient
import okio.Path.Companion.toOkioPath
import javax.inject.Inject

@HiltAndroidApp
class CompasApplication : Application(), SingletonImageLoader.Factory {

    /**
     * Тот же клиент, которым ходит всё остальное приложение.
     *
     * Это не удобство, а необходимость: аватарка клиента лежит за
     * /api/clients/<id>/avatar, а маршрут отвечает только тому, кто предъявил
     * токен. Свой клиент у Coil означал бы запрос без заголовка авторизации,
     * то есть 401 и пустой кружок вместо фотографии.
     *
     * Заодно наследуется обновление протухшего токена: перехватчик один и
     * тот же, и повторять его логику для картинок не приходится.
     */
    @Inject
    lateinit var okHttpClient: OkHttpClient

    override fun newImageLoader(context: PlatformContext): ImageLoader =
        ImageLoader.Builder(context)
            .components { add(OkHttpNetworkFetcherFactory(callFactory = { okHttpClient })) }
            // Кэш на диске телефона: аватарка одного и того же клиента не
            // должна тянуться из сети каждый раз, когда открыли список.
            // Каждый такой запрос — это поход НАШЕГО сервера в мессенджер, а
            // у Telegram предел общий на бота, тот же, которым уходят
            // уведомления.
            .diskCache {
                DiskCache.Builder()
                    .directory(context.cacheDir.resolve("avatars").toOkioPath())
                    .maxSizeBytes(16L * 1024 * 1024)
                    .build()
            }
            .crossfade(true)
            .build()
}
