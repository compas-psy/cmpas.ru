package ru.cmpas.app.presentation.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.*
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(
    onSessionClick: (String) -> Unit = {},
    onClientClick: (String) -> Unit = {},
    viewModel: CalendarViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    var selectedSessionId by remember { mutableStateOf<String?>(null) }
    val selectedSession = uiState.sessions.find { it.id == selectedSessionId }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(bottom = 80.dp), // dock space
    ) {
        // ─── Header ───
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    "Календарь",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                )
                Text(
                    uiState.selectedDate.format(DateTimeFormatter.ofPattern("d MMMM yyyy", Locale("ru"))),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = {}) {
                Icon(Icons.Outlined.FilterList, "Фильтр", tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            IconButton(onClick = {}) {
                Icon(Icons.Outlined.Settings, "Настройки", tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        // ─── View Mode Segment ───
        SingleChoiceSegmentedButtonRow(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 4.dp),
        ) {
            CalendarViewMode.entries.forEachIndexed { index, mode ->
                SegmentedButton(
                    selected = uiState.viewMode == mode,
                    onClick = { viewModel.setViewMode(mode) },
                    shape = SegmentedButtonDefaults.itemShape(index, CalendarViewMode.entries.size),
                ) {
                    Text(
                        when (mode) {
                            CalendarViewMode.DAY -> "День"
                            CalendarViewMode.WEEK -> "Неделя"
                            CalendarViewMode.MONTH -> "Месяц"
                            CalendarViewMode.LIST -> "Список"
                        },
                        style = MaterialTheme.typography.labelMedium,
                    )
                }
            }
        }

        // ─── Horizontal Date Strip ───
        HorizontalDateStrip(
            selectedDate = uiState.selectedDate,
            sessions = uiState.sessions,
            onDateSelect = { viewModel.selectDate(it) },
            modifier = Modifier.padding(vertical = 8.dp),
        )

        // ─── Sessions List ───
        val daySessions = uiState.sessions.filter { it.date == uiState.selectedDate.toString() }
            .sortedBy { it.startTime }

        if (uiState.isLoading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
        } else if (daySessions.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Outlined.CalendarMonth, null, Modifier.size(48.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(12.dp))
                    Text("Нет сессий", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                items(daySessions, key = { it.id }) { session ->
                    CalendarSessionRow(
                        session = session,
                        isCurrentTime = isCurrentSession(session),
                        onClick = { selectedSessionId = session.id },
                    )
                }
            }
        }
    }

    // ─── Session Bottom Sheet ───
    if (selectedSession != null) {
        SessionBottomSheet(
            session = selectedSession!!,
            onDismiss = { selectedSessionId = null },
            onOpenClient = { onClientClick(selectedSession!!.clientId) },
            onOpenSession = { onSessionClick(selectedSession!!.id) },
        )
    }
}

// ═══════════════════════════════════════════
// Horizontal Date Strip
// ═══════════════════════════════════════════

@Composable
fun HorizontalDateStrip(
    selectedDate: LocalDate,
    sessions: List<Session>,
    onDateSelect: (LocalDate) -> Unit,
    modifier: Modifier = Modifier,
) {
    val weekStart = selectedDate.minusDays(selectedDate.dayOfWeek.value.toLong() - 1)
    val days = (0L..6L).map { weekStart.plusDays(it) }
    val today = LocalDate.now()

    LazyRow(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        items(days) { date ->
            val isSelected = date == selectedDate
            val isToday = date == today
            val daySessionCount = sessions.count { it.date == date.toString() }

            Column(
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .clickable { onDateSelect(date) }
                    .then(
                        if (isSelected) Modifier.background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(12.dp))
                        else Modifier
                    )
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    date.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale("ru")).uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(4.dp))
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .then(
                            if (isToday && !isSelected) Modifier
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.primary)
                            else Modifier
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "${date.dayOfMonth}",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = if (isSelected || isToday) FontWeight.Bold else FontWeight.Normal,
                        color = when {
                            isToday && !isSelected -> MaterialTheme.colorScheme.onPrimary
                            isSelected -> MaterialTheme.colorScheme.primary
                            else -> MaterialTheme.colorScheme.onSurface
                        },
                    )
                }
                // Session count dots
                if (daySessionCount > 0) {
                    Spacer(Modifier.height(4.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        repeat(minOf(daySessionCount, 4)) {
                            Box(
                                Modifier
                                    .size(4.dp)
                                    .clip(CircleShape)
                                    .background(MaterialTheme.colorScheme.primary),
                            )
                        }
                    }
                }
            }
        }
    }
}

// ═══════════════════════════════════════════
// Calendar Session Row
// ═══════════════════════════════════════════

@Composable
private fun CalendarSessionRow(
    session: Session,
    isCurrentTime: Boolean,
    onClick: () -> Unit,
) {
    val cardColor = if (isCurrentTime)
        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
    else
        MaterialTheme.colorScheme.surface

    val borderModifier = if (isCurrentTime) {
        Modifier
    } else Modifier

    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = cardColor),
        border = if (isCurrentTime) CardDefaults.outlinedCardBorder() else null,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Status dot
            Box(
                Modifier
                    .size(10.dp)
                    .clip(CircleShape)
                    .background(
                        when (session.status) {
                            SessionStatus.CONFIRMED -> MaterialTheme.colorScheme.primary
                            SessionStatus.PENDING -> CompasOrange
                            SessionStatus.COMPLETED -> MaterialTheme.colorScheme.onSurfaceVariant
                            else -> MaterialTheme.colorScheme.error
                        }
                    ),
            )
            Spacer(Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    "${session.startTime} – ${session.endTime}",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    session.clientName,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Row {
                    if (session.isRecurring) {
                        Icon(Icons.Outlined.Replay, null, Modifier.size(14.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.width(4.dp))
                        Text(
                            "регулярная сессия",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            " · ${if (session.format == SessionFormat.ONLINE) "онлайн" else "офлайн"}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    } else {
                        Text(
                            if (session.format == SessionFormat.ONLINE) "онлайн" else "офлайн",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            // Series badge
            if (session.occurrenceIndex != null && session.seriesTotal != null) {
                SeriesBadge(session.occurrenceIndex, session.seriesTotal)
            }
            
            Spacer(Modifier.width(4.dp))
            Icon(Icons.Outlined.ChevronRight, null, Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
        }
    }
}

// ═══════════════════════════════════════════
// Session Bottom Sheet
// ═══════════════════════════════════════════

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionBottomSheet(
    session: Session,
    onDismiss: () -> Unit,
    onOpenClient: () -> Unit,
    onOpenSession: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
        containerColor = MaterialTheme.colorScheme.surface,
    ) {
        Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)) {
            // Client info
            Row(verticalAlignment = Alignment.CenterVertically) {
                AvatarCircle(name = session.clientName, size = 48.dp)
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(session.clientName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text(
                        "${session.startTime} – ${session.endTime} · ${if (session.endTime.isNotEmpty()) "${getMinutesBetween(session.startTime, session.endTime)} мин" else ""}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (session.occurrenceIndex == 1 || session.occurrenceIndex == null && !session.isRecurring) {
                    StatusBadge("Первая встреча", BadgeFirstMeetBg, BadgeFirstMeetText)
                }
            }

            Spacer(Modifier.height(12.dp))

            // Format + payment
            Row {
                Text(
                    "${if (session.format == SessionFormat.ONLINE) "Онлайн" else "Офлайн"}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (session.paymentStatus == PaymentStatus.UNPAID) {
                    Text(" · ", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Не оплачено", style = MaterialTheme.typography.bodyMedium, color = CompasDestructive)
                }
            }

            Spacer(Modifier.height(16.dp))

            // Action buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                BottomSheetAction(Icons.Outlined.Person, "Открыть\nкарточку", Modifier.weight(1f)) { onOpenClient(); onDismiss() }
                BottomSheetAction(Icons.Outlined.Videocam, "Открыть\nвстречу", Modifier.weight(1f)) {}
                BottomSheetAction(Icons.Outlined.SwapHoriz, "Перенести", Modifier.weight(1f)) {}
                BottomSheetAction(Icons.Outlined.Replay, "Занять слот\nчерез неделю", Modifier.weight(1f)) {}
                BottomSheetAction(Icons.Outlined.CreditCard, "Отметить\nоплату", Modifier.weight(1f)) {}
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun BottomSheetAction(
    icon: ImageVector,
    label: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(icon, null, Modifier.size(24.dp), tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(4.dp))
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
            maxLines = 2,
        )
    }
}

// ═══════════════════════════════════════════
// Utils
// ═══════════════════════════════════════════

private fun isCurrentSession(session: Session): Boolean {
    return try {
        val now = java.time.LocalTime.now()
        val parts = session.startTime.split(":")
        val start = java.time.LocalTime.of(parts[0].toInt(), parts[1].toInt())
        val endParts = session.endTime.split(":")
        val end = java.time.LocalTime.of(endParts[0].toInt(), endParts[1].toInt())
        session.date == LocalDate.now().toString() && now in start..end
    } catch (_: Exception) { false }
}

private fun getMinutesBetween(start: String, end: String): Int {
    return try {
        val sp = start.split(":"); val ep = end.split(":")
        (ep[0].toInt() * 60 + ep[1].toInt()) - (sp[0].toInt() * 60 + sp[1].toInt())
    } catch (_: Exception) { 50 }
}
