package ru.cmpas.app.presentation.actions

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.Client
import ru.cmpas.app.domain.model.ClientStatus
import ru.cmpas.app.presentation.comms.DocumentSendResult
import ru.cmpas.app.presentation.comms.SendDocumentSheet
import ru.cmpas.app.presentation.comms.SendMessageSheet
import ru.cmpas.app.presentation.comms.asDocumentTemplate
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

@Composable
fun NewActionSheet(
    clients: List<Client>,
    onClose: () -> Unit,
    onNewSession: () -> Unit,
    onNewClient: () -> Unit,
    onClient: (String) -> Unit,
    viewModel: QuickCommsViewModel = hiltViewModel(),
) {
    val commsState by viewModel.uiState.collectAsState()
    var mode by remember { mutableStateOf(QuickClientMode.OPEN) }
    var selectedClient by remember { mutableStateOf<Client?>(null) }
    val suggestedClients = remember(clients) { predictRelevantClients(clients).take(4) }

    LaunchedEffect(selectedClient?.id, mode) {
        if (mode == QuickClientMode.DOCUMENT) selectedClient?.id?.let(viewModel::loadDocuments)
    }

    selectedClient?.let { client ->
        val bound = !client.telegramId.isNullOrBlank() || !client.maxId.isNullOrBlank()
        val channel = when {
            !client.telegramId.isNullOrBlank() -> "telegram"
            !client.maxId.isNullOrBlank() -> "max"
            else -> null
        }
        when (mode) {
            QuickClientMode.MESSAGE -> SendMessageSheet(
                clientName = client.name,
                channel = channel,
                bound = bound,
                onClose = onClose,
                onSend = { viewModel.sendMessage(client.id, it) },
            )
            QuickClientMode.DOCUMENT -> SendDocumentSheet(
                clientName = client.name,
                channel = channel,
                bound = bound,
                documents = commsState.documents.map { it.asDocumentTemplate() },
                isLoading = commsState.loading,
                error = commsState.error,
                isSending = commsState.sending,
                onClose = onClose,
                onRetry = { viewModel.loadDocuments(client.id) },
                onSendWithResult = { document, callback ->
                    viewModel.sendDocument(
                        clientId = client.id,
                        channel = channel ?: "telegram",
                        documentId = document.id,
                    ) { result, sendError ->
                        callback(
                            when {
                                sendError != null -> DocumentSendResult(error = sendError)
                                result?.status == "sent" -> DocumentSendResult(delivered = true)
                                result?.readyText != null -> DocumentSendResult(shareText = result.readyText)
                                else -> DocumentSendResult(error = "Не удалось подготовить документ")
                            },
                        )
                    }
                },
            )
            QuickClientMode.OPEN -> Unit
        }
        if (mode != QuickClientMode.OPEN) return
    }

    CompasBottomSheet(onClose = onClose) {
        SheetHead(
            when (mode) {
                QuickClientMode.OPEN -> "Быстрое действие"
                QuickClientMode.MESSAGE -> "Кому написать?"
                QuickClientMode.DOCUMENT -> "Кому отправить документ?"
            },
            if (mode == QuickClientMode.OPEN) "Что хотите сделать?" else "Предлагаем наиболее вероятных клиентов",
        )
        Spacer(Modifier.height(16.dp))

        if (mode == QuickClientMode.OPEN) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                QuickActionTile(Icons.Outlined.CalendarMonth, "Добавить запись", Forest700, Modifier.weight(1f), onNewSession)
                QuickActionTile(Icons.Outlined.PersonAdd, "Новый клиент", Blue, Modifier.weight(1f), onNewClient)
            }
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                QuickActionTile(Icons.Outlined.Send, "Написать клиенту", Tg, Modifier.weight(1f)) { mode = QuickClientMode.MESSAGE }
                QuickActionTile(Icons.Outlined.Description, "Отправить документ", CompasAccent, Modifier.weight(1f)) { mode = QuickClientMode.DOCUMENT }
            }
            Spacer(Modifier.height(20.dp))
            Eyebrow("Вероятно, вам нужен")
            Spacer(Modifier.height(5.dp))
            Text("Клиенты с ближайшими и недавними встречами", style = tMeta, color = CompasMutedFg)
            Spacer(Modifier.height(9.dp))
        }

        if (suggestedClients.isEmpty()) {
            GlassCard(Modifier.fillMaxWidth(), padding = 16.dp) {
                Text("Пока некого предложить", style = tBody, color = CompasFg)
                Spacer(Modifier.height(3.dp))
                Text("После первых записей здесь появятся наиболее вероятные клиенты.", style = tBody2, color = CompasMutedFg)
            }
        } else {
            suggestedClients.forEach { client ->
                QuickClientRow(client) {
                    if (mode == QuickClientMode.OPEN) onClient(client.id) else selectedClient = client
                }
                Spacer(Modifier.height(8.dp))
            }
        }

        if (mode != QuickClientMode.OPEN) {
            Spacer(Modifier.height(4.dp))
            GhostButton(
                text = "Назад",
                onClick = {
                    selectedClient = null
                    mode = QuickClientMode.OPEN
                },
                modifier = Modifier.fillMaxWidth(),
                icon = Icons.Outlined.ArrowBack,
            )
        }
    }
}

@Composable
private fun QuickActionTile(
    icon: ImageVector,
    label: String,
    accent: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    GlassCard(modifier = modifier, padding = 14.dp, onClick = onClick) {
        Box(Modifier.size(40.dp).clip(CircleShape).background(accent.copy(alpha = .14f)), contentAlignment = Alignment.Center) {
            Icon(icon, null, Modifier.size(20.dp), tint = accent)
        }
        Spacer(Modifier.height(10.dp))
        Text(label, color = CompasFg, fontSize = 14.sp, lineHeight = 19.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun QuickClientRow(client: Client, onClick: () -> Unit) {
    val bound = !client.telegramId.isNullOrBlank() || !client.maxId.isNullOrBlank()
    val channel = when {
        !client.telegramId.isNullOrBlank() -> "telegram"
        !client.maxId.isNullOrBlank() -> "max"
        else -> null
    }
    GlassCard(Modifier.fillMaxWidth(), padding = 12.dp, onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(client.name, 42.dp)
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Text(client.name, style = tBody, color = CompasFg, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    smartClientContext(client),
                    style = tMeta,
                    color = CompasMutedFg,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            ChannelChip(channel, bound)
        }
    }
}

private fun predictRelevantClients(clients: List<Client>): List<Client> {
    val now = LocalDateTime.now()
    return clients
        .filter { it.status == ClientStatus.ACTIVE }
        .sortedByDescending { client ->
            val next = client.nextSessionDate?.let { date ->
                runCatching { LocalDateTime.of(LocalDate.parse(date), parseTime(client.nextSessionTime)) }.getOrNull()
            }
            val last = client.lastSessionDate?.let { date ->
                runCatching { LocalDateTime.of(LocalDate.parse(date), parseTime(client.lastSessionTime)) }.getOrNull()
            }
            when {
                next != null && !next.isBefore(now) -> {
                    val minutes = ChronoUnit.MINUTES.between(now, next).coerceAtLeast(0)
                    2_000_000L - minutes.coerceAtMost(1_000_000L)
                }
                last != null -> {
                    val minutes = ChronoUnit.MINUTES.between(last, now).coerceAtLeast(0)
                    1_000_000L - minutes.coerceAtMost(900_000L)
                }
                else -> 10_000L - client.sessionsCount
            }
        }
}

private fun smartClientContext(client: Client): String {
    val today = LocalDate.now()
    client.nextSessionDate?.let { raw ->
        runCatching { LocalDate.parse(raw) }.getOrNull()?.let { date ->
            val prefix = when (date) {
                today -> "Сегодня"
                today.plusDays(1) -> "Завтра"
                else -> "Ближайшая · ${date.format(DateTimeFormatter.ofPattern("d MMM"))}"
            }
            return "$prefix${client.nextSessionTime?.let { " · $it" }.orEmpty()}"
        }
    }
    client.lastSessionDate?.let { raw ->
        runCatching { LocalDate.parse(raw) }.getOrNull()?.let { date ->
            val days = ChronoUnit.DAYS.between(date, today)
            return when (days) {
                0L -> "Встречались сегодня"
                1L -> "Встречались вчера"
                in 2..7 -> "Встречались $days дн. назад"
                else -> "Последняя · ${date.format(DateTimeFormatter.ofPattern("d MMM"))}"
            }
        }
    }
    return if (client.sessionsCount > 0) "${client.sessionsCount} встреч" else "Новый клиент"
}

private fun parseTime(raw: String?): LocalTime = runCatching {
    LocalTime.parse(raw ?: "12:00", DateTimeFormatter.ofPattern("HH:mm"))
}.getOrDefault(LocalTime.NOON)

private enum class QuickClientMode { OPEN, MESSAGE, DOCUMENT }
