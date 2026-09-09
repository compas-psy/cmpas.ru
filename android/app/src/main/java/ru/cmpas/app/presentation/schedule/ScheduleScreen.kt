package ru.cmpas.app.presentation.schedule

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import java.time.LocalTime
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
    // Какой день недели открыт на правку. Правка расписания в приложении —
    // это в первую очередь «поменять часы конкретного дня», а не «настроить
    // правило целиком»: правило с названием, цветом и сроком остаётся в
    // веб-кабинете, и ссылка на него со экрана никуда не делась.
    var editingDay by remember { mutableStateOf<Int?>(null) }
    var editingSlot by remember { mutableStateOf<AvailabilitySlotDto?>(null) }
    var addingForDay by remember { mutableStateOf<Int?>(null) }
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
                                    "Управляйте самозаписью с телефона: часы любого дня недели и блокировки правятся здесь же.",
                                    style = tBody2,
                                )
                                Spacer(Modifier.height(8.dp))
                                GhostButton(
                                    text = "Правила, цвета и сроки — в веб-кабинете",
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

                item { WeekOverviewCard(rules = uiState.rules, slots = uiState.slots, onDay = { day -> editingDay = day }) }

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
            onSave = { startDate, endDate, startTime, endTime, type, reason, cancelSessions ->
                viewModel.createBlock(startDate, endDate, startTime, endTime, type, reason, cancelSessions) { success, message ->
                    showMessage(message)
                    if (success) showAddSheet = false
                }
            },
        )
    }

    editingDay?.let { day ->
        DayHoursSheet(
            dayOfWeek = day,
            slots = uiState.slots.filter { it.dayOfWeek == day }.sortedBy { it.startTime },
            deletingId = uiState.deletingId,
            onClose = { editingDay = null },
            onEdit = { slot -> editingSlot = slot },
            onAdd = { addingForDay = day },
            onDelete = { id -> viewModel.deleteSlot(id) { _, message -> showMessage(message) } },
        )
    }

    editingSlot?.let { slot ->
        SlotHoursSheet(
            title = "${dayFull(slot.dayOfWeek)}: часы",
            initialStart = slot.startTime,
            initialEnd = slot.endTime,
            initialFormat = slot.format,
            initialDuration = slot.duration,
            isSaving = uiState.isSaving,
            onClose = { editingSlot = null },
            onSave = { start, end, format, duration ->
                viewModel.updateSlot(slot.id, start, end, duration, format, slot.addressId) { success, message ->
                    showMessage(message)
                    if (success) editingSlot = null
                }
            },
        )
    }

    addingForDay?.let { day ->
        // Срок нового окна берётся у соседей того же расписания, а не
        // выдумывается: иначе добавленные с телефона часы жили бы не столько
        // же, сколько остальные, и расписание расходилось бы само по себе.
        val sibling = uiState.slots.firstOrNull { it.dayOfWeek == day } ?: uiState.slots.firstOrNull()
        val from = sibling?.startDate ?: LocalDate.now().toString()
        val to = sibling?.endDate ?: LocalDate.now().plusDays(90).toString()
        SlotHoursSheet(
            title = "${dayFull(day)}: новые часы",
            initialStart = "09:00",
            initialEnd = "18:00",
            initialFormat = sibling?.format ?: "online",
            initialDuration = sibling?.duration ?: 50,
            isSaving = uiState.isSaving,
            onClose = { addingForDay = null },
            onSave = { start, end, format, duration ->
                viewModel.addSlot(
                    dayOfWeek = day,
                    startTime = start,
                    endTime = end,
                    duration = duration,
                    format = format,
                    addressId = sibling?.addressId,
                    startDate = from,
                    endDate = to,
                    scheduleRuleId = sibling?.ruleId,
                ) { success, message ->
                    showMessage(message)
                    if (success) addingForDay = null
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
    onBlock: (startDate: String, endDate: String, startTime: String?, endTime: String?, type: String, reason: String) -> Unit,
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
                onClick = { onBlock(today.toString(), today.toString(), null, null, "personal", "Личный день") },
            )
            GhostButton(
                text = "Завтра",
                icon = Icons.Outlined.Event,
                enabled = !isSaving,
                modifier = Modifier.weight(1f),
                onClick = { onBlock(tomorrow.toString(), tomorrow.toString(), null, null, "personal", "Личный день") },
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

/**
 * Неделя. Каждый день нажимается и открывает свои часы.
 *
 * Показываются ВСЕ семь дней, а не только заполненные: у дня без часов иначе
 * нет строки, а значит и места, куда нажать, чтобы их завести. Ровно та же
 * причина, по которой в веб-кабинете правило показывает всю неделю.
 */
@Composable
private fun WeekOverviewCard(rules: List<AvailabilityRule>, slots: List<AvailabilitySlotDto>, onDay: (Int) -> Unit) {
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
        val byDay = slots.groupBy { it.dayOfWeek }
        (0..6).forEach { day ->
            val daySlots = byDay[day].orEmpty().sortedBy { it.startTime }
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable { onDay(day) }.padding(vertical = 7.dp, horizontal = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(dayLabel(day), style = tMeta, color = CompasMutedFg, modifier = Modifier.width(34.dp))
                Text(
                    if (daySlots.isEmpty()) "Выходной" else daySlots.take(3).joinToString(" · ") { "${it.startTime}-${it.endTime}" } + if (daySlots.size > 3) " …" else "",
                    style = tBody2,
                    color = if (daySlots.isEmpty()) CompasMutedFg else CompasFg,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Icon(Icons.Outlined.ChevronRight, null, Modifier.size(18.dp), tint = CompasMutedFg)
            }
        }
    }
}

/** Часы одного дня недели: правка, удаление, добавление второго окна. */
@Composable
private fun DayHoursSheet(
    dayOfWeek: Int,
    slots: List<AvailabilitySlotDto>,
    deletingId: String?,
    onClose: () -> Unit,
    onEdit: (AvailabilitySlotDto) -> Unit,
    onAdd: () -> Unit,
    onDelete: (String) -> Unit,
) {
    CompasBottomSheet(onClose = onClose) {
        SheetHead(dayFull(dayOfWeek), "Часы, в которые клиенты видят свободное время")
        Spacer(Modifier.height(14.dp))
        if (slots.isEmpty()) {
            GlassCard(Modifier.fillMaxWidth(), padding = 14.dp) {
                Text("Часов нет — день выходной", style = tBody, color = CompasFg)
                Spacer(Modifier.height(3.dp))
                Text("Добавьте часы, и день откроется для самозаписи.", style = tMeta, color = CompasMutedFg)
            }
        } else {
            // Окна одного дня НЕ склеиваются: 09:00–13:00 онлайн и
            // 15:00–21:00 очно — это два разных окна, у каждого свой формат
            // и свой кабинет, и правятся они порознь.
            slots.forEach { slot ->
                GlassCard(Modifier.fillMaxWidth(), padding = 14.dp, onClick = { onEdit(slot) }) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("${slot.startTime}–${slot.endTime}", style = tBody, color = CompasFg)
                            Spacer(Modifier.height(3.dp))
                            Text("${slotFormatLabel(slot.format)} · ${slot.duration} мин", style = tMeta, color = CompasMutedFg)
                        }
                        if (deletingId == slot.id) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = Forest700)
                        else IconButtonGlass(Icons.Outlined.Close, "Убрать часы", onClick = { onDelete(slot.id) })
                    }
                }
                Spacer(Modifier.height(8.dp))
            }
        }
        Spacer(Modifier.height(6.dp))
        PrimaryButton(text = "Добавить часы", icon = Icons.Outlined.Add, onClick = onAdd, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        GhostButton("Закрыть", onClose, modifier = Modifier.fillMaxWidth(), icon = Icons.Outlined.Close)
    }
}

/** Одно окно: начало, конец, формат, длительность. */
@Composable
private fun SlotHoursSheet(
    title: String,
    initialStart: String,
    initialEnd: String,
    initialFormat: String,
    initialDuration: Int,
    isSaving: Boolean,
    onClose: () -> Unit,
    onSave: (start: String, end: String, format: String, duration: Int) -> Unit,
) {
    var start by rememberSaveable(title) { mutableStateOf(initialStart) }
    var end by rememberSaveable(title) { mutableStateOf(initialEnd) }
    var formatIndex by rememberSaveable(title) { mutableIntStateOf(slotFormats.indexOf(initialFormat).coerceAtLeast(0)) }
    var duration by rememberSaveable(title) { mutableIntStateOf(initialDuration) }
    var picking by remember { mutableStateOf<String?>(null) }
    val valid = start < end

    CompasBottomSheet(onClose = onClose) {
        SheetHead(title, "Клиенты увидят свободное время внутри этих часов")
        Spacer(Modifier.height(14.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            TimeSelectorCard("Начало", start, { picking = "start" }, Modifier.weight(1f))
            TimeSelectorCard("Конец", end, { picking = "end" }, Modifier.weight(1f))
        }
        Spacer(Modifier.height(14.dp))
        Eyebrow("Формат")
        Spacer(Modifier.height(8.dp))
        CompasSegmented(options = listOf("Онлайн", "Кабинет", "Оба"), selectedIndex = formatIndex, onSelect = { formatIndex = it })
        Spacer(Modifier.height(14.dp))
        Eyebrow("Длительность встречи")
        Spacer(Modifier.height(8.dp))
        val durations = listOf(50, 60, 80, 90)
        CompasSegmented(
            options = durations.map { "$it мин" },
            selectedIndex = durations.indexOf(duration).coerceAtLeast(0),
            onSelect = { duration = durations[it] },
        )
        if (!valid) {
            Spacer(Modifier.height(10.dp))
            Text("Конец должен быть позже начала", style = tMeta, color = CompasDestructive)
        }
        Spacer(Modifier.height(16.dp))
        PrimaryButton(
            text = if (isSaving) "Сохраняем…" else "Сохранить",
            icon = if (isSaving) null else Icons.Outlined.Check,
            enabled = valid && !isSaving,
            onClick = { onSave(start, end, slotFormats[formatIndex], duration) },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        GhostButton("Отмена", onClose, modifier = Modifier.fillMaxWidth(), icon = Icons.Outlined.Close)
    }

    picking?.let { which ->
        TimeDialog(
            initial = (if (which == "start") start else end),
            onDismiss = { picking = null },
            onPick = { picked ->
                if (which == "start") start = picked else end = picked
                picking = null
            },
        )
    }
}

@Composable
private fun TimeSelectorCard(label: String, value: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    GlassCard(modifier, padding = 14.dp, onClick = onClick) {
        Icon(Icons.Outlined.Schedule, null, Modifier.size(18.dp), tint = Forest700)
        Spacer(Modifier.height(6.dp))
        Text(label, style = tMeta, color = CompasMutedFg)
        Text(value, style = tBody, color = CompasFg, maxLines = 1)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TimeDialog(initial: String, onDismiss: () -> Unit, onPick: (String) -> Unit) {
    val parsed = runCatching { LocalTime.parse(initial) }.getOrDefault(LocalTime.of(9, 0))
    val picker = rememberTimePickerState(parsed.hour, parsed.minute, true)
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Время", style = tSection) },
        text = { Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { TimePicker(picker) } },
        confirmButton = {
            TextButton(onClick = { onPick(String.format(Locale.ROOT, "%02d:%02d", picker.hour, picker.minute)) }) { Text("Выбрать") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}

private val slotFormats = listOf("online", "offline", "both")

private fun slotFormatLabel(format: String) = when (format) {
    "offline" -> "Кабинет"
    "both" -> "Онлайн и кабинет"
    else -> "Онлайн"
}

private fun dayFull(day: Int) = listOf("Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье").getOrElse(day.coerceIn(0, 6)) { "День" }

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
private fun AddBlockSheet(isSaving: Boolean, onClose: () -> Unit, onSave: (startDate: String, endDate: String, startTime: String?, endTime: String?, type: String, reason: String?, cancelSessions: Boolean) -> Unit) {
    var startDateText by rememberSaveable { mutableStateOf(LocalDate.now().toString()) }
    var endDateText by rememberSaveable { mutableStateOf(LocalDate.now().toString()) }
    var typeIndex by rememberSaveable { mutableIntStateOf(0) }
    var reason by rememberSaveable { mutableStateOf("") }
    var cancelSessions by rememberSaveable { mutableStateOf(false) }
    var showStartPicker by remember { mutableStateOf(false) }
    var showEndPicker by remember { mutableStateOf(false) }
    // «Весь день» — отдельным полем, а не по совпадению часов с 00:00–23:59:
    // это выбор человека, и читать его из значений времени значит угадывать
    // намерение по следствию. Так же сделано в веб-кабинете.
    var wholeDay by rememberSaveable { mutableStateOf(true) }
    var blockStart by rememberSaveable { mutableStateOf("10:00") }
    var blockEnd by rememberSaveable { mutableStateOf("12:00") }
    var pickingTime by remember { mutableStateOf<String?>(null) }
    val types = listOf("vacation", "sick", "personal")
    val startDate = runCatching { LocalDate.parse(startDateText) }.getOrNull()
    val endDate = runCatching { LocalDate.parse(endDateText) }.getOrNull()
    val datesOk = startDate != null && endDate != null && !endDate.isBefore(startDate)
    val hoursOk = wholeDay || blockStart < blockEnd
    val valid = datesOk && hoursOk

    CompasBottomSheet(onClose = onClose) {
        SheetHead("Добавить блокировку", "Закрытое время не увидят клиенты при самозаписи")
        Spacer(Modifier.height(14.dp))
        Eyebrow("Период")
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            DateSelectorCard("С", startDate?.let { prettyBlockDate(it) } ?: "Выбрать", { showStartPicker = true }, Modifier.weight(1f))
            DateSelectorCard("По", endDate?.let { prettyBlockDate(it) } ?: "Выбрать", { showEndPicker = true }, Modifier.weight(1f))
        }
        Spacer(Modifier.height(14.dp))
        Eyebrow("Сколько закрыть")
        Spacer(Modifier.height(8.dp))
        CompasSegmented(options = listOf("Весь день", "Часы"), selectedIndex = if (wholeDay) 0 else 1, onSelect = { wholeDay = it == 0 })
        if (!wholeDay) {
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                TimeSelectorCard("С", blockStart, { pickingTime = "start" }, Modifier.weight(1f))
                TimeSelectorCard("По", blockEnd, { pickingTime = "end" }, Modifier.weight(1f))
            }
            if (startDate != null && endDate != null && endDate.isAfter(startDate)) {
                Spacer(Modifier.height(8.dp))
                // Читается двояко, поэтому сказано словами — как и в вебе.
                Text("Эти часы будут закрыты в КАЖДЫЙ день периода, а не одним отрезком с первого дня по последний.", style = tMeta, color = CompasMutedFg)
            }
        }
        Spacer(Modifier.height(14.dp))
        Eyebrow("Тип")
        Spacer(Modifier.height(8.dp))
        CompasSegmented(options = listOf("Отпуск", "Больничный", "Личное"), selectedIndex = typeIndex, onSelect = { typeIndex = it })
        Spacer(Modifier.height(14.dp))
        GlassCard(Modifier.fillMaxWidth(), padding = 14.dp) {
            OutlinedTextField(value = reason, onValueChange = { reason = it }, modifier = Modifier.fillMaxWidth(), label = { Text("Комментарий") }, placeholder = { Text("Необязательно") }, shape = RoundedCornerShape(16.dp), minLines = 2)
        }
        Spacer(Modifier.height(10.dp))
        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color.White.copy(alpha = 0.5f)).padding(horizontal = 14.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Отменить попадающие сессии", style = tBody, color = CompasFg, modifier = Modifier.weight(1f))
            Switch(checked = cancelSessions, onCheckedChange = { cancelSessions = it })
        }
        if (!datesOk) {
            Spacer(Modifier.height(10.dp))
            Text("Дата «по» не может быть раньше даты «с»", style = tMeta, color = CompasDestructive)
        } else if (!hoursOk) {
            Spacer(Modifier.height(10.dp))
            Text("Конец должен быть позже начала", style = tMeta, color = CompasDestructive)
        }
        Spacer(Modifier.height(16.dp))
        PrimaryButton(
            text = if (isSaving) "Сохраняем…" else "Добавить блокировку",
            icon = if (isSaving) null else Icons.Outlined.Check,
            enabled = valid && !isSaving,
            // «Весь день» — это ОТСУТСТВИЕ часов, а не 00:00–23:59 руками:
            // значения по умолчанию живут в общем серверном правиле
            // (src/lib/practice/block-window.ts), и дублировать их здесь
            // значит завести второе место, где они могут разойтись.
            onClick = { onSave(startDateText, endDateText, if (wholeDay) null else blockStart, if (wholeDay) null else blockEnd, types[typeIndex], reason, cancelSessions) },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        GhostButton("Отмена", onClose, modifier = Modifier.fillMaxWidth(), icon = Icons.Outlined.Close)
    }

    pickingTime?.let { which ->
        TimeDialog(
            initial = if (which == "start") blockStart else blockEnd,
            onDismiss = { pickingTime = null },
            onPick = { picked ->
                if (which == "start") blockStart = picked else blockEnd = picked
                pickingTime = null
            },
        )
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
