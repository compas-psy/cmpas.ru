package ru.cmpas.app.data.api

import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import ru.cmpas.app.data.datastore.UserPreferences
import javax.inject.Inject
import javax.inject.Singleton

/**
 * OkHttp interceptor that attaches Bearer JWT token to every request.
 * If a request gets 401, tries to refresh the token and retry once.
 */
@Singleton
class AuthInterceptor @Inject constructor(
    private val userPreferences: UserPreferences,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val token = runBlocking { userPreferences.getAccessToken() }

        val request = chain.request().newBuilder()
            .addHeader("X-Client", "android")
            .apply {
                if (token != null) {
                    addHeader("Authorization", "Bearer $token")
                }
            }
            .build()

        val response = chain.proceed(request)

        // If 401 and we have a refresh token, try to refresh
        if (response.code == 401) {
            val refreshToken = runBlocking { userPreferences.getRefreshToken() }
            if (refreshToken != null) {
                response.close()
                // Try refreshing token
                val refreshed = tryRefreshToken(chain, refreshToken)
                if (refreshed != null) {
                    // Retry original request with new token
                    val newRequest = chain.request().newBuilder()
                        .removeHeader("Authorization")
                        .addHeader("Authorization", "Bearer $refreshed")
                        .addHeader("X-Client", "android")
                        .build()
                    return chain.proceed(newRequest)
                }
            }
        }

        return response
    }

    private fun tryRefreshToken(chain: Interceptor.Chain, refreshToken: String): String? {
        return try {
            val refreshRequest = okhttp3.Request.Builder()
                .url("https://cmpas.ru/api/mobile/auth/refresh")
                .post(
                    okhttp3.RequestBody.create(
                        okhttp3.MediaType.parse("application/json"),
                        """{"refreshToken":"$refreshToken"}"""
                    )
                )
                .build()

            val refreshResponse = chain.proceed(refreshRequest)
            if (refreshResponse.isSuccessful) {
                val body = refreshResponse.body?.string()
                refreshResponse.close()
                // Parse tokens
                val json = org.json.JSONObject(body ?: "{}")
                val newAccessToken = json.optString("accessToken")
                val newRefreshToken = json.optString("refreshToken")
                if (newAccessToken.isNotEmpty()) {
                    runBlocking {
                        userPreferences.saveTokens(newAccessToken, newRefreshToken)
                    }
                    newAccessToken
                } else null
            } else {
                refreshResponse.close()
                null
            }
        } catch (e: Exception) {
            null
        }
    }
}
