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
                    Text("Блокировки и выходные", style = tBody2, color = CompasMutedFg, maxLines = 1, overflow = TextOverflow.Ellipsis)
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
                                    "Заблокируйте дни, когда вы недоступны — клиенты не смогут записаться на них через самозапись.",
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
                    SectionTitle("Ближайшие блокировки", actionLabel = "+ Добавить") { showAddSheet = true }
                }

                when {
                    uiState.isLoading -> item {
                        Box(Modifier.fillMaxWidth().padding(vertical = 24.dp), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = Forest700)
                        }
                    }
                    uiState.blocks.isEmpty() -> item {
                        GlassCard(Modifier.fillMaxWidth(), strong = true, padding = 18.dp) {
                            Text("Блокировок нет", style = tSection, color = CompasFg)
                            Spacer(Modifier.height(4.dp))
                            Text("Всё расписание открыто для самозаписи клиентов.", style = tBody2)
                        }
                    }
                    else -> items(uiState.blocks, key = { it.id }) { block ->
                        BlockRow(
                            block = block,
                            isDeleting = uiState.deletingId == block.id,
                            onDelete = { pendingDelete = block },
                        )
                    }
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
            text = { Text("${blockTypeLabel(block.type)} · ${prettyBlockDate(block.date)} будет снова доступны для самозаписи.", style = tBody2) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteBlock(block.id) { success, message -> showMessage(message) }
                    pendingDelete = null
                }) { Text("Снять", color = CompasDestructive) }
            },
            dismissButton = { TextButton(onClick = { pendingDelete = null }) { Text("Отмена") } },
        )
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
                Text(
                    blockTypeLabel(block.type) + (block.reason?.let { " · $it" } ?: ""),
                    style = tMeta,
                    color = CompasMutedFg,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (isDeleting) {
                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = Forest700)
            } else {
                IconButtonGlass(Icons.Outlined.Close, "Снять блокировку", onClick = onDelete)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddBlockSheet(
    isSaving: Boolean,
    onClose: () -> Unit,
    onSave: (startDate: String, endDate: String, type: String, reason: String?, cancelSessions: Boolean) -> Unit,
) {
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
            DateSelectorCard(
                label = "С",
                value = startDate?.let { prettyBlockDate(it) } ?: "Выбрать",
                onClick = { showStartPicker = true },
                modifier = Modifier.weight(1f),
            )
            DateSelectorCard(
                label = "По",
                value = endDate?.let { prettyBlockDate(it) } ?: "Выбрать",
                onClick = { showEndPicker = true },
                modifier = Modifier.weight(1f),
            )
        }
        Spacer(Modifier.height(14.dp))
        Eyebrow("Тип")
        Spacer(Modifier.height(8.dp))
        CompasSegmented(listOf("Отпуск", "Больничный", "Личное"), typeIndex) { typeIndex = it }
        Spacer(Modifier.height(14.dp))
        GlassCard(Modifier.fillMaxWidth(), padding = 14.dp) {
            OutlinedTextField(
                value = reason,
                onValueChange = { reason = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Комментарий") },
                placeholder = { Text("Необязательно") },
                shape = RoundedCornerShape(16.dp),
                minLines = 2,
            )
        }
        Spacer(Modifier.height(10.dp))
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color.White.copy(alpha = 0.5f))
                .padding(horizontal = 14.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Отменить попадающие сессии", style = tBody, color = CompasFg, modifier = Modifier.weight(1f))
            Switch(checked = cancelSessions, onCheckedChange = { cancelSessions = it })
        }
        if (!valid) {
            Spacer(Modifier.height(10.dp))
            Text("Дата «по» не может быть раньше даты «с»", style = tMeta, color = CompasDestructive)
        }
        Spacer(Modifier.height(16.dp))
        PrimaryButton(
            text = if (isSaving) "Сохраняем…" else "Добавить блокировку",
            icon = if (isSaving) null else Icons.Outlined.Check,
            enabled = valid && !isSaving,
            onClick = { onSave(startDateText, endDateText, types[typeIndex], reason, cancelSessions) },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
        GhostButton("Отмена", onClose, modifier = Modifier.fillMaxWidth(), icon = Icons.Outlined.Close)
    }

    if (showStartPicker) {
        DateDialog(
            initial = startDate ?: LocalDate.now(),
            onDismiss = { showStartPicker = false },
            onPick = { picked ->
                startDateText = picked.toString()
                if (endDate == null || endDate.isBefore(picked)) endDateText = picked.toString()
                showStartPicker = false
            },
        )
    }
    if (showEndPicker) {
        DateDialog(
            initial = endDate ?: startDate ?: LocalDate.now(),
            onDismiss = { showEndPicker = false },
            onPick = { picked -> endDateText = picked.toString(); showEndPicker = false },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DateDialog(initial: LocalDate, onDismiss: () -> Unit, onPick: (LocalDate) -> Unit) {
    val todayStart = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
    val state = rememberDatePickerState(
        initialSelectedDateMillis = initial.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli(),
        selectableDates = object : SelectableDates {
            override fun isSelectableDate(utcTimeMillis: Long): Boolean = utcTimeMillis >= todayStart
        },
    )
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = {
                state.selectedDateMillis?.let { millis ->
                    onPick(Instant.ofEpochMilli(millis).atZone(ZoneId.systemDefault()).toLocalDate())
                } ?: onDismiss()
            }) { Text("Выбрать") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    ) { DatePicker(state = state) }
}

private fun blockTypeLabel(type: String) = when (type) {
    "vacation" -> "Отпуск"
    "sick" -> "Больничный"
    "personal" -> "Личное"
    else -> "Блокировка"
}

private fun prettyBlockDate(date: String): String =
    runCatching { prettyBlockDate(LocalDate.parse(date)) }.getOrDefault(date)

private fun prettyBlockDate(date: LocalDate): String =
    date.format(DateTimeFormatter.ofPattern("d MMMM", Locale("ru"))).replaceFirstChar { it.titlecase(Locale("ru")) }
