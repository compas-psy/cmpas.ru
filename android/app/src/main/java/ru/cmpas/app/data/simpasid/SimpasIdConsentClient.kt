package ru.cmpas.app.data.simpasid

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * СОГЛАСИЯ ЖИВУТ В КОНСЕНТ-ЦЕНТРЕ, А НЕ У НАС.
 *
 * Вендоренный клиент СИМПАС (ru.cmpas.simpasid) умеет вход и не умеет
 * согласия: его запросы не носят ключ доступа. Дописывать его нельзя —
 * это копия чужого файла, и правка в ней разошлась бы с оригиналом молча.
 * Поэтому две ручки согласий вызываются здесь, своим кодом.
 *
 * Своего хранения акцепта у продукта нет и быть не должно
 * (14_LEGAL_PRODUCTS_UNIFIED.md §2.4, docs/integration/practice-android.md
 * шаг 7): запись о согласии — доказательство, и лежать ему положено в одном
 * месте. Продукт отправляет факт и спрашивает состояние; вторая копия у нас
 * через полгода разошлась бы с реестром, и в споре пришлось бы объяснять,
 * какая из двух настоящая.
 */

@Serializable
data class AcceptedDocument(
    @SerialName("document_code") val documentCode: String = "",
    val title: String = "",
    val version: String = "",
    @SerialName("accepted_at") val acceptedAt: String? = null,
    /** Адрес ПРИНЯТОЙ редакции, а не действующей: человек должен видеть то, с чем согласился. */
    val url: String = "",
)

@Serializable
private data class ConsentState(
    @SerialName("accepted_documents") val acceptedDocuments: List<AcceptedDocument> = emptyList(),
)

@Serializable
private data class GrantRequest(
    @SerialName("document_code") val documentCode: String,
    val version: String,
    val status: String,
    /** Имя действия, которым человек это выразил, — а не «нажал кнопку». */
    val action: String,
)

/** Чем кончилась попытка записать акцепт. */
sealed interface GrantResult {
    data object Ok : GrantResult

    /**
     * Экран показывал не ту редакцию, которая действует сейчас.
     *
     * Сервер отвергает такой акцепт намеренно: согласие даётся на редакцию,
     * которую человек ВИДЕЛ. Приложению остаётся перечитать документы и
     * показать экран заново — молча записать «как-нибудь» нельзя.
     */
    data object StaleVersion : GrantResult

    /** Ключ доступа СИМПАС не признан: вход истёк или его не было. */
    data object Unauthorized : GrantResult

    data class Failed(val status: Int) : GrantResult
}

class SimpasIdConsentClient(
    baseUrl: String,
    private val clientId: String,
    http: OkHttpClient,
) {
    private val base = baseUrl.trimEnd('/')

    // Перехватчики снимаются по той же причине, по какой их снимает клиент
    // СИМПАС: общий OkHttpClient приложения вешает ключ ПРАКТИКИ на каждый
    // запрос и в отладочной сборке печатает тела целиком. Отправить ключ
    // ПРАКТИКИ на auth.cmpas.ru значит выдать его службе, которая его не
    // просила; напечатать ключ СИМПАС в журнал устройства — выдать его всем.
    private val http: OkHttpClient = http.newBuilder()
        .apply {
            interceptors().clear()
            networkInterceptors().clear()
        }
        .build()

    private val json = Json { ignoreUnknownKeys = true }

    /** Что человек уже принял. Пустой список — ещё ничего. */
    suspend fun accepted(accessToken: String): List<AcceptedDocument> = withContext(Dispatchers.IO) {
        val request = authorized("/v1/account/consents", accessToken).get().build()
        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext emptyList()
            val text = response.body?.string().orEmpty()
            runCatching { json.decodeFromString(ConsentState.serializer(), text).acceptedDocuments }
                .getOrDefault(emptyList())
        }
    }

    /**
     * Записать акцепт. `version` — ровно та, что была на экране.
     *
     * Ни ключ, ни ответ в журнал не пишутся.
     */
    suspend fun grant(
        accessToken: String,
        documentCode: String,
        version: String,
        action: String,
    ): GrantResult = withContext(Dispatchers.IO) {
        val body = json.encodeToString(
            GrantRequest.serializer(),
            GrantRequest(documentCode = documentCode, version = version, status = "granted", action = action),
        )
        val request = authorized("/v1/account/consents", accessToken)
            .put(body.toRequestBody(JSON_MEDIA))
            .build()
        runCatching {
            http.newCall(request).execute().use { response ->
                when {
                    response.isSuccessful -> GrantResult.Ok
                    response.code == 409 -> GrantResult.StaleVersion
                    response.code == 401 || response.code == 403 -> GrantResult.Unauthorized
                    else -> GrantResult.Failed(response.code)
                }
            }
        }.getOrElse { GrantResult.Failed(0) }
    }

    private fun authorized(path: String, accessToken: String): Request.Builder =
        Request.Builder()
            .url("$base$path")
            .header("x-client-id", clientId)
            .header("authorization", "Bearer $accessToken")
            .header("accept", "application/json")

    private companion object {
        val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()
    }
}
