package ru.cmpas.app.presentation.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.*
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
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
            .padding(bottom = 100.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Календарь", style = MaterialTheme.typography.titleLarge)
                Text(
                    uiState.selectedDate.format(DateTimeFormatter.ofPattern("d MMMM yyyy", Locale("ru"))),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = {}) {
                Icon(Icons.Outlined.FilterList, "Фильтр", tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        CompasSegmentedControl(
            items = listOf("День", "Неделя", "Месяц", "Список"),
            selectedIndex = uiState.viewMode.ordinal,
            onSelect = { viewModel.setViewMode(CalendarViewMode.entries[it]) },
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
        )

        when (uiState.viewMode) {
            CalendarViewMode.DAY -> DayView(uiState, viewModel, onSelect = { selectedSessionId = it })
            CalendarViewMode.WEEK -> WeekView(uiState, viewModel, onSelect = { selectedSessionId = it })
            CalendarViewMode.MONTH -> MonthView(uiState, viewModel, onSelect = { selectedSessionId = it })
            CalendarViewMode.LIST -> ListView(uiState, onSelect = { selectedSessionId = it })
        }
    }

    if (selectedSession != null) {
        SessionBottomSheet(
            session = selectedSession,
            onDismiss = { selectedSessionId = null },
            onOpenClient = { onClientClick(selectedSession.clientId) },
            onOpenSession = { onSessionClick(selectedSession.id) },
        )
    }
}

@Composable
fun CompasSegmentedControl(
    items: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
    ) {
        Row(modifier = Modifier.padding(3.dp)) {
            items.forEachIndexed { index, label ->
                val isSelected = index == selectedIndex
                Surface(
                    modifier = Modifier.weight(1f),
                    onClick = { onSelect(index) },
                    shape = RoundedCornerShape(12.dp),
                    color = if (isSelected) MaterialTheme.colorScheme.surface else
                        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0f),
                    shadowElevation = if (isSelected) 2.dp else 0.dp,
                ) {
                    Text(
                        label,
                        modifier = Modifier.padding(vertical = 10.dp),
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                        color = if (isSelected) MaterialTheme.colorScheme.primary
                            else MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
    }
}

@Composable
private fun DayView(uiState: CalendarUiState, viewModel: CalendarViewModel, onSelect: (String) -> Unit) {
    HorizontalDateStrip(uiState.selectedDate, uiState.sessions, { viewModel.selectDate(it) }, Modifier.padding(vertical = 8.dp))
    val daySessions = uiState.sessions.filter { it.date == uiState.selectedDate.toString() }.sortedBy { it.startTime }
    SessionList(daySessions, uiState.isLoading, onSelect)
}

@Composable
private fun WeekView(uiState: CalendarUiState, viewModel: CalendarViewModel, onSelect: (String) -> Unit) {
    val weekStart = uiState.selectedDate.with(DayOfWeek.MONDAY)
    val weekDays = (0L..6L).map { weekStart.plusDays(it) }
    val weekSessions = uiState.sessions.filter {
        val d = try { LocalDate.parse(it.date) } catch (_: Exception) { null }
        d != null && !d.isBefore(weekDays.first()) && !d.isAfter(weekDays.last())
    }

    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)),
    ) {
        Row(Modifier.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            WeekStat("${weekSessions.size}", "сессий")
            val free = weekDays.count { d -> weekSessions.none { it.date == d.toString() } }
            WeekStat("$free", "свободных дней")
        }
    }

    HorizontalDateStrip(uiState.selectedDate, uiState.sessions, { viewModel.selectDate(it) }, Modifier.padding(vertical = 4.dp))

    val daySessions = uiState.sessions.filter { it.date == uiState.selectedDate.toString() }.sortedBy { it.startTime }
    SessionList(daySessions, uiState.isLoading, onSelect)
}

@Composable
private fun WeekStat(value: String, label: String) {
    Column {
        Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun MonthView(uiState: CalendarUiState, viewModel: CalendarViewModel, onSelect: (String) -> Unit) {
    val ym = YearMonth.of(uiState.selectedDate.year, uiState.selectedDate.month)
    val firstDay = ym.atDay(1)
    val daysInMonth = ym.lengthOfMonth()
    val startOffset = (firstDay.dayOfWeek.value - 1)
    val today = LocalDate.now()

    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
        listOf("Пн","Вт","Ср","Чт","Пт","Сб","Вс").forEach {
            Text(it, Modifier.weight(1f), textAlign = TextAlign.Center, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }

    val cells = startOffset + daysInMonth
    val rows = (cells + 6) / 7
    Column(Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
        for (row in 0 until rows) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                for (col in 0..6) {
                    val idx = row * 7 + col - startOffset
                    if (idx in 0 until daysInMonth) {
                        val date = ym.atDay(idx + 1)
                        val isSelected = date == uiState.selectedDate
                        val isToday = date == today
                        val count = uiState.sessions.count { it.date == date.toString() }
                        MonthDayCell(date.dayOfMonth, isSelected, isToday, count, Modifier.weight(1f)) {
                            viewModel.selectDate(date)
                        }
                    } else {
                        Spacer(Modifier.weight(1f))
                    }
                }
            }
        }
    }

    Spacer(Modifier.height(8.dp))
    val daySessions = uiState.sessions.filter { it.date == uiState.selectedDate.toString() }.sortedBy { it.startTime }
    SessionList(daySessions, uiState.isLoading, onSelect)
}

@Composable
private fun MonthDayCell(day: Int, isSelected: Boolean, isToday: Boolean, sessionCount: Int, modifier: Modifier, onClick: () -> Unit) {
    Column(
        modifier = modifier.clip(RoundedCornerShape(8.dp)).clickable(onClick = onClick).padding(vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier.size(32.dp)
                .then(if (isSelected) Modifier.clip(CircleShape).background(MaterialTheme.colorScheme.primary)
                    else if (isToday) Modifier.clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer)
                    else Modifier),
            contentAlignment = Alignment.Center,
        ) {
            Text("$day", style = MaterialTheme.typography.bodySmall,
                color = if (isSelected) MaterialTheme.colorScheme.onPrimary
                    else if (isToday) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.onSurface,
                fontWeight = if (isSelected || isToday) FontWeight.Bold else FontWeight.Normal)
        }
        if (sessionCount > 0) {
            Row(horizontalArrangement = Arrangement.spacedBy(1.dp)) {
                repeat(minOf(sessionCount, 3)) {
                    Box(Modifier.size(4.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primary))
                }
            }
        }
    }
}

@Composable
private fun ListView(uiState: CalendarUiState, onSelect: (String) -> Unit) {
    val today = LocalDate.now()
    val tomorrow = today.plusDays(1)
    val weekEnd = today.with(DayOfWeek.SUNDAY)
    val nextWeekEnd = weekEnd.plusDays(7)

    val groups = linkedMapOf(
        "Сегодня" to mutableListOf<Session>(),
        "Завтра" to mutableListOf(),
        "Эта неделя" to mutableListOf(),
        "Следующая неделя" to mutableListOf(),
        "Позже" to mutableListOf(),
    )
    uiState.sessions.sortedBy { it.date + it.startTime }.forEach { s ->
        val d = try { LocalDate.parse(s.date) } catch (_: Exception) { null } ?: return@forEach
        when {
            d == today -> groups["Сегодня"]!!.add(s)
            d == tomorrow -> groups["Завтра"]!!.add(s)
            !d.isAfter(weekEnd) -> groups["Эта неделя"]!!.add(s)
            !d.isAfter(nextWeekEnd) -> groups["Следующая неделя"]!!.add(s)
            else -> groups["Позже"]!!.add(s)
        }
    }

    LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        groups.filter { it.value.isNotEmpty() }.forEach { (label, sessions) ->
            item { SectionHeader(title = label, modifier = Modifier.padding(vertical = 4.dp)) }
            items(sessions, key = { it.id }) { session ->
                CalendarSessionRow(session, isCurrentSession(session)) { onSelect(session.id) }
            }
        }
    }
}

@Composable
private fun SessionList(sessions: List<Session>, isLoading: Boolean, onSelect: (String) -> Unit) {
    if (isLoading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = MaterialTheme.colorScheme.primary) }
    } else if (sessions.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Outlined.CalendarMonth, null, Modifier.size(48.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(12.dp))
                Text("Нет сессий", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    } else {
        LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            items(sessions, key = { it.id }) { s -> CalendarSessionRow(s, isCurrentSession(s)) { onSelect(s.id) } }
        }
    }
}

@Composable
fun HorizontalDateStrip(selectedDate: LocalDate, sessions: List<Session>, onDateSelect: (LocalDate) -> Unit, modifier: Modifier = Modifier) {
    val weekStart = selectedDate.minusDays(selectedDate.dayOfWeek.value.toLong() - 1)
    val days = (0L..6L).map { weekStart.plusDays(it) }
    val today = LocalDate.now()
    LazyRow(modifier = modifier.fillMaxWidth(), contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        items(days) { date ->
            val isSelected = date == selectedDate; val isToday = date == today
            val count = sessions.count { it.date == date.toString() }
            Column(
                modifier = Modifier.clip(RoundedCornerShape(12.dp)).clickable { onDateSelect(date) }
                    .then(if (isSelected) Modifier.background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(12.dp)) else Modifier)
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(date.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale("ru")).uppercase(), style = MaterialTheme.typography.labelSmall,
                    color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(4.dp))
                Box(Modifier.size(36.dp).then(if (isToday && !isSelected) Modifier.clip(CircleShape).background(MaterialTheme.colorScheme.primary) else Modifier), contentAlignment = Alignment.Center) {
                    Text("${date.dayOfMonth}", style = MaterialTheme.typography.titleSmall,
                        fontWeight = if (isSelected || isToday) FontWeight.Bold else FontWeight.Normal,
                        color = when { isToday && !isSelected -> MaterialTheme.colorScheme.onPrimary; isSelected -> MaterialTheme.colorScheme.primary; else -> MaterialTheme.colorScheme.onSurface })
                }
                if (count > 0) { Spacer(Modifier.height(4.dp)); Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) { repeat(minOf(count, 4)) { Box(Modifier.size(4.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primary)) } } }
            }
        }
    }
}

@Composable
private fun CalendarSessionRow(session: Session, isCurrentTime: Boolean, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = if (isCurrentTime) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f) else MaterialTheme.colorScheme.surface),
        border = if (isCurrentTime) CardDefaults.outlinedCardBorder() else null) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(10.dp).clip(CircleShape).background(when (session.status) {
                SessionStatus.CONFIRMED -> MaterialTheme.colorScheme.primary; SessionStatus.PENDING -> CompasOrange
                SessionStatus.COMPLETED -> MaterialTheme.colorScheme.onSurfaceVariant; else -> MaterialTheme.colorScheme.error }))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text("${session.startTime} – ${session.endTime}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Text(session.clientName, style = MaterialTheme.typography.bodyMedium)
                Row {
                    if (session.isRecurring) { Icon(Icons.Outlined.Replay, null, Modifier.size(14.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant); Spacer(Modifier.width(4.dp))
                        Text("регулярная · ", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    Text(if (session.format == SessionFormat.ONLINE) "онлайн" else "офлайн", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            if (session.occurrenceIndex != null && session.seriesTotal != null) SeriesBadge(session.occurrenceIndex, session.seriesTotal)
            Spacer(Modifier.width(4.dp)); Icon(Icons.Outlined.ChevronRight, null, Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionBottomSheet(session: Session, onDismiss: () -> Unit, onOpenClient: () -> Unit, onOpenSession: () -> Unit) {
    val uriHandler = LocalUriHandler.current
    ModalBottomSheet(onDismissRequest = onDismiss, shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp), containerColor = MaterialTheme.colorScheme.surface) {
        Column(Modifier.padding(horizontal = 20.dp, vertical = 8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                AvatarCircle(name = session.clientName, size = 48.dp); Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(session.clientName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text("${session.startTime} – ${session.endTime} · ${getMinutesBetween(session.startTime, session.endTime)} мин",
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (session.occurrenceIndex == 1 || (session.occurrenceIndex == null && !session.isRecurring)) StatusBadge("Первая встреча", BadgeFirstMeetBg, BadgeFirstMeetText)
            }
            Spacer(Modifier.height(12.dp))
            Row { Text("${if (session.format == SessionFormat.ONLINE) "Онлайн" else "Офлайн"}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (session.paymentStatus == PaymentStatus.UNPAID) { Text(" · ", color = MaterialTheme.colorScheme.onSurfaceVariant); Text("Не оплачено", color = CompasDestructive) } }
            Spacer(Modifier.height(16.dp))

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                BottomSheetAction(Icons.Outlined.Person, "Карточка", Modifier.weight(1f)) { onOpenClient(); onDismiss() }
                BottomSheetAction(Icons.Outlined.Videocam, "Встреча", Modifier.weight(1f)) {
                    session.videoLink?.takeIf { it.isNotBlank() }?.let { uriHandler.openUri(it) } ?: onOpenSession()
                    onDismiss()
                }
                BottomSheetAction(Icons.Outlined.SwapHoriz, "Перенести", Modifier.weight(1f)) { onOpenSession(); onDismiss() }
                BottomSheetAction(Icons.Outlined.CreditCard, "Оплата", Modifier.weight(1f)) { onOpenSession(); onDismiss() }
            }

            Spacer(Modifier.height(16.dp))
            Text("Что дальше", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                NextStepRow(Icons.Outlined.Replay, "Занять тот же слот через неделю") { onOpenSession(); onDismiss() }
                if (!session.isRecurring) NextStepRow(Icons.Outlined.Lock, "Закрепить регулярный слот") { onOpenSession(); onDismiss() }
                if (session.isRecurring) NextStepRow(Icons.Outlined.SkipNext, "Пропустить неделю") { onOpenSession(); onDismiss() }
                if (session.seriesId != null || session.seriesTotal != null) NextStepRow(Icons.Outlined.TrendingUp, "Продлить серию") { onOpenSession(); onDismiss() }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun NextStepRow(icon: ImageVector, label: String, onClick: () -> Unit) {
    Surface(onClick = onClick, shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, Modifier.size(20.dp), tint = MaterialTheme.colorScheme.primary); Spacer(Modifier.width(12.dp))
            Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface)
        }
    }
}

@Composable
private fun BottomSheetAction(icon: ImageVector, label: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Column(modifier.clip(RoundedCornerShape(12.dp)).clickable(onClick = onClick).padding(vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(icon, null, Modifier.size(24.dp), tint = MaterialTheme.colorScheme.primary); Spacer(Modifier.height(4.dp))
        Text(label, style = MaterialTheme.typography.labelSmall.copy(fontSize = 12.sp), color = MaterialTheme.colorScheme.onSurface, textAlign = TextAlign.Center, maxLines = 2)
    }
}

private fun isCurrentSession(session: Session): Boolean {
    return try { val now = java.time.LocalTime.now(); val s = session.startTime.split(":"); val e = session.endTime.split(":")
        val start = java.time.LocalTime.of(s[0].toInt(), s[1].toInt()); val end = java.time.LocalTime.of(e[0].toInt(), e[1].toInt())
        session.date == LocalDate.now().toString() && !now.isBefore(start) && !now.isAfter(end) } catch (_: Exception) { false }
}

private fun getMinutesBetween(start: String, end: String): Int {
    return try { val sp = start.split(":"); val ep = end.split(":"); (ep[0].toInt() * 60 + ep[1].toInt()) - (sp[0].toInt() * 60 + sp[1].toInt()) } catch (_: Exception) { 50 }
}
