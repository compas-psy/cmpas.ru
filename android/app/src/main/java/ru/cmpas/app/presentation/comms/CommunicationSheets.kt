package ru.cmpas.app.presentation.comms

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import ru.cmpas.app.domain.model.ClientChannelStatus
import ru.cmpas.app.domain.model.InviteResponse
import ru.cmpas.app.domain.model.OnboardingDoc
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*

private val messageTemplates = listOf(
    "Напоминание" to "Здравствуйте! Напоминаю о нашей встрече. Если планы изменились, пожалуйста, сообщите заранее.",
    "Подтверждение" to "Здравствуйте! Подтвердите, пожалуйста, что встреча остаётся в силе.",
    "Оплата" to "Здравствуйте! Направляю напоминание об оплате предстоящей сессии.",
    "После встречи" to "Спасибо за сегодняшнюю встречу. Бережно отнеситесь к себе после сессии; при необходимости можно написать мне.",
)

data class DocumentTemplate(
    val id: String,
    val title: String,
    val subtitle: String,
    val requiresAck: Boolean,
)

data class DocumentSendResult(
    val delivered: Boolean = false,
    val shareText: String? = null,
    val error: String? = null,
)

fun OnboardingDoc.asDocumentTemplate(): DocumentTemplate {
    val normalized = title.lowercase()
    val requiresAck = listOf("соглас", "договор", "политик", "конфиденц").any(normalized::contains)
    return DocumentTemplate(
        id = id,
        title = title,
        subtitle = if (requiresAck) "Потребуется подтверждение ознакомления" else "Материал из раздела «Документы»",
        requiresAck = requiresAck,
    )
}

@Composable
fun SendMessageSheet(
    clientName: String,
    channel: String?,
    bound: Boolean,
    onClose: () -> Unit,
    initialText: String = "",
    onSend: (String) -> Unit = {},
) {
    val context = LocalContext.current
    var text by remember(initialText) { mutableStateOf(initialText) }
    var sent by remember { mutableStateOf<Boolean?>(null) }

    CompasBottomSheet(onClose = onClose) {
        if (sent != null) {
            SentState(delivered = sent == true, onDone = onClose)
            return@CompasBottomSheet
        }
        SheetHead("Написать клиенту", clientName)
        Spacer(Modifier.height(14.dp))
        ChannelChip(channel = channel, bound = bound)
        Spacer(Modifier.height(14.dp))
        OutlinedTextField(
            value = text,
            onValueChange = { text = it },
            modifier = Modifier.fillMaxWidth().heightIn(min = 132.dp),
            label = { Text("Сообщение") },
            placeholder = { Text("Введите сообщение клиенту") },
            shape = RoundedCornerShape(16.dp),
            minLines = 4,
        )
        Spacer(Modifier.height(14.dp))
        Eyebrow("Шаблоны")
        Spacer(Modifier.height(8.dp))
        messageTemplates.forEach { (title, value) ->
            TemplateRow(title = title, preview = value, onClick = { text = value })
            Spacer(Modifier.height(7.dp))
        }
        if (!bound) {
            Spacer(Modifier.height(6.dp))
            InfoBanner(
                icon = Icons.Outlined.WarningAmber,
                text = "Бот не может написать первым. Подготовим текст и откроем системное меню отправки.",
                background = GoldSoft,
                foreground = Color(0xFF8B6914),
            )
        }
        Spacer(Modifier.height(16.dp))
        PrimaryButton(
            text = if (bound) "Отправить" else "Подготовить",
            icon = if (bound) Icons.Outlined.Send else Icons.Outlined.Share,
            enabled = text.isNotBlank(),
            onClick = {
                val ready = text.trim()
                if (ready.isNotBlank()) {
                    if (bound) {
                        onSend(ready)
                        sent = true
                    } else {
                        shareText(context, "Сообщение для $clientName", ready)
                        sent = false
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        GhostButton("Отмена", onClose, modifier = Modifier.fillMaxWidth(), icon = Icons.Outlined.Close)
    }
}

@Composable
fun InviteSheet(
    clientName: String,
    isLoading: Boolean,
    invite: InviteResponse?,
    error: String?,
    channelStatus: ClientChannelStatus?,
    onClose: () -> Unit,
    onRetry: () -> Unit = {},
) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    var copied by remember { mutableStateOf(false) }
    val connectedChannel = when {
        channelStatus?.channels?.max?.connected == true -> "MAX"
        channelStatus?.channels?.telegram?.connected == true -> "Telegram"
        else -> null
    }

    CompasBottomSheet(onClose = onClose) {
        SheetHead("Пригласить в КОМПАС", clientName)
        Spacer(Modifier.height(14.dp))

        when {
            connectedChannel != null -> {
                Spacer(Modifier.height(4.dp))
                Column(Modifier.fillMaxWidth().padding(vertical = 12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.size(70.dp).clip(CircleShape).background(SuccessSoft), contentAlignment = Alignment.Center) {
                        Icon(Icons.Outlined.CheckCircle, null, Modifier.size(34.dp), tint = Success)
                    }
                    Spacer(Modifier.height(14.dp))
                    Text("$clientName подключён(а)", style = tSection, color = CompasFg)
                    Spacer(Modifier.height(6.dp))
                    Text("Канал: $connectedChannel. Напоминания и подтверждения теперь приходят автоматически.", style = tBody2)
                }
                Spacer(Modifier.height(16.dp))
                PrimaryButton("Готово", onClose, modifier = Modifier.fillMaxWidth(), icon = Icons.Outlined.Check)
            }
            isLoading && invite == null -> {
                Box(Modifier.fillMaxWidth().height(220.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Forest700)
                }
            }
            error != null && invite == null -> {
                GlassCard(Modifier.fillMaxWidth(), strong = true, padding = 18.dp) {
                    Icon(Icons.Outlined.WarningAmber, null, Modifier.size(28.dp), tint = CompasDestructive)
                    Spacer(Modifier.height(10.dp))
                    Text("Не удалось создать приглашение", style = tSection, color = CompasFg)
                    Spacer(Modifier.height(4.dp))
                    Text(error, style = tBody2)
                    Spacer(Modifier.height(12.dp))
                    GhostButton("Повторить", onRetry, Modifier.fillMaxWidth(), Icons.Outlined.Refresh)
                }
                Spacer(Modifier.height(8.dp))
                GhostButton("Отмена", onClose, modifier = Modifier.fillMaxWidth(), icon = Icons.Outlined.Close)
            }
            invite != null -> {
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    QrCodeImage(content = invite.inviteLink)
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    "Покажите экран клиенту — пусть наведёт камеру",
                    style = tMeta,
                    color = CompasMutedFg,
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(14.dp))
                GlassCard(
                    modifier = Modifier.fillMaxWidth(),
                    padding = 14.dp,
                    onClick = {
                        clipboard.setText(AnnotatedString(invite.inviteLink))
                        copied = true
                    },
                ) {
                    Eyebrow("Ссылка действует 72 часа · ${if (copied) "скопировано" else "нажмите, чтобы скопировать"}")
                    Spacer(Modifier.height(6.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Link, null, Modifier.size(18.dp), tint = Forest700)
                        Spacer(Modifier.width(8.dp))
                        Text(invite.inviteLink, style = tBody, color = CompasFg, modifier = Modifier.weight(1f))
                    }
                }
                Spacer(Modifier.height(12.dp))
                // MAX first — works in RU without a VPN; Telegram may require one.
                val maxLink = invite.directLinks?.max
                if (maxLink != null) {
                    GhostButton(
                        "Открыть в MAX",
                        onClick = { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(maxLink))) } },
                        modifier = Modifier.fillMaxWidth(),
                        icon = Icons.Outlined.Forum,
                    )
                    Spacer(Modifier.height(8.dp))
                } else {
                    InfoBanner(
                        icon = Icons.Outlined.WarningAmber,
                        text = "Подключение MAX пока не настроено — доступен только Telegram.",
                        background = GoldSoft,
                        foreground = Color(0xFF8B6914),
                    )
                    Spacer(Modifier.height(8.dp))
                }
                invite.directLinks?.telegram?.let { tgLink ->
                    GhostButton(
                        "Открыть в Telegram",
                        onClick = { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(tgLink))) } },
                        modifier = Modifier.fillMaxWidth(),
                        icon = Icons.Outlined.Send,
                    )
                    Spacer(Modifier.height(8.dp))
                }
                InfoBanner(
                    icon = Icons.Outlined.NotificationsActive,
                    text = "Клиент сам выберет канал по кнопке. Как только он привяжет мессенджер, здесь появится подтверждение — обновлять экран не нужно.",
                    background = Sage100,
                    foreground = Forest700,
                )
                Spacer(Modifier.height(16.dp))
                PrimaryButton(
                    text = "Поделиться приглашением",
                    icon = Icons.Outlined.Share,
                    onClick = { shareText(context, "Приглашение в КОМПАС", invite.shareText ?: invite.inviteLink) },
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                GhostButton("Отмена", onClose, modifier = Modifier.fillMaxWidth(), icon = Icons.Outlined.Close)
            }
        }
    }
}

@Composable
fun SendDocumentSheet(
    clientName: String,
    channel: String?,
    bound: Boolean,
    documents: List<DocumentTemplate> = emptyList(),
    isLoading: Boolean = false,
    error: String? = null,
    isSending: Boolean = false,
    onClose: () -> Unit,
    initiallySelectedId: String? = null,
    onRetry: () -> Unit = {},
    onSend: (DocumentTemplate) -> Unit = {},
    onSendWithResult: ((DocumentTemplate, (DocumentSendResult) -> Unit) -> Unit)? = null,
) {
    val context = LocalContext.current
    var selectedId by remember(initiallySelectedId, documents) {
        mutableStateOf(initiallySelectedId?.takeIf { id -> documents.any { it.id == id } } ?: documents.firstOrNull()?.id)
    }
    var sent by remember { mutableStateOf<Boolean?>(null) }
    var localError by remember { mutableStateOf<String?>(null) }
    val selected = documents.firstOrNull { it.id == selectedId }

    CompasBottomSheet(onClose = onClose) {
        if (sent != null) {
            SentState(delivered = sent == true, onDone = onClose)
            return@CompasBottomSheet
        }
        SheetHead("Отправить документ", clientName)
        Spacer(Modifier.height(14.dp))
        ChannelChip(channel = channel, bound = bound)
        Spacer(Modifier.height(14.dp))

        when {
            isLoading -> Box(Modifier.fillMaxWidth().height(150.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Forest700)
            }
            documents.isEmpty() -> GlassCard(Modifier.fillMaxWidth(), strong = true, padding = 18.dp) {
                Icon(Icons.Outlined.FolderOff, null, Modifier.size(30.dp), tint = CompasMutedFg)
                Spacer(Modifier.height(10.dp))
                Text("Нет активных документов", style = tSection, color = CompasFg)
                Spacer(Modifier.height(4.dp))
                Text(error ?: "Добавьте или активируйте документ в разделе «Документы» web-сервиса — после этого он появится здесь.", style = tBody2)
                Spacer(Modifier.height(12.dp))
                GhostButton("Обновить", onRetry, Modifier.fillMaxWidth(), Icons.Outlined.Refresh)
            }
            else -> {
                documents.forEach { document ->
                    DocumentChoice(document, document.id == selectedId) { selectedId = document.id; localError = null }
                    Spacer(Modifier.height(8.dp))
                }
                selected?.takeIf { it.requiresAck }?.let {
                    Spacer(Modifier.height(4.dp))
                    InfoBanner(
                        icon = Icons.Outlined.VerifiedUser,
                        text = "Согласие по 152-ФЗ: будет зафиксирована версия документа, дата, время и способ подтверждения.",
                        background = SuccessSoft,
                        foreground = Forest700,
                    )
                }
                if (!bound) {
                    Spacer(Modifier.height(8.dp))
                    InfoBanner(
                        icon = Icons.Outlined.WarningAmber,
                        text = "Клиент ещё не привязал мессенджер. После подготовки откроется системное меню отправки.",
                        background = GoldSoft,
                        foreground = Color(0xFF8B6914),
                    )
                }
            }
        }

        (localError ?: error?.takeIf { documents.isNotEmpty() })?.let { message ->
            Spacer(Modifier.height(10.dp))
            Text(message, style = tMeta, color = CompasDestructive)
        }
        Spacer(Modifier.height(16.dp))
        PrimaryButton(
            text = when { isSending -> "Отправляем…"; bound -> "Отправить"; else -> "Подготовить" },
            icon = if (bound) Icons.Outlined.Send else Icons.Outlined.Share,
            enabled = selected != null && !isLoading && !isSending,
            onClick = {
                selected?.let { document ->
                    localError = null
                    val resultHandler: (DocumentSendResult) -> Unit = { result ->
                        when {
                            result.error != null -> localError = result.error
                            result.shareText != null -> { shareText(context, document.title, result.shareText); sent = false }
                            result.delivered -> sent = true
                            else -> localError = "Не удалось подготовить документ"
                        }
                    }
                    if (onSendWithResult != null) {
                        onSendWithResult(document, resultHandler)
                    } else {
                        onSend(document)
                        if (bound) sent = true else localError = "Подключите отправку документа к сервису"
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        GhostButton("Отмена", onClose, modifier = Modifier.fillMaxWidth(), icon = Icons.Outlined.Close)
    }
}

@Composable
fun SentState(delivered: Boolean, onDone: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(vertical = 18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(70.dp).clip(CircleShape).background(if (delivered) SuccessSoft else GoldSoft), contentAlignment = Alignment.Center) {
            Icon(if (delivered) Icons.Outlined.CheckCircle else Icons.Outlined.Share, null, Modifier.size(34.dp), tint = if (delivered) Success else CompasAccent)
        }
        Spacer(Modifier.height(14.dp))
        Text(if (delivered) "Отправлено" else "Готово к отправке", style = tSection, color = CompasFg)
        Spacer(Modifier.height(6.dp))
        Text(if (delivered) "Документ передан в привязанный мессенджер." else "Системное меню открыто — выберите чат с клиентом.", style = tBody2)
        Spacer(Modifier.height(20.dp))
        PrimaryButton("Готово", onDone, modifier = Modifier.fillMaxWidth(), icon = Icons.Outlined.Check)
    }
}

@Composable
private fun TemplateRow(title: String, preview: String, onClick: () -> Unit) {
    GlassCard(modifier = Modifier.fillMaxWidth(), padding = 12.dp, onClick = onClick) {
        Text(title, style = tMeta, color = Forest700)
        Spacer(Modifier.height(3.dp))
        Text(preview, style = tBody2, maxLines = 2)
    }
}

@Composable
private fun DocumentChoice(doc: DocumentTemplate, selected: Boolean, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color.White.copy(alpha = 0.66f))
            .border(1.dp, if (selected) Forest700 else CompasBorder, RoundedCornerShape(16.dp))
            .clickable(interactionSource = interaction, indication = null, onClick = onClick).padding(13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(22.dp).clip(CircleShape).border(2.dp, if (selected) Forest700 else CompasMutedFg, CircleShape)
                .background(if (selected) Forest700 else Color.Transparent),
            contentAlignment = Alignment.Center,
        ) { if (selected) Icon(Icons.Outlined.Check, null, Modifier.size(14.dp), tint = Color.White) }
        Spacer(Modifier.width(11.dp))
        Column(Modifier.weight(1f)) {
            Text(doc.title, style = tBody, color = CompasFg)
            Text(doc.subtitle, style = tMeta, color = CompasMutedFg)
        }
        if (doc.requiresAck) Icon(Icons.Outlined.VerifiedUser, null, Modifier.size(18.dp), tint = Success)
    }
}

@Composable
private fun InfoBanner(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String, background: Color, foreground: Color) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(background).padding(12.dp), verticalAlignment = Alignment.Top) {
        Icon(icon, null, Modifier.size(19.dp), tint = foreground)
        Spacer(Modifier.width(9.dp))
        Text(text, style = tBody2, color = foreground, modifier = Modifier.weight(1f))
    }
}

private fun shareText(context: Context, subject: String, text: String) {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_SUBJECT, subject)
        putExtra(Intent.EXTRA_TEXT, text)
    }
    runCatching { context.startActivity(Intent.createChooser(intent, "Отправить через")) }
}
