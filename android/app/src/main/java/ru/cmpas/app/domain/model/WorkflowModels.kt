package ru.cmpas.app.domain.model

import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive

@Serializable
data class SendMessageResponse(
    val status: String,
    val sentAt: String? = null,
    val readyText: String? = null,
    val phone: String? = null,
)

@Serializable
data class InviteResponse(
    val inviteLink: String,
    val directLink: String? = null,
    val directLinks: InviteDirectLinks? = null,
    val shareText: String? = null,
    val channel: String,
    val expiresAt: String,
    val clientName: String,
    val phone: String? = null,
)

@Serializable
data class InviteDirectLinks(
    val telegram: String? = null,
    val max: String? = null,
)

@Serializable
data class OnboardingDoc(
    val id: String,
    val title: String,
)

@Serializable
data class OnboardingOptions(
    val clientName: String,
    val phone: String? = null,
    val hasTelegram: Boolean = false,
    val hasMax: Boolean = false,
    val documents: List<OnboardingDoc> = emptyList(),
    val hasSession: Boolean = false,
)

@Serializable
data class OnboardingSendRequest(
    val channel: String,
    val sendNotification: Boolean,
    val documentId: String? = null,
)

@Serializable
data class OnboardingResult(
    val status: String,
    val channel: String,
    val inviteLink: String? = null,
    val readyText: String? = null,
    val phone: String? = null,
)

@Serializable
data class TimeBlock(
    val id: String,
    val date: String,
    val startTime: String,
    val endTime: String,
    val type: String,
    val reason: String? = null,
)

@Serializable
data class CreateBlockResponse(
    val ok: Boolean,
    val created: Int,
)

/**
 * Production has returned both `times: ["15:30"]` and
 * `times: [{"time":"15:30","format":"both"}]` during the API transition.
 * Decode both shapes into one stable list used by the Android UI.
 */
object FlexibleTimeListSerializer : KSerializer<List<String>> {
    private val delegate = ListSerializer(String.serializer())
    override val descriptor = delegate.descriptor

    override fun deserialize(decoder: Decoder): List<String> {
        val jsonDecoder = decoder as? JsonDecoder
            ?: return decoder.decodeSerializableValue(delegate)
        return jsonDecoder.decodeJsonElement().jsonArray.mapNotNull { item ->
            when (item) {
                is JsonPrimitive -> item.contentOrNull
                is JsonObject -> item["time"]?.jsonPrimitive?.contentOrNull
                else -> null
            }
        }.filter { it.matches(Regex("\\d{2}:\\d{2}")) }
            .distinct()
    }

    override fun serialize(encoder: Encoder, value: List<String>) {
        encoder.encodeSerializableValue(delegate, value)
    }
}

@Serializable
data class FreeTimesResponse(
    val date: String,
    @Serializable(with = FlexibleTimeListSerializer::class)
    val times: List<String> = emptyList(),
)

@Serializable
data class ScheduledMessage(
    val id: String,
    val clientId: String,
    val sessionId: String? = null,
    val channel: String,
    val text: String,
    val sendAt: String,
    val status: String,
    val readyText: String? = null,
)

@Serializable
enum class ReminderStatus { SCHEDULED, SENT, READ, FAILED }

@Serializable
data class SessionReminder(
    val id: String,
    val whenLabel: String,
    val atLabel: String,
    val channel: String,
    val status: ReminderStatus,
    val withPayment: Boolean,
    val text: String,
)
