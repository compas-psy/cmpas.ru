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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.R
import ru.cmpas.app.domain.model.*
import ru.cmpas.app.presentation.components.*
import java.time.Duration
import java.time.LocalTime

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
        contentPadding = PaddingValues(bottom = 128.dp),
    ) {
        item {
            TodayHeader(
                userName = uiState.userName,
                todayFormatted = uiState.todayFormatted,
            )
        }

        uiState.nextSession?.let { session ->
            item {
                NextSessionHeroCard(
                    session = session,
                    onClick = { onSessionClick(session.id) },
                    onClientClick = { onClientClick(session.clientId) },
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }

            item {
                SmartActionsSection(
                    session = session,
                    onOpenSession = { onSessionClick(session.id) },
                    onOpenCalendar = onCalendarClick,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }
        }

        item {
            SectionHeader(
                title = "Сегодня",
                actionText = "Смотреть календарь",
                onAction = onCalendarClick,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            )
        }

        if (uiState.todaySessions.isEmpty()) {
            item { EmptyDayCard(modifier = Modifier.padding(horizontal = 16.dp)) }
        } else {
            items(uiState.todaySessions, key = { it.id }) { session ->
                SessionTimelineRow(
                    session = session,
                    onClick = { onSessionClick(session.id) },
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }
        }

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

@Composable
private fun TodayHeader(userName: String?, todayFormatted: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            // statusBarsPadding is applied once in CompasNavHost for every app screen.
            .padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 16.dp),
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

@Composable
private fun NextSessionHeroCard(
    session: Session,
    onClick: () -> Unit,
    onClientClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val uriHandler = LocalUriHandler.current

    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text(
                "Следующая сессия",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(12.dp))

            Row(verticalAlignment = Alignment.Top) {
                AvatarCircle(name = session.clientName, size = 52.dp)
                Spacer(Modifier.width(14.dp))
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
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    val minutesUntil = getMinutesUntil(session.startTime)
                    if (minutesUntil != null && minutesUntil > 0) {
                        Spacer(Modifier.height(4.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.Schedule, null, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                            Spacer(Modifier.width(4.dp))
                            Text(
                                "через $minutesUntil мин",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.primaryContainer,
                ) {
                    Column(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
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
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
            }

            if (!session.previousNotesSummary.isNullOrBlank()) {
                Spacer(Modifier.height(12.dp))
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                ) {
                    Text(
                        session.previousNotesSummary!!,
                        modifier = Modifier.padding(12.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                    )
                }
            }

            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                PaymentBadge(session.paymentStatus)
                ConsentBadge(session.consentStatus)
                HomeworkBadge(session.homeworkStatus)
                if (session.occurrenceIndex != null && session.seriesTotal != null) {
                    SeriesBadge(session.occurrenceIndex, session.seriesTotal)
                }
            }

            Spacer(Modifier.height(16.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                HeroActionButton(Icons.Outlined.Videocam, "Открыть\nZoom", Modifier.weight(1f)) {
                    session.meetingUrl?.takeIf { it.isNotBlank() }?.let { uriHandler.openUri(it) } ?: onClick()
                }
                HeroActionButton(Icons.Outlined.Description, "Подгото-\nвиться", Modifier.weight(1f)) { onClick() }
                HeroActionButton(Icons.Outlined.CreditCard, "Оплата", Modifier.weight(1f)) { onClick() }
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
    Surface(
        modifier = modifier.height(80.dp),
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        border = ButtonDefaults.outlinedButtonBorder(enabled = true),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(4.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Icon(icon, null, Modifier.size(22.dp), tint = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.height(4.dp))
            Text(
                label,
                style = MaterialTheme.typography.labelSmall.copy(fontSize = 12.sp, lineHeight = 14.sp),
                maxLines = 2,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

@Composable
private fun SmartActionsSection(
    session: Session,
    onOpenSession: () -> Unit,
    onOpenCalendar: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val actions = buildList {
        if (session.isRecurring) add(Triple("Занять тот же слот\nчерез неделю", Icons.Outlined.Replay, onOpenCalendar))
        if (session.seriesTotal != null) add(Triple("Продлить серию", Icons.Outlined.TrendingUp, onOpenCalendar))
        if (session.paymentStatus == PaymentStatus.UNPAID || session.paymentStatus == PaymentStatus.PARTIAL) add(Triple("Отметить оплату", Icons.Outlined.CreditCard, onOpenSession))
        if (session.consentStatus == ConsentStatus.MISSING || session.consentStatus == ConsentStatus.EXPIRED) add(Triple("Запросить согласие", Icons.Outlined.Description, onOpenSession))
        if (size < 2) add(Triple("Изменить слот", Icons.Outlined.Edit, onOpenCalendar))
        if (size < 4) add(Triple("Пауза", Icons.Outlined.PauseCircle, onOpenCalendar))
    }

    if (actions.isEmpty()) return

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
            Spacer(Modifier.height(10.dp))
            actions.chunked(2).forEachIndexed { index, row ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    row.forEach { (label, icon, onClick) ->
                        SmartActionChip(label, icon, onClick, Modifier.weight(1f))
                    }
                    if (row.size == 1) Spacer(Modifier.weight(1f))
                }
                if (index < actions.chunked(2).lastIndex) Spacer(Modifier.height(8.dp))
            }
        }
    }
}

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
            AvatarCircle(name = session.clientName, size = 36.dp)
            Spacer(Modifier.width(10.dp))
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

            when {
                session.homeworkStatus == HomeworkStatus.DONE || session.homeworkStatus == HomeworkStatus.PARTIAL -> HomeworkBadge(session.homeworkStatus)
                session.paymentStatus == PaymentStatus.PAID -> PaymentBadge(PaymentStatus.PAID)
                session.consentStatus == ConsentStatus.MISSING -> ConsentBadge(ConsentStatus.MISSING)
                else -> {}
            }
            Spacer(Modifier.width(4.dp))
            Icon(Icons.Outlined.ChevronRight, null, Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
        }
    }
}

@Composable
private fun AttentionSection(items: List<AttentionItem>, modifier: Modifier = Modifier) {
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
                    Text(item.label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface)
                }
                if (index < items.lastIndex) HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
            }
        }
    }
}

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

private fun getGreeting(): String {
    val hour = LocalTime.now().hour
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
