package ru.cmpas.app.presentation.notifications

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.AttentionItem
import ru.cmpas.app.domain.model.PracticeNotification
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun NotificationCenterSheet(
    attentionItems: List<AttentionItem> = emptyList(),
    onClose: () -> Unit,
    onOpenSession: (String) -> Unit,
    onOpenClient: (String) -> Unit,
    viewModel: NotificationCenterViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) { viewModel.load() }

    fun closeAndMarkRead() {
        viewModel.markVisibleRead()
        onClose()
    }

    CompasBottomSheet(onClose = ::closeAndMarkRead) {
        SheetHead("Уведомления")
        Spacer(Modifier.height(14.dp))

        if (attentionItems.isNotEmpty()) {
            Eyebrow("Требует внимания")
            Spacer(Modifier.height(8.dp))
            GlassCard(Modifier.fillMaxWidth(), padding = 4.dp) {
                attentionItems.forEachIndexed { index, attention ->
                    Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.WarningAmber, null, Modifier.size(18.dp), tint = CompasAccent)
                        Spacer(Modifier.width(10.dp))
                        Text(attention.label, style = tBody2, color = CompasFg, modifier = Modifier.weight(1f))
                    }
                    if (index != attentionItems.lastIndex) {
                        HorizontalDivider(Modifier.padding(horizontal = 12.dp), color = CompasBorder.copy(alpha = .8f))
                    }
                }
            }
            Spacer(Modifier.height(14.dp))
        }

        when {
            uiState.isLoading && uiState.items.isEmpty() -> {
                Box(Modifier.fillMaxWidth().padding(vertical = 32.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Forest700)
                }
            }
            uiState.error != null && uiState.items.isEmpty() -> {
                GlassCard(Modifier.fillMaxWidth(), strong = true, padding = 18.dp) {
                    Text("Не удалось загрузить уведомления", style = tSection, color = CompasFg)
                    Spacer(Modifier.height(4.dp))
                    Text(uiState.error!!, style = tBody2)
                    Spacer(Modifier.height(12.dp))
                    GhostButton("Повторить", { viewModel.load() }, Modifier.fillMaxWidth(), Icons.Outlined.Refresh)
                }
            }
            uiState.items.isEmpty() -> {
                GlassCard(Modifier.fillMaxWidth(), strong = true, padding = 18.dp) {
                    Icon(Icons.Outlined.NotificationsNone, null, Modifier.size(28.dp), tint = CompasMutedFg)
                    Spacer(Modifier.height(10.dp))
                    Text("Сейчас всё спокойно", style = tSection, color = CompasFg)
                    Spacer(Modifier.height(4.dp))
                    Text("Новые события появятся здесь.", style = tBody2)
                }
            }
            else -> {
                val (today, earlier) = remember(uiState.items) {
                    uiState.items.partition { isToday(it.createdAt) }
                }
                if (today.isNotEmpty()) {
                    Eyebrow("Сегодня")
                    Spacer(Modifier.height(8.dp))
                    today.forEach { item ->
                        NotificationRow(item, onClick = { openNotification(item, ::closeAndMarkRead, onOpenSession, onOpenClient) })
                        Spacer(Modifier.height(8.dp))
                    }
                }
                if (earlier.isNotEmpty()) {
                    if (today.isNotEmpty()) Spacer(Modifier.height(6.dp))
                    Eyebrow("Ранее")
                    Spacer(Modifier.height(8.dp))
                    earlier.forEach { item ->
                        NotificationRow(item, onClick = { openNotification(item, ::closeAndMarkRead, onOpenSession, onOpenClient) })
                        Spacer(Modifier.height(8.dp))
                    }
                }
                if (uiState.nextCursor != null) {
                    Spacer(Modifier.height(4.dp))
                    if (uiState.isLoadingMore) {
                        Box(Modifier.fillMaxWidth().padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = Forest700)
                        }
                    } else {
                        GhostButton("Показать ещё", { viewModel.loadMore() }, Modifier.fillMaxWidth(), Icons.Outlined.ExpandMore)
                    }
                }
            }
        }
        Spacer(Modifier.height(16.dp))
        GhostButton("Закрыть", ::closeAndMarkRead, modifier = Modifier.fillMaxWidth(), icon = Icons.Outlined.Close)
    }
}

private fun openNotification(
    item: PracticeNotification,
    closeAndMarkRead: () -> Unit,
    onOpenSession: (String) -> Unit,
    onOpenClient: (String) -> Unit,
) {
    closeAndMarkRead()
    when {
        item.sessionId != null -> onOpenSession(item.sessionId)
        item.clientId != null -> onOpenClient(item.clientId)
    }
}

@Composable
private fun NotificationRow(item: PracticeNotification, onClick: () -> Unit) {
    GlassCard(Modifier.fillMaxWidth(), padding = 13.dp, onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(38.dp).clip(CircleShape).background(notificationTint(item.type).copy(alpha = 0.14f)), contentAlignment = Alignment.Center) {
                Icon(notificationIcon(item.type), null, Modifier.size(19.dp), tint = notificationTint(item.type))
            }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Text(item.title, style = tBody, color = CompasFg, maxLines = 2, overflow = TextOverflow.Ellipsis)
                val details = listOfNotNull(item.subtitle, item.createdAt?.let { formatNotificationTime(it) }).joinToString(" · ")
                if (details.isNotBlank()) {
                    Spacer(Modifier.height(2.dp))
                    Text(details, style = tMeta, color = CompasMutedFg, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
            if (item.unread) {
                Spacer(Modifier.width(8.dp))
                Box(Modifier.size(8.dp).clip(CircleShape).background(CompasAccent))
            }
        }
    }
}

private fun notificationIcon(type: String): ImageVector = when (type) {
    "session_confirmed" -> Icons.Outlined.EventAvailable
    "session_cancelled" -> Icons.Outlined.EventBusy
    "session_pending" -> Icons.Outlined.Schedule
    "new_booking" -> Icons.Outlined.CalendarMonth
    "channel_linked" -> Icons.Outlined.Link
    "homework_received" -> Icons.Outlined.Assignment
    "document_acknowledged", "document_opened" -> Icons.Outlined.Description
    else -> Icons.Outlined.NotificationsNone
}

private fun notificationTint(type: String) = when (type) {
    "session_confirmed", "channel_linked" -> Success
    "session_cancelled" -> CompasDestructive
    else -> Forest700
}

private fun isToday(raw: String?): Boolean {
    val value = raw?.let { runCatching { LocalDateTime.parse(it.replace("Z", "")) }.getOrNull() } ?: return false
    return value.toLocalDate() == LocalDate.now()
}

private fun formatNotificationTime(raw: String): String {
    val value = runCatching { LocalDateTime.parse(raw.replace("Z", "")) }.getOrNull() ?: return ""
    val pattern = if (isToday(raw)) "HH:mm" else "d MMM, HH:mm"
    return value.format(DateTimeFormatter.ofPattern(pattern, Locale("ru")))
}
