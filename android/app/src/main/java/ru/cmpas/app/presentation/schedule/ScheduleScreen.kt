package ru.cmpas.app.presentation.schedule

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.AvailabilityRule
import ru.cmpas.app.data.api.AvailabilitySlotDto
import ru.cmpas.app.domain.model.TimeBlock
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduleScreen(
    onBack: () -> Unit,
    viewModel: ScheduleViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    var showAddSheet by remember { mutableStateOf(false) }
    var pendingDelete by remember { mutableStateOf<TimeBlock?>(null) }
    val uriHandler = LocalUriHandler.current

    fun showMessage(message: String) {
        scope.launch { snackbarHostState.showSnackbar(message) }
    }

    Box(Modifier.fillMaxSize().background(CompasBg)) {
        Ambient()

        Column(Modifier.fillMaxSize()) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButtonGlass(Icons.AutoMirrored.Outlined.ArrowBack, "Назад", onClick = onBack)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text("Расписание", style = tSection, color = CompasFg, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("Режим записи и блокировки", style = tBody2, color = CompasMutedFg, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 10.dp, bottom = 116.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                item {
                    GlassCard(Modifier.fillMaxWidth(), padding = 16.dp) {
                        Row(verticalAlignment = Alignment.Top) {
                            Icon(Icons.Outlined.EventBusy, null, Modifier.size(20.dp), tint = Forest700)
                            Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)) {
                                Text(
                                    "Управляйте самозаписью с телефона. Быстрые блокировки сразу закрывают время для клиентов.",
                                    style = tBody2,
                                )
                                Spacer(Modifier.height(8.dp))
                                GhostButton(
                                    text = "Тонкая настройка правил — в веб-кабинете",
                                    icon = Icons.Outlined.OpenInNew,
                                    onClick = { runCatching { uriHandler.openUri("https://cmpas.ru/diary/availability") } },
                                    modifier = Modifier.fillMaxWidth(),
                                )
                            }
                        }
                    }
                }

                item {
                    ScheduleModeCard(
                        mode = uiState.scheduleMode,
                        isSaving = uiState.isSavingMode,
                        bookingBufferHours = uiState.bookingBufferHours,
                        horizonDays = uiState.bookingHorizonDays,
                        cancellationHours = uiState.cancellationHours,
                        onMode = { mode -> viewModel.updateScheduleMode(mode) { _, message -> showMessage(message) } },
                    )
                }

                item { WeekOverviewCard(rules = uiState.rules, slots = uiState.slots) }

                item {
                    QuickBlockActionsCard(
                        isSaving = uiState.isSaving,
                        onCustom = { showAddSheet = true },
                        onBlock = { startDate, endDate, startTime, endTime, type, reason ->
                            viewModel.quickBlock(
                                startDate = startDate,
                                endDate = endDate,
                                startTime = startTime,
                                endTime = endTime,
                                type = type,
                                reason = reason,
                            ) { _, message -> showMessage(message) }
                        },
                    )
                }

                item { SectionTitle("Ближайшие блокировки", actionLabel = "+ Добавить") { showAddSheet = true } }

                when {
                    uiState.isLoading -> item { Box(Modifier.fillMaxWidth().padding(vertical = 24.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Forest700) } }
                    uiState.blocks.isEmpty() -> item {
                        GlassCard(Modifier.fillMaxWidth(), strong = true, padding = 18.dp) {
                            Text("Блокировок нет", style = tSection, color = CompasFg)
                            Spacer(Modifier.height(4.dp))
                            Text("В расписании нет дополнительных закрытых дней или периодов.", style = tBody2)
                        }
                    }
                    else -> items(uiState.blocks, key = { it.id }) { block -> BlockRow(block = block, isDeleting = uiState.deletingId == block.id, onDelete = { pendingDelete = block }) }
                }
            }
        }

        SnackbarHost(snackbarHostState, Modifier.align(Alignment.TopCenter).padding(top = 12.dp))
    }

    if (showAddSheet) {
        AddBlockSheet(
            isSaving = uiState.isSaving,
            onClose = { showAddSheet = false },
            onSave = { startDate, endDate, type, reason, cancelSessions ->
                viewModel.createBlock(startDate, endDate, type, reason, cancelSessions) { success, message ->
                    showMessage(message)
                    if (success) showAddSheet = false
                }
            },
        )
    }

    pendingDelete?.let { block ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("Снять блокировку?", style = tSection) },
            text = { Text("${blockTypeLabel(block.type)} · ${prettyBlockDate(block.date)} снова станет доступной для самозаписи.", style = tBody2) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteBlock(block.id) { _, message -> showMessage(message) }
                    pendingDelete = null
                }) { Text("Снять", color = CompasDestructive) }
            },
            dismissButton = { TextButton(onClick = { pendingDelete = null }) { Text("Отмена") } },
        )
    }
}

@Composable
private fun QuickBlockActionsCard(
    isSaving: Boolean,
    onCustom: () -> Unit,
    onBlock: (startDate: String, endDate: String, startTime: String, endTime: String, type: String, reason: String) -> Unit,
) {
    val today = LocalDate.now()
    val tomorrow = today.plusDays(1)
    GlassCard(Modifier.fillMaxWidth(), padding = 16.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.EventBusy, null, Modifier.size(20.dp), tint = Forest700)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text("Быстрые блокировки", style = tBody, color = CompasFg)
                Text("Закрыть день или часть дня в одно касание", style = tMeta, color = CompasMutedFg)
            }
        }
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GhostButton(
                text = "Сегодня",
                icon = Icons.Outlined.Today,
                enabled = !isSaving,
                modifier = Modifier.weight(1f),
                onClick = { onBlock(today.toString(), today.toString(), "00:00", "23:59", "personal", "Личный день") },
            )
            GhostButton(
                text = "Завтра",
                icon = Icons.Outlined.Event,
                enabled = !isSaving,
                modifier = Modifier.weight(1f),
                onClick = { onBlock(tomorrow.toString(), tomorrow.toString(), "00:00", "23:59", "personal", "Личный день") },
            )
        }
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GhostButton(
                text = "С 18:00",
                icon = Icons.Outlined.Schedule,
                enabled = !isSaving,
                modifier = Modifier.weight(1f),
                onClick = { onBlock(today.toString(), today.toString(), "18:00", "23:59", "personal", "Закончить день раньше") },
            )
            GhostButton(
                text = "Отпуск",
                icon = Icons.Outlined.EditCalendar,
                enabled = !isSaving,
                modifier = Modifier.weight(1f),
                onClick = onCustom,
            )
        }
    }
}

@Composable
private fun ScheduleModeCard(mode: String, isSaving: Boolean, bookingBufferHours: Int, horizonDays: Int, cancellationHours: Int, onMode: (String) -> Unit) {
    val modes = listOf("private", "readonly", "booking")
    val selected = modes.indexOf(mode).coerceAtLeast(0)
    GlassTintCard(Modifier.fillMaxWidth(), padding = 16.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Самозапись клиентов", style = tSection, color = Color.White)
                Text(scheduleModeLabel(mode), style = tBody2, color = Color.White.copy(alpha = .78f))
            }
            if (isSaving) CircularProgressIndicator(Modifier.size(18.dp), color = CompasAccent400, strokeWidth = 2.dp)
        }
        Spacer(Modifier.height(12.dp))
        CompasSegmented(options = listOf("Закрыта", "Превью", "Открыта"), selectedIndex = selected, onSelect = { onMode(modes[it]) })
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MiniPolicy("Запись", "за $bookingBufferHours ч", Modifier.weight(1f))
            MiniPolicy("Горизонт", "$horizonDays дн.", Modifier.weight(1f))
            MiniPolicy("Отмена", "за $cancellationHours ч", Modifier.weight(1f))
        }
    }
}

@Composable
private fun MiniPolicy(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier.clip(RoundedCornerShape(14.dp)).background(Color.White.copy(alpha = .14f)).padding(10.dp)) {
        Text(label, style = tMeta, color = Color.White.copy(alpha = .68f), maxLines = 1)
        Text(value, style = tBody, color = Color.White, maxLines = 1)
    }
}

@Composable
private fun WeekOverviewCard(rules: List<AvailabilityRule>, slots: List<AvailabilitySlotDto>) {
    GlassCard(Modifier.fillMaxWidth(), padding = 16.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.CalendarMonth, null, Modifier.size(20.dp), tint = Forest700)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text("Неделя", style = tBody, color = CompasFg)
                Text("${rules.count { it.isActive }} правил · ${slots.size} слотов", style = tMeta, color = CompasMutedFg)
            }
        }
        Spacer(Modifier.height(10.dp))
        if (slots.isEmpty()) {
            Text("Слоты не настроены. Тонкая настройка пока в веб-кабинете.", style = tBody2)
        } else {
            slots.groupBy { it.dayOfWeek }.toSortedMap().entries.take(7).forEach { (day, daySlots) ->
                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(dayLabel(day), style = tMeta, color = CompasMutedFg, modifier = Modifier.width(34.dp))
                    Text(daySlots.take(3).joinToString(" · ") { "${it.startTime}-${it.endTime}" } + if (daySlots.size > 3) " …" else "", style = tBody2, color = CompasFg, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}

@Composable
private fun DateSelectorCard(label: String, value: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    GlassCard(modifier, padding = 14.dp, onClick = onClick) {
        Icon(Icons.Outlined.CalendarMonth, null, Modifier.size(18.dp), tint = Forest700)
        Spacer(Modifier.height(6.dp))
        Text(label, style = tMeta, color = CompasMutedFg)
        Text(value, style = tBody, color = CompasFg, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun BlockRow(block: TimeBlock, isDeleting: Boolean, onDelete: () -> Unit) {
    GlassCard(Modifier.fillMaxWidth(), padding = 14.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(prettyBlockDate(block.date), style = tBody, color = CompasFg)
                Spacer(Modifier.height(3.dp))
                Text(blockTypeLabel(block.type) + " · ${block.startTime}-${block.endTime}" + (block.reason?.let { " · $it" } ?: ""), style = tMeta, color = CompasMutedFg, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            if (isDeleting) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = Forest700)
            else IconButtonGlass(Icons.Outlined.Close, "Снять блокировку", onClick = onDelete)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddBlockSheet(isSaving: Boolean, onClose: () -> Unit, onSave: (startDate: String, endDate: String, type: String, reason: String?, cancelSessions: Boolean) -> Unit) {
    var startDateText by rememberSaveable { mutableStateOf(LocalDate.now().toString()) }
    var endDateText by rememberSaveable { mutableStateOf(LocalDate.now().toString()) }
    var typeIndex by rememberSaveable { mutableIntStateOf(0) }
    var reason by rememberSaveable { mutableStateOf("") }
    var cancelSessions by rememberSaveable { mutableStateOf(false) }
    var showStartPicker by remember { mutableStateOf(false) }
    var showEndPicker by remember { mutableStateOf(false) }
    val types = listOf("vacation", "sick", "personal")
    val startDate = runCatching { LocalDate.parse(startDateText) }.getOrNull()
    val endDate = runCatching { LocalDate.parse(endDateText) }.getOrNull()
    val valid = startDate != null && endDate != null && !endDate.isBefore(startDate)

    CompasBottomSheet(onClose = onClose) {
        SheetHead("Добавить блокировку", "Дни будут недоступны для самозаписи")
        Spacer(Modifier.height(14.dp))
        Eyebrow("Период")
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            DateSelectorCard("С", startDate?.let { prettyBlockDate(it) } ?: "Выбрать", { showStartPicker = true }, Modifier.weight(1f))
            DateSelectorCard("По", endDate?.let { prettyBlockDate(it) } ?: "Выбрать", { showEndPicker = true }, Modifier.weight(1f))
        }
        Spacer(Modifier.height(14.dp))
        Eyebrow("Тип")
        Spacer(Modifier.height(8.dp))
        CompasSegmented(listOf("Отпуск", "Больничный", "Личное"), typeIndex) { typeIndex = it }
        Spacer(Modifier.height(14.dp))
        GlassCard(Modifier.fillMaxWidth(), padding = 14.dp) {
            OutlinedTextField(value = reason, onValueChange = { reason = it }, modifier = Modifier.fillMaxWidth(), label = { Text("Комментарий") }, placeholder = { Text("Необязательно") }, shape = RoundedCornerShape(16.dp), minLines = 2)
        }
        Spacer(Modifier.height(10.dp))
        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color.White.copy(alpha = 0.5f)).padding(horizontal = 14.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Отменить попадающие сессии", style = tBody, color = CompasFg, modifier = Modifier.weight(1f))
            Switch(checked = cancelSessions, onCheckedChange = { cancelSessions = it })
        }
        if (!valid) {
            Spacer(Modifier.height(10.dp))
            Text("Дата «по» не может быть раньше даты «с»", style = tMeta, color = CompasDestructive)
        }
        Spacer(Modifier.height(16.dp))
        PrimaryButton(text = if (isSaving) "Сохраняем…" else "Добавить блокировку", icon = if (isSaving) null else Icons.Outlined.Check, enabled = valid && !isSaving, onClick = { onSave(startDateText, endDateText, types[typeIndex], reason, cancelSessions) }, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        GhostButton("Отмена", onClose, modifier = Modifier.fillMaxWidth(), icon = Icons.Outlined.Close)
    }

    if (showStartPicker) {
        DateDialog(initial = startDate ?: LocalDate.now(), onDismiss = { showStartPicker = false }, onPick = { picked ->
            startDateText = picked.toString()
            if (endDate == null || endDate.isBefore(picked)) endDateText = picked.toString()
            showStartPicker = false
        })
    }
    if (showEndPicker) {
        DateDialog(initial = endDate ?: startDate ?: LocalDate.now(), onDismiss = { showEndPicker = false }, onPick = { picked -> endDateText = picked.toString(); showEndPicker = false })
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DateDialog(initial: LocalDate, onDismiss: () -> Unit, onPick: (LocalDate) -> Unit) {
    val todayStart = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
    val state = rememberDatePickerState(initialSelectedDateMillis = initial.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli(), selectableDates = object : SelectableDates { override fun isSelectableDate(utcTimeMillis: Long): Boolean = utcTimeMillis >= todayStart })
    DatePickerDialog(onDismissRequest = onDismiss, confirmButton = { TextButton(onClick = { state.selectedDateMillis?.let { millis -> onPick(Instant.ofEpochMilli(millis).atZone(ZoneId.systemDefault()).toLocalDate()) } ?: onDismiss() }) { Text("Выбрать") } }, dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } }) { DatePicker(state = state) }
}

private fun blockTypeLabel(type: String) = when (type) { "vacation" -> "Отпуск"; "sick" -> "Больничный"; "personal" -> "Личное"; else -> "Блокировка" }

private fun dayLabel(day: Int) = listOf("Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс").getOrElse(day.coerceIn(0, 6)) { "—" }

private fun prettyBlockDate(date: String): String = runCatching { prettyBlockDate(LocalDate.parse(date)) }.getOrDefault(date)

private fun prettyBlockDate(date: LocalDate): String = date.format(DateTimeFormatter.ofPattern("d MMMM", Locale("ru"))).replaceFirstChar { it.titlecase(Locale("ru")) }
