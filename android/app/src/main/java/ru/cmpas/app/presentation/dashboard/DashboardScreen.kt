package ru.cmpas.app.presentation.dashboard

import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.R
import ru.cmpas.app.domain.model.*
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*
import java.time.Duration
import java.time.LocalDate
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

    if (uiState.isLoading && !uiState.isDataLoaded) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
        }
        return
    }

    if (uiState.error != null && !uiState.isDataLoaded) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Outlined.CloudOff, null, Modifier.size(48.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(12.dp))
                Text(uiState.error ?: "Ошибка", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(16.dp))
                OutlinedButton(onClick = { viewModel.loadDashboard() }) { Text("Повторить") }
            }
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 100.dp), // space for floating dock
    ) {
        // ─── Header ───
        item {
            TodayHeader(
                userName = uiState.userName,
                todayFormatted = uiState.todayFormatted,
            )
        }

        // ─── Hero: Next Session ───
        uiState.nextSession?.let { session ->
            item {
                NextSessionHeroCard(
                    session = session,
                    onClick = { onSessionClick(session.id) },
                    onClientClick = { onClientClick(session.clientId) },
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
        }

        // ─── Smart Actions ───
        if (uiState.nextSession != null) {
            item {
                SmartActionsSection(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
            }
        }

        // ─── Today's Schedule ───
        item {
            SectionHeader(
                title = "Сегодня",
                actionText = "Смотреть календарь",
                onAction = onCalendarClick,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            )
        }

        if (uiState.todaySessions.isEmpty()) {
            item {
                EmptyDayCard(modifier = Modifier.padding(horizontal = 16.dp))
            }
        } else {
            items(uiState.todaySessions, key = { it.id }) { session ->
                SessionTimelineRow(
                    session = session,
                    onClick = { onSessionClick(session.id) },
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }
        }

        // ─── Attention Cards ───
        if (uiState.attentionItems.isNotEmpty()) {
            item {
                SectionHeader(
                    title = "Требует внимания",
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }
            item {
                AttentionSection(
                    items = uiState.attentionItems,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
        }
    }
}

// ═══════════════════════════════════════════
// Header: greeting + date + avatar + bell
// ═══════════════════════════════════════════

@Composable
private fun TodayHeader(userName: String?, todayFormatted: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Image(
            painter = painterResource(id = R.drawable.logo_tree),
            contentDescription = null,
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape),
            contentScale = ContentScale.Fit,
        )
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "${getGreeting()}${if (userName != null) ", $userName" else ""}",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onBackground,
            )
            Text(
                text = todayFormatted,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        IconButton(onClick = { }) {
            Icon(
                Icons.Outlined.Notifications,
                contentDescription = "Уведомления",
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

// ═══════════════════════════════════════════
// Hero Card: Next Session
// ═══════════════════════════════════════════

@Composable
private fun NextSessionHeroCard(
    session: Session,
    onClick: () -> Unit,
    onClientClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            // Label
            Text(
                "Следующая сессия",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(12.dp))

            // Client + Time row
            Row(verticalAlignment = Alignment.Top) {
                AvatarCircle(name = session.clientName, size = 48.dp)
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        session.clientName,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    if (session.occurrenceIndex != null) {
                        Text(
                            "${session.occurrenceIndex}-я сессия",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    // Time remaining
                    val minutesUntil = getMinutesUntil(session.startTime)
                    if (minutesUntil != null && minutesUntil > 0) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.Schedule, null, Modifier.size(14.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                            Spacer(Modifier.width(4.dp))
                            Text(
                                "через $minutesUntil мин",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
                // Time block
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.primaryContainer,
                ) {
                    Column(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(
                            "${session.startTime}–${session.endTime}",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        Text(
                            "${if (session.format == SessionFormat.ONLINE) "Онлайн" else "Офлайн"} · ${if (session.format == SessionFormat.ONLINE) "Zoom" else "Кабинет"}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
            }

            // Previous notes summary
            if (!session.previousNotesSummary.isNullOrBlank()) {
                Spacer(Modifier.height(12.dp))
                Text(
                    session.previousNotesSummary!!,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                )
            }

            // Action buttons
            Spacer(Modifier.height(16.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                HeroActionButton(Icons.Outlined.Videocam, "Открыть\nZoom", Modifier.weight(1f)) {}
                HeroActionButton(Icons.Outlined.Description, "Подгото-\nвиться", Modifier.weight(1f)) {}
                HeroActionButton(Icons.Outlined.CreditCard, "Оплата", Modifier.weight(1f)) {}
                HeroActionButton(Icons.Outlined.Person, "Карточка", Modifier.weight(1f)) { onClientClick() }
            }
        }
    }
}

@Composable
private fun HeroActionButton(
    icon: ImageVector,
    label: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.height(64.dp),
        shape = RoundedCornerShape(12.dp),
        contentPadding = PaddingValues(4.dp),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(icon, null, Modifier.size(20.dp))
            Spacer(Modifier.height(2.dp))
            Text(
                label,
                style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp, lineHeight = 12.sp),
                maxLines = 2,
            )
        }
    }
}

// ═══════════════════════════════════════════
// Smart Actions
// ═══════════════════════════════════════════

@Composable
private fun SmartActionsSection(modifier: Modifier = Modifier) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                "Умные действия",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SmartActionChip("Занять тот же слот\nчерез неделю", Icons.Outlined.Replay, {}, Modifier.weight(1f))
                SmartActionChip("Продлить серию", Icons.Outlined.TrendingUp, {}, Modifier.weight(1f))
            }
            Spacer(Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SmartActionChip("Изменить слот", Icons.Outlined.Edit, {}, Modifier.weight(1f))
                SmartActionChip("Пауза", Icons.Outlined.PauseCircle, {}, Modifier.weight(1f))
            }
        }
    }
}

// ═══════════════════════════════════════════
// Session Timeline Row
// ═══════════════════════════════════════════

@Composable
private fun SessionTimelineRow(
    session: Session,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Time column
            Column(horizontalAlignment = Alignment.Start) {
                Text(
                    session.startTime,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "–${session.endTime}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(Modifier.width(12.dp))

            // Avatar
            AvatarCircle(name = session.clientName, size = 36.dp)
            Spacer(Modifier.width(10.dp))

            // Name + format
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    session.clientName,
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "${if (session.format == SessionFormat.ONLINE) "Онлайн" else "Офлайн"} · ${if (session.format == SessionFormat.ONLINE) "Zoom" else "Кабинет"}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // Status badge
            when {
                session.homeworkStatus == HomeworkStatus.DONE || session.homeworkStatus == HomeworkStatus.PARTIAL ->
                    HomeworkBadge(session.homeworkStatus)
                session.paymentStatus == PaymentStatus.PAID ->
                    PaymentBadge(PaymentStatus.PAID)
                session.consentStatus == ConsentStatus.MISSING ->
                    ConsentBadge(ConsentStatus.MISSING)
                else -> {}
            }

            Spacer(Modifier.width(4.dp))
            Icon(
                Icons.Outlined.ChevronRight,
                null,
                Modifier.size(20.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
            )
        }
    }
}

// ═══════════════════════════════════════════
// Attention Section
// ═══════════════════════════════════════════

@Composable
private fun AttentionSection(
    items: List<AttentionItem>,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            items.forEachIndexed { index, item ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        when (item.type) {
                            "consent" -> Icons.Outlined.Description
                            "payment" -> Icons.Outlined.CreditCard
                            "report" -> Icons.Outlined.Send
                            else -> Icons.Outlined.Warning
                        },
                        null,
                        Modifier.size(20.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.width(12.dp))
                    Text(
                        item.label,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
                if (index < items.lastIndex) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                }
            }
        }
    }
}

// ═══════════════════════════════════════════
// Empty Day
// ═══════════════════════════════════════════

@Composable
private fun EmptyDayCard(modifier: Modifier = Modifier) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(Icons.Outlined.CalendarMonth, null, Modifier.size(48.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(12.dp))
            Text("Свободный день", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurface)
            Text("Нет запланированных сессий", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

// ═══════════════════════════════════════════
// Utils
// ═══════════════════════════════════════════

private fun getGreeting(): String {
    val hour = java.time.LocalTime.now().hour
    return when {
        hour < 6 -> "Доброй ночи"
        hour < 12 -> "Доброе утро"
        hour < 18 -> "Добрый день"
        else -> "Добрый вечер"
    }
}

private fun getMinutesUntil(startTime: String): Long? {
    return try {
        val parts = startTime.split(":")
        val sessionTime = LocalTime.of(parts[0].toInt(), parts[1].toInt())
        val now = LocalTime.now()
        val duration = Duration.between(now, sessionTime)
        if (duration.toMinutes() > 0) duration.toMinutes() else null
    } catch (_: Exception) { null }
}
