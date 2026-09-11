package ru.cmpas.app.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import ru.cmpas.app.BuildConfig
import ru.cmpas.app.data.simpasid.SimpasIdConsentClient
import ru.cmpas.simpasid.SimpasIdClient
import java.util.concurrent.TimeUnit
import javax.inject.Qualifier
import javax.inject.Singleton

/**
 * ЕДИНОМУ ВХОДУ — СВОЙ HTTP-КЛИЕНТ, А НЕ ОБЩИЙ.
 *
 * Это единственное место во всей связке, где ошибка стоит дорого
 * (docs/integration/practice-android.md, шаг 2). Общий OkHttpClient
 * приложения несёт AuthInterceptor — тот вешает `Authorization: Bearer
 * <ключ ПРАКТИКИ>` на КАЖДЫЙ запрос, — и в отладочной сборке печатает тела
 * целиком. Передать его сюда значит:
 *
 *   * отправить ключ доступа ПРАКТИКИ на auth.cmpas.ru, службе, которая
 *     его не просила;
 *   * напечатать код из письма и ключ СИМПАС в журнал устройства.
 *
 * Клиент СИМПАС перехватчики переданного снимает сам, и это у него
 * проверено тестом. Но полагаться на чужую защиту, когда цена — выданный
 * ключ, незачем: здесь он получает свой, чистый.
 */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class SimpasIdHttp

@Module
@InstallIn(SingletonComponent::class)
object SimpasIdModule {

    @Provides
    @Singleton
    @SimpasIdHttp
    fun provideSimpasIdHttp(): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    @Provides
    @Singleton
    fun provideSimpasIdClient(@SimpasIdHttp http: OkHttpClient): SimpasIdClient = SimpasIdClient(
        baseUrl = BuildConfig.SIMPASID_ISSUER,
        clientId = BuildConfig.SIMPASID_CLIENT_ID,
        http = http,
    )

    @Provides
    @Singleton
    fun provideSimpasIdConsentClient(@SimpasIdHttp http: OkHttpClient): SimpasIdConsentClient =
        SimpasIdConsentClient(
            baseUrl = BuildConfig.SIMPASID_ISSUER,
            clientId = BuildConfig.SIMPASID_CLIENT_ID,
            http = http,
        )
}
