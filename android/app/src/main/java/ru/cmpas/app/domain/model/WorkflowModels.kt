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
data class ClientChannelStatus(
    val clientId: String,
    val clientName: String,
    val phone: String? = null,
    val channels: ClientChannelsState,
    val recommendedChannel: String,
)

@Serializable
data class ClientChannelsState(
    val telegram: ChannelConnectionState,
    val max: ChannelConnectionState,
)

@Serializable
data class ChannelConnectionState(val connected: Boolean)

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
 * Свободное время: час ПЛЮС то, чем этот час является.
 *
 * Раньше здесь оставалось одно время: разбор брал из объекта поле "time" и
 * выбрасывал остальное, а `.distinct()` схлопывал онлайновый и очный час в
 * один. Из-за этого экран «Добавить запись» показывал утренние онлайновые
 * слоты при выбранном «В кабинете» — отличить их было нечем, хотя сервер
 * формат присылал.
 *
 * `format`: "online" | "offline" | "both". "both" — гибридное правило
 * расписания, оно годится и туда и туда.
 */
@Serializable
data class FreeSlot(
    val time: String,
    val format: String = "online",
    val addressId: String? = null,
    val addressName: String? = null,
    /** Длительность правила расписания в минутах. */
    val duration: Int? = null,
)

/**
 * Сервер за время перехода отдавал и `times: ["15:30"]`, и
 * `times: [{"time":"15:30","format":"both"}]`. Обе формы приводятся к одной,
 * но теперь БЕЗ потери: у короткой формы формат неизвестен, и она
 * объявляется гибридом — иначе старый ответ молча спрятал бы половину
 * слотов.
 */
object FlexibleSlotListSerializer : KSerializer<List<FreeSlot>> {
    private val delegate = ListSerializer(FreeSlot.serializer())
    override val descriptor = delegate.descriptor

    override fun deserialize(decoder: Decoder): List<FreeSlot> {
        val jsonDecoder = decoder as? JsonDecoder
            ?: return decoder.decodeSerializableValue(delegate)
        return jsonDecoder.decodeJsonElement().jsonArray.mapNotNull { item ->
            when (item) {
                is JsonPrimitive -> item.contentOrNull?.let { FreeSlot(time = it, format = "both") }
                is JsonObject -> item["time"]?.jsonPrimitive?.contentOrNull?.let { time ->
                    FreeSlot(
                        time = time,
                        format = item["format"]?.jsonPrimitive?.contentOrNull ?: "online",
                        addressId = item["addressId"]?.jsonPrimitive?.contentOrNull,
                        addressName = item["addressName"]?.jsonPrimitive?.contentOrNull,
                        duration = item["duration"]?.jsonPrimitive?.contentOrNull?.toIntOrNull(),
                    )
                }
                else -> null
            }
        }.filter { it.time.matches(Regex("\\d{2}:\\d{2}")) }
    }

    override fun serialize(encoder: Encoder, value: List<FreeSlot>) {
        encoder.encodeSerializableValue(delegate, value)
    }
}

@Serializable
data class FreeTimesResponse(
    val date: String,
    @Serializable(with = FlexibleSlotListSerializer::class)
    val times: List<FreeSlot> = emptyList(),
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
