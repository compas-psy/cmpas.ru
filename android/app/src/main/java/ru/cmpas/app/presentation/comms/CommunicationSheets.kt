package ru.cmpas.app.presentation.comms

import android.content.Context
import android.content.Intent
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*

private val MSG_TEMPLATES = listOf(
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

/** Набор документов из android/SPEC/02-screens.md §0. */
val DOC_TEMPLATES = listOf(
    DocumentTemplate("consent", "Согласие 152-ФЗ · v2.1", "Согласие на обработку персональных данных", true),
    DocumentTemplate("privacy", "Политика конфиденциальности · v1.4", "Ознакомление с правилами обработки данных", true),
    DocumentTemplate("contract", "Договор · v1.0", "Условия работы, оплаты и отмены", true),
    DocumentTemplate("emotion-diary", "Дневник эмоций", "Материал для самостоятельной работы", false),
    DocumentTemplate("grounding-54321", "Заземление 5-4-3-2-1", "Короткая памятка для стабилизации", false),
)

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
        MSG_TEMPLATES.forEach { (title, value) ->
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
    clientId: String,
    clientName: String,
    onClose: () -> Unit,
    onInvite: (String) -> Unit = {},
) {
    val context = LocalContext.current
    var selected by remember { mutableIntStateOf(0) }
    var sent by remember { mutableStateOf(false) }
    val channel = if (selected == 0) "telegram" else "max"
    val suffix = if (selected == 0) "tg" else "mx"
    val link = "cmpas.ru/i/${clientId.take(8)}-$suffix"

    CompasBottomSheet(onClose = onClose) {
        if (sent) {
            SentState(delivered = false, onDone = onClose)
            return@CompasBottomSheet
        }

        SheetHead("Пригласить в КОМПАС", clientName)
        Spacer(Modifier.height(14.dp))
        CompasSegmented(
            options = listOf("Telegram", "MAX"),
            selectedIndex = selected,
            onSelect = { selected = it },
        )
        Spacer(Modifier.height(14.dp))
        GlassCard(modifier = Modifier.fillMaxWidth(), padding = 14.dp) {
            Eyebrow("Ссылка действует 7 дней")
            Spacer(Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Link, null, Modifier.size(18.dp), tint = Forest700)
                Spacer(Modifier.width(8.dp))
                Text(link, style = tBody, color = CompasFg, modifier = Modifier.weight(1f))
            }
        }
        Spacer(Modifier.height(12.dp))
        InfoBanner(
            icon = Icons.Outlined.NotificationsActive,
            text = "После открытия ссылки клиент привяжет мессенджер и сможет получать сервисные уведомления от вашего имени.",
            background = Sage100,
            foreground = Forest700,
        )
        Spacer(Modifier.height(16.dp))
        PrimaryButton(
            text = "Отправить приглашение",
            icon = Icons.Outlined.Share,
            onClick = {
                onInvite(channel)
                shareText(
                    context = context,
                    subject = "Приглашение в КОМПАС",
                    text = "Здравствуйте! Чтобы получать подтверждения и напоминания о встречах, откройте ссылку: https://$link",
                )
                sent = true
            },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        GhostButton("Отмена", onClose, modifier = Modifier.fillMaxWidth(), icon = Icons.Outlined.Close)
    }
}

@Composable
fun SendDocumentSheet(
    clientName: String,
    channel: String?,
    bound: Boolean,
    onClose: () -> Unit,
    initiallySelectedId: String? = null,
    onSend: (DocumentTemplate) -> Unit = {},
) {
    val context = LocalContext.current
    var selectedId by remember(initiallySelectedId) {
        mutableStateOf(initiallySelectedId ?: DOC_TEMPLATES.first().id)
    }
    var sent by remember { mutableStateOf<Boolean?>(null) }
    val selected = DOC_TEMPLATES.firstOrNull { it.id == selectedId } ?: DOC_TEMPLATES.first()

    CompasBottomSheet(onClose = onClose) {
        if (sent != null) {
            SentState(delivered = sent == true, onDone = onClose)
            return@CompasBottomSheet
        }

        SheetHead("Отправить документ", clientName)
        Spacer(Modifier.height(14.dp))
        ChannelChip(channel = channel, bound = bound)
        Spacer(Modifier.height(14.dp))
        DOC_TEMPLATES.forEach { doc ->
            DocumentChoice(
                doc = doc,
                selected = doc.id == selectedId,
                onClick = { selectedId = doc.id },
            )
            Spacer(Modifier.height(8.dp))
        }
        if (selected.requiresAck) {
            Spacer(Modifier.height(4.dp))
            InfoBanner(
                icon = Icons.Outlined.VerifiedUser,
                text = "Согласие будет зафиксировано с версией документа, датой, временем и способом подтверждения — в логике 152-ФЗ.",
                background = SuccessSoft,
                foreground = Forest700,
            )
        }
        if (!bound) {
            Spacer(Modifier.height(8.dp))
            InfoBanner(
                icon = Icons.Outlined.WarningAmber,
                text = "Клиент ещё не привязал мессенджер. Откроем системное меню, чтобы вы отправили документ вручную.",
                background = GoldSoft,
                foreground = Color(0xFF8B6914),
            )
        }
        Spacer(Modifier.height(16.dp))
        PrimaryButton(
            text = if (bound) "Отправить" else "Подготовить",
            icon = if (bound) Icons.Outlined.Send else Icons.Outlined.Share,
            onClick = {
                if (bound) {
                    onSend(selected)
                    sent = true
                } else {
                    shareText(
                        context = context,
                        subject = selected.title,
                        text = buildDocumentShareText(selected),
                    )
                    sent = false
                }
            },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        GhostButton("Отмена", onClose, modifier = Modifier.fillMaxWidth(), icon = Icons.Outlined.Close)
    }
}

@Composable
fun SentState(
    delivered: Boolean,
    onDone: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 18.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier.size(70.dp).clip(CircleShape)
                .background(if (delivered) SuccessSoft else GoldSoft),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                if (delivered) Icons.Outlined.CheckCircle else Icons.Outlined.Share,
                null,
                Modifier.size(34.dp),
                tint = if (delivered) Success else CompasAccent,
            )
        }
        Spacer(Modifier.height(14.dp))
        Text(if (delivered) "Отправлено" else "Готово к отправке", style = tSection, color = CompasFg)
        Spacer(Modifier.height(6.dp))
        Text(
            if (delivered) "Материал передан в привязанный мессенджер."
            else "Системное меню отправки открыто — выберите нужный мессенджер.",
            style = tBody2,
        )
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
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White.copy(alpha = 0.66f))
            .border(1.dp, if (selected) Forest700 else CompasBorder, RoundedCornerShape(16.dp))
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .padding(13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(22.dp).clip(CircleShape)
                .border(2.dp, if (selected) Forest700 else CompasMutedFg, CircleShape)
                .background(if (selected) Forest700 else Color.Transparent),
            contentAlignment = Alignment.Center,
        ) {
            if (selected) Icon(Icons.Outlined.Check, null, Modifier.size(14.dp), tint = Color.White)
        }
        Spacer(Modifier.width(11.dp))
        Column(Modifier.weight(1f)) {
            Text(doc.title, style = tBody, color = CompasFg)
            Text(doc.subtitle, style = tMeta, color = CompasMutedFg)
        }
        if (doc.requiresAck) Icon(Icons.Outlined.VerifiedUser, null, Modifier.size(18.dp), tint = Success)
    }
}

@Composable
private fun InfoBanner(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    text: String,
    background: Color,
    foreground: Color,
) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(background).padding(12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(icon, null, Modifier.size(19.dp), tint = foreground)
        Spacer(Modifier.width(9.dp))
        Text(text, style = tBody2, color = foreground, modifier = Modifier.weight(1f))
    }
}

private fun buildDocumentShareText(document: DocumentTemplate): String = buildString {
    append("Здравствуйте! Направляю документ «")
    append(document.title)
    append("». Откройте его по ссылке: https://cmpas.ru/d/")
    append(document.id)
    if (document.requiresAck) append(". После ознакомления подтвердите принятие в КОМПАС.")
}

private fun shareText(context: Context, subject: String, text: String) {
    val sendIntent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_SUBJECT, subject)
        putExtra(Intent.EXTRA_TEXT, text)
    }
    runCatching {
        context.startActivity(Intent.createChooser(sendIntent, "Отправить через"))
    }
}
