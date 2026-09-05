package ru.cmpas.app.presentation.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.domain.model.SessionFormat
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun CalendarScreen(
    onSessionClick: (String) -> Unit = {},
    onClientClick: (String) -> Unit = {},
    onAddSession: () -> Unit = {},
    onWorkingHoursClick: () -> Unit = {},
    onAddressesClick: () -> Unit = {},
    viewModel: CalendarViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val sel = uiState.selectedDate
    val uriHandler = LocalUriHandler.current
    var tuneOpen by remember { mutableStateOf(false) }
    var blockOpen by remember { mutableStateOf(false) }

    // Форма закрывается только по подтверждению сервера — не по нажатию
    // кнопки. Пока блокировки нет в базе, её нет вообще.
    LaunchedEffect(uiState.blockSaved) {
        if (uiState.blockSaved) {
            blockOpen = false
            viewModel.consumeBlockSaved()
        }
    }
    val daySessions = remember(uiState.sessions, sel) {
        uiState.sessions.filter { it.date == sel.toString() }.sortedBy { it.startTime }
    }

    Box(Modifier.fillMaxSize().background(CompasBg)) {
        Ambient()
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 10.dp, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Eyebrow("Расписание")
                        Spacer(Modifier.height(4.dp))
                        Text("Календарь", style = tHero, color = CompasFg)
                    }
                    // Задача 22: здесь была кнопка «Фильтр» с пустым
                    // обработчиком — нажатие не делало ничего.
                    IconButtonGlass(Icons.Outlined.Tune, "Настройки календаря", onClick = { tuneOpen = true })
                }
            }

            item {
                CompasSegmented(
                    options = listOf("День", "Неделя", "Месяц", "Список"),
                    selectedIndex = uiState.viewMode.ordinal,
                    onSelect = { viewModel.setViewMode(CalendarViewMode.entries[it]) },
                )
            }

            if (uiState.viewMode == CalendarViewMode.MONTH) {
                item {
                    MonthGrid(
                        selected = sel,
                        sessions = uiState.sessions,
                        onPrev = { viewModel.selectDate(sel.minusMonths(1).withDayOfMonth(1)) },
                        onNext = { viewModel.selectDate(sel.plusMonths(1).withDayOfMonth(1)) },
                        onPick = { viewModel.selectDate(it) },
                    )
                }
            }

            item {
                val title = if (sel == LocalDate.now()) "Сегодня"
                else sel.format(DateTimeFormatter.ofPattern("d MMMM", Locale("ru")))
                SectionTitle("$title · ${daySessions.size} ${sessionsWord(daySessions.size)}", actionLabel = "Записать", onAction = onAddSession)
            }

            val agenda = if (uiState.viewMode == CalendarViewMode.LIST) uiState.sessions.sortedWith(compareBy({ it.date }, { it.startTime })) else daySessions
            if (agenda.isEmpty()) {
                item { GlassCard(padding = 18.dp) { Text("Нет записей на этот день", style = tBody2) } }
            } else {
                items(agenda, key = { it.id }) { s -> AgendaRow(s, onClick = { onSessionClick(s.id) }) }
            }
        }

        if (tuneOpen) {
            CalendarTuneSheet(
                onClose = { tuneOpen = false },
                onAction = { action ->
                    tuneOpen = false
                    when (action) {
                        // Свои экраны уже есть — второго расписания и второго
                        // списка кабинетов заводить не нужно.
                        CalendarTuneAction.WORKING_HOURS -> onWorkingHoursClick()
                        CalendarTuneAction.CABINETS -> onAddressesClick()
                        CalendarTuneAction.BLOCK_TIME -> blockOpen = true
                        // Нативного экрана синхронизации нет: открывается
                        // настоящая веб-настройка, а не нарисованная заглушка.
                        CalendarTuneAction.CALENDAR_SYNC -> runCatching { uriHandler.openUri(CALENDAR_SYNC_URL) }
                    }
                },
            )
        }

        if (blockOpen) {
            BlockTimeSheet(
                today = LocalDate.now(),
                isSaving = uiState.isSavingBlock,
                error = uiState.blockError,
                onClose = {
                    blockOpen = false
                    viewModel.dismissBlockError()
                },
                onSave = { date, startTime, endTime, reason ->
                    viewModel.createBlock(date, startTime, endTime, reason)
                },
            )
        }
    }
}

@Composable
private fun MonthGrid(
    selected: LocalDate,
    sessions: List<Session>,
    onPrev: () -> Unit,
    onNext: () -> Unit,
    onPick: (LocalDate) -> Unit,
) {
    val ym = YearMonth.from(selected)
    val firstDow = ym.atDay(1).dayOfWeek.value // 1=Mon..7=Sun
    val daysInMonth = ym.lengthOfMonth()
    val cells = buildList<Int?> {
        repeat(firstDow - 1) { add(null) }
        for (d in 1..daysInMonth) add(d)
        while (size % 7 != 0) add(null)
    }
    val busy = remember(sessions) { sessions.groupingBy { it.date }.eachCount() }
    val today = LocalDate.now()

    GlassCard(strong = true, padding = 14.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                ym.format(DateTimeFormatter.ofPattern("LLLL yyyy", Locale("ru"))).replaceFirstChar { it.uppercase() },
                style = tSection, color = CompasFg, modifier = Modifier.weight(1f),
            )
            RoundChev(Icons.Outlined.ChevronLeft, onPrev)
            Spacer(Modifier.width(8.dp))
            RoundChev(Icons.Outlined.ChevronRight, onNext)
        }
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth()) {
            listOf("Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс").forEachIndexed { i, d ->
                Text(
                    d, Modifier.weight(1f), color = if (i >= 5) CompasAccent else CompasMutedFg,
                    fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                    style = androidx.compose.ui.text.TextStyle(textAlign = androidx.compose.ui.text.style.TextAlign.Center),
                )
            }
        }
        Spacer(Modifier.height(6.dp))
        cells.chunked(7).forEach { week ->
            Row(Modifier.fillMaxWidth()) {
                week.forEach { day ->
                    if (day == null) {
                        Box(Modifier.weight(1f).aspectRatio(1f))
                    } else {
                        val date = ym.atDay(day)
                        val isSel = date == selected
                        val isToday = date == today
                        val count = busy[date.toString()] ?: 0
                        Box(
                            Modifier.weight(1f).aspectRatio(1f).padding(2.dp)
                                .clip(RoundedCornerShape(13.dp))
                                .then(if (isSel) Modifier.background(Brush.linearGradient(listOf(Forest700, Forest900))) else Modifier)
                                .clickable { onPick(date) },
                            contentAlignment = Alignment.Center,
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    "$day",
                                    color = when { isSel -> Color.White; isToday -> Forest700; else -> CompasFg },
                                    fontSize = 14.sp,
                                    fontWeight = if (isSel || isToday) FontWeight.Bold else FontWeight.Medium,
                                )
                                if (count > 0) {
                                    Spacer(Modifier.height(2.dp))
                                    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                                        repeat(minOf(count, 3)) {
                                            Box(Modifier.size(4.dp).clip(CircleShape).background(if (isSel) Color.White.copy(alpha = 0.85f) else CompasAccent))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RoundChev(icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    Box(
        Modifier.pressScale(interaction).size(34.dp).glass(radius = 999.dp)
            .clickable(interactionSource = interaction, indication = null, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, null, Modifier.size(18.dp), tint = Forest800)
    }
}

@Composable
private fun AgendaRow(s: Session, onClick: () -> Unit) {
    GlassCard(padding = 12.dp, onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(8.dp).clip(CircleShape).background(statusColor(s.status.name)))
            Spacer(Modifier.width(10.dp))
            Text(s.startTime, style = tBody.copy(fontFeatureSettings = "tnum"), fontWeight = FontWeight.Bold, color = CompasFg)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(s.clientName, color = CompasFg, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(2.dp))
                FmtChip(if (s.format == SessionFormat.ONLINE) "video" else "offline")
            }
            Icon(Icons.Outlined.ChevronRight, null, Modifier.size(18.dp), tint = CompasMutedFg)
        }
    }
}

private fun statusColor(status: String): Color = when (status.lowercase()) {
    "confirmed" -> Success
    "pending" -> CompasAccent
    "cancelled", "no_show" -> Red
    else -> CompasMutedFg
}

private fun sessionsWord(n: Int): String = when {
    n % 10 == 1 && n % 100 != 11 -> "сессия"
    n % 10 in 2..4 && (n % 100 < 10 || n % 100 >= 20) -> "сессии"
    else -> "сессий"
}

/** Compatibility wrapper — ClientDetailScreen imports this from the calendar package. */
@Composable
fun CompasSegmentedControl(
    items: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) = CompasSegmented(items, selectedIndex, onSelect, modifier)
