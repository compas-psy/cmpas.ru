package ru.cmpas.app.presentation.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.PracticeNotification
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.domain.model.SessionFormat
import ru.cmpas.app.domain.model.SessionStatus
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*
import ru.cmpas.app.presentation.util.PersonName
import ru.cmpas.app.presentation.util.handleVideoLink
import java.time.Duration
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun DashboardScreen(
    onSessionClick: (String) -> Unit = {},
    onCalendarClick: () -> Unit = {},
    onClientClick: (String) -> Unit = {},
    viewModel: DashboardViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    var showNotifications by remember { mutableStateOf(false) }

    Box(Modifier.fillMaxSize().background(CompasBg)) {
        Ambient()

        if (uiState.isLoading && !uiState.isDataLoaded) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
            return@Box
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 10.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Eyebrow(uiState.todayFormatted)
                        Spacer(Modifier.height(4.dp))
                        val firstName = PersonName.firstName(uiState.userName)
                        Text("Добрый день, ${firstName ?: "коллега"}", style = tHero, color = CompasFg)
                    }
                    IconButtonGlass(
                        icon = if (uiState.notifications.isNotEmpty() || uiState.attentionItems.isNotEmpty()) Icons.Outlined.NotificationsActive else Icons.Outlined.NotificationsNone,
                        badge = uiState.notifications.isNotEmpty() || uiState.attentionItems.isNotEmpty(),
                        onClick = { showNotifications = true },
                    )
                }
            }

            item {
                val next = uiState.nextSession
                if (next != null) {
                    HeroNextSession(
                        session = next,
                        onOpen = { onSessionClick(next.id) },
                        onConnect = { handleVideoLink(context, next.videoLink) },
                        onNote = { onSessionClick(next.id) },
                    )
                } else {
                    GlassTintCard(padding = 18.dp) {
                        Text("СЛЕДУЮЩАЯ СЕССИЯ", style = tEyebrow, color = Color.White.copy(alpha = 0.62f))
                        Spacer(Modifier.height(8.dp))
                        Text("На сегодня встреч больше нет", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(4.dp))
                        Text("Спокойно выдохните — расписание свободно.", color = Color.White.copy(alpha = 0.78f), fontSize = 13.5.sp)
                    }
                }
            }

            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Kpi(Icons.Outlined.CalendarMonth, "${uiState.todaySessions.size}", "сегодня", Forest600, Modifier.weight(1f))
                    Kpi(Icons.Outlined.EventAvailable, "${uiState.weekSessionsCount}", "за неделю", Blue, Modifier.weight(1f))
                    Kpi(Icons.Outlined.PersonAdd, "${uiState.newClientsCount}", "новых", CompasAccent, Modifier.weight(1f))
                }
            }

            item { SectionTitle("Расписание", actionLabel = "Весь день", onAction = onCalendarClick) }

            if (uiState.todaySessions.isEmpty()) {
                item {
                    GlassCard(padding = 18.dp) { Text("Нет записей на сегодня", style = tBody2) }
                }
            } else {
                items(uiState.todaySessions, key = { it.id }) { session ->
                    ScheduleRow(session, onClick = { onSessionClick(session.id) })
                }
            }
        }

        if (showNotifications) {
            NotificationsSheet(
                notifications = uiState.notifications,
                attentionLabels = uiState.attentionItems.map { "${it.label}: ${it.count}" },
                onClose = { showNotifications = false },
                onSession = { id -> showNotifications = false; onSessionClick(id) },
                onClient = { id -> showNotifications = false; onClientClick(id) },
            )
        }
    }
}

@Composable
private fun HeroNextSession(
    session: Session,
    onOpen: () -> Unit,
    onConnect: () -> Unit,
    onNote: () -> Unit,
) {
    val duration = durationMin(session.startTime, session.endTime)
    val until = untilLabel(session.startTime)
    val isOnline = session.format == SessionFormat.ONLINE

    GlassTintCard(padding = 18.dp, onClick = onOpen) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("СЛЕДУЮЩАЯ СЕССИЯ", style = tEyebrow, color = Color.White.copy(alpha = 0.62f), modifier = Modifier.weight(1f))
            if (until != null) {
                Row(
                    Modifier.clip(RoundedCornerShape(999.dp)).background(Color.White.copy(alpha = 0.14f))
                        .padding(horizontal = 10.dp, vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Outlined.Schedule, null, Modifier.size(14.dp), tint = CompasAccent400)
                    Spacer(Modifier.width(5.dp))
                    Text(until, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
        Spacer(Modifier.height(14.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(session.clientName, 52.dp, ring = true)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(session.clientName, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(3.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(if (isOnline) Icons.Outlined.Videocam else Icons.Outlined.LocationOn, null, Modifier.size(14.dp), tint = Color.White.copy(alpha = 0.78f))
                    Spacer(Modifier.width(5.dp))
                    Text(
                        "${session.startTime.take(5)} · $duration мин · ${if (isOnline) "Видео" else "В кабинете"}",
                        color = Color.White.copy(alpha = 0.78f),
                        fontSize = 13.5.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
        Spacer(Modifier.height(14.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            if (isOnline) {
                val connectInteraction = remember { MutableInteractionSource() }
                Row(
                    Modifier.weight(1f).height(46.dp).clip(RoundedCornerShape(14.dp)).background(Color.White)
                        .clickable(interactionSource = connectInteraction, indication = null, onClick = onConnect),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Outlined.Videocam, null, Modifier.size(18.dp), tint = Forest800)
                    Spacer(Modifier.width(8.dp))
                    Text("Подключиться", color = Forest800, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                }
            } else {
                Text(
                    "Очная встреча",
                    style = tBody,
                    color = Color.White.copy(alpha = .82f),
                    modifier = Modifier.weight(1f),
                )
            }
            val noteInteraction = remember { MutableInteractionSource() }
            Box(
                Modifier.size(width = 52.dp, height = 46.dp).clip(RoundedCornerShape(14.dp))
                    .background(Color.White.copy(alpha = 0.10f))
                    .border(1.dp, Color.White.copy(alpha = 0.22f), RoundedCornerShape(14.dp))
                    .clickable(interactionSource = noteInteraction, indication = null, onClick = onNote),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.EditNote, "Заметка", Modifier.size(20.dp), tint = Color.White)
            }
        }
    }
}

@Composable
private fun ScheduleRow(session: Session, onClick: () -> Unit) {
    val duration = durationMin(session.startTime, session.endTime)
    Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
        Column(
            Modifier.width(66.dp),
            horizontalAlignment = Alignment.Start,
        ) {
            Text(
                session.startTime.take(5),
                style = tBody.copy(fontFeatureSettings = "tnum", fontSize = 16.sp),
                fontWeight = FontWeight.Bold,
                color = CompasFg,
                maxLines = 1,
                softWrap = false,
            )
            Text(
                "$duration мин",
                style = tMeta,
                color = CompasMutedFg,
                maxLines = 1,
                softWrap = false,
            )
        }
        Spacer(Modifier.width(4.dp))
        Column(Modifier.fillMaxHeight().width(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Spacer(Modifier.height(5.dp))
            Box(Modifier.size(9.dp).clip(CircleShape).background(statusDotColor(session.status)))
            Box(Modifier.width(2.dp).weight(1f).background(CompasBorder.copy(alpha = 0.6f)))
        }
        Spacer(Modifier.width(8.dp))
        GlassCard(modifier = Modifier.weight(1f), padding = 12.dp, onClick = onClick) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Avatar(session.clientName, 40.dp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(session.clientName, color = CompasFg, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Spacer(Modifier.height(3.dp))
                    FmtChip(if (session.format == SessionFormat.ONLINE) "video" else "offline")
                }
                Icon(Icons.Outlined.ChevronRight, null, Modifier.size(18.dp), tint = CompasMutedFg)
            }
        }
    }
}

@Composable
private fun NotificationsSheet(
    notifications: List<PracticeNotification>,
    attentionLabels: List<String>,
    onClose: () -> Unit,
    onSession: (String) -> Unit,
    onClient: (String) -> Unit,
) {
    CompasBottomSheet(onClose = onClose) {
        SheetHead("Уведомления", "События клиентов и задачи практики")
        Spacer(Modifier.height(14.dp))
        if (notifications.isEmpty() && attentionLabels.isEmpty()) {
            GlassCard(Modifier.fillMaxWidth(), padding = 18.dp) {
                Icon(Icons.Outlined.NotificationsNone, null, Modifier.size(28.dp), tint = CompasMutedFg)
                Spacer(Modifier.height(10.dp))
                Text("Новых событий нет", style = tSection, color = CompasFg)
                Text("Подтверждения, отмены, домашние задания и открытия документов появятся здесь.", style = tBody2)
            }
        } else {
            notifications.forEach { notification ->
                val action = when {
                    !notification.sessionId.isNullOrBlank() -> ({ onSession(notification.sessionId) })
                    !notification.clientId.isNullOrBlank() -> ({ onClient(notification.clientId) })
                    else -> null
                }
                NotificationRow(notification, action)
                Spacer(Modifier.height(8.dp))
            }
            if (attentionLabels.isNotEmpty()) {
                Spacer(Modifier.height(6.dp))
                Eyebrow("Требует внимания")
                Spacer(Modifier.height(8.dp))
                attentionLabels.forEach { label ->
                    GlassCard(Modifier.fillMaxWidth(), padding = 13.dp) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.PriorityHigh, null, Modifier.size(18.dp), tint = Orange)
                            Spacer(Modifier.width(9.dp))
                            Text(label, style = tBody2, color = CompasFg)
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        PrimaryButton("Готово", onClose, Modifier.fillMaxWidth(), Icons.Outlined.Check)
    }
}

@Composable
private fun NotificationRow(notification: PracticeNotification, onClick: (() -> Unit)?) {
    val icon = when (notification.type) {
        "session_confirmed" -> Icons.Outlined.EventAvailable
        "session_cancelled" -> Icons.Outlined.EventBusy
        "session_pending" -> Icons.Outlined.Schedule
        "homework_received" -> Icons.Outlined.AssignmentTurnedIn
        "document_opened" -> Icons.Outlined.Visibility
        "document_acknowledged" -> Icons.Outlined.VerifiedUser
        else -> Icons.Outlined.Notifications
    }
    GlassCard(Modifier.fillMaxWidth(), padding = 13.dp, onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(40.dp).clip(RoundedCornerShape(13.dp)).background(Sage100), contentAlignment = Alignment.Center) {
                Icon(icon, null, Modifier.size(20.dp), tint = Forest700)
            }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Text(notification.title, style = tBody, color = CompasFg)
                notification.subtitle?.let { Text(it, style = tBody2, maxLines = 2, overflow = TextOverflow.Ellipsis) }
                notification.createdAt?.let { Text(formatNotificationTime(it), style = tMeta, color = CompasMutedFg) }
            }
            if (onClick != null) Icon(Icons.Outlined.ChevronRight, null, Modifier.size(18.dp), tint = CompasMutedFg)
        }
    }
}

private fun statusDotColor(status: SessionStatus): Color = when (status) {
    SessionStatus.CONFIRMED -> Success
    SessionStatus.PENDING -> CompasAccent
    SessionStatus.CANCELLED, SessionStatus.NO_SHOW -> Red
    SessionStatus.COMPLETED -> CompasMutedFg
}

private fun durationMin(start: String, end: String): Int = try {
    Duration.between(LocalTime.parse(start), LocalTime.parse(end)).toMinutes().toInt().coerceAtLeast(0)
} catch (_: Exception) { 50 }

private fun untilLabel(start: String): String? = try {
    val minutes = Duration.between(LocalTime.now(), LocalTime.parse(start)).toMinutes()
    when {
        minutes <= 0 -> null
        minutes >= 60 -> "через ${minutes / 60} ч"
        else -> "через $minutes мин"
    }
} catch (_: Exception) { null }

private fun formatNotificationTime(raw: String): String {
    val value = runCatching { LocalDateTime.parse(raw.replace("Z", "")) }.getOrNull() ?: return ""
    return value.format(DateTimeFormatter.ofPattern("d MMM, HH:mm", Locale("ru")))
}
