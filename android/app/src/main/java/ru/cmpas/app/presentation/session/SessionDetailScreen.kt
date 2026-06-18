package ru.cmpas.app.presentation.session

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.*
import ru.cmpas.app.presentation.comms.SendMessageSheet
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*
import ru.cmpas.app.presentation.util.handleVideoLink
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
fun SessionDetailScreen(
    sessionId: String,
    onBack: () -> Unit,
    onClientClick: (String) -> Unit = {},
    onNoteClick: (String) -> Unit = {},
    onQuickAction: (String) -> Unit = {},
    viewModel: SessionDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    var showMenu by remember { mutableStateOf(false) }
    var showCancelSheet by remember { mutableStateOf(false) }
    var showMessage by remember { mutableStateOf(false) }
    var messageText by remember { mutableStateOf("") }

    LaunchedEffect(sessionId) { viewModel.loadSession(sessionId) }
    LaunchedEffect(uiState.cancelled) { if (uiState.cancelled) onBack() }

    val session = uiState.session
    val clientDetail = uiState.clientDetail
    val bound = clientDetail?.hasMessenger == true
    val channel = clientDetail?.messengerChannel ?: when {
        !clientDetail?.telegramId.isNullOrBlank() -> "telegram"
        !clientDetail?.maxId.isNullOrBlank() -> "max"
        else -> null
    }

    Box(Modifier.fillMaxSize().background(CompasBg)) {
        Ambient()

        Column(Modifier.fillMaxSize()) {
            SessionPushHeader(
                onBack = onBack,
                onMore = { showMenu = true },
                showMenu = showMenu,
                onDismissMenu = { showMenu = false },
                onReschedule = { showMenu = false; viewModel.openRescheduleDialog() },
                onCancel = { showMenu = false; showCancelSheet = true },
            )

            when {
                uiState.isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Forest700)
                }
                session != null -> androidx.compose.foundation.lazy.LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 10.dp, bottom = 194.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item {
                        SessionHero(
                            session = session,
                            clientDetail = clientDetail,
                            onClient = { onClientClick(session.clientId) },
                        )
                    }

                    session.previousNotesSummary?.takeIf { it.isNotBlank() }?.let { previousNotes ->
                        item { SectionTitle("Заметки прошлой сессии") }
                        item { SessionNotesPreview(previousNotes, onClick = null) }
                    }

                    item {
                        SectionTitle(
                            title = "Заметка к этой сессии",
                            actionLabel = "Открыть",
                            onAction = { onNoteClick(session.id) },
                        )
                    }
                    item {
                        SessionNotesPreview(
                            text = session.notes ?: "Зафиксируйте ключевой запрос, динамику и следующий шаг после встречи.",
                            onClick = { onNoteClick(session.id) },
                        )
                    }

                    if (uiState.reminders.isNotEmpty() && session.status != SessionStatus.CANCELLED) {
                        item {
                            RemindersCard(
                                reminders = uiState.reminders,
                                bound = bound,
                                onResend = {
                                    messageText = it.text
                                    showMessage = true
                                },
                                onManual = {
                                    messageText = it.text
                                    showMessage = true
                                },
                            )
                        }
                    }

                    uiState.actionError?.let { error ->
                        item {
                            GlassCard(modifier = Modifier.fillMaxWidth(), padding = 13.dp) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Outlined.ErrorOutline, null, Modifier.size(19.dp), tint = CompasDestructive)
                                    Spacer(Modifier.width(9.dp))
                                    Text(error, style = tBody2, color = CompasDestructive)
                                }
                            }
                        }
                    }
                }
                else -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    GlassCard(Modifier.padding(20.dp), padding = 20.dp) {
                        Text(uiState.error ?: "Не удалось загрузить сессию", style = tBody2)
                        Spacer(Modifier.height(12.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            GhostButton("Назад", onBack, Modifier.weight(1f), Icons.AutoMirrored.Outlined.ArrowBack)
                            PrimaryButton("Повторить", { viewModel.loadSession(sessionId) }, Modifier.weight(1f), Icons.Outlined.Refresh)
                        }
                    }
                }
            }
        }

        if (session != null) {
            Column(
                Modifier.align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(CompasBg.copy(alpha = 0.94f))
                    .navigationBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (session.format == SessionFormat.ONLINE) {
                        PrimaryButton(
                            text = "Подключиться",
                            icon = Icons.Outlined.Videocam,
                            modifier = Modifier.weight(1f),
                            onClick = { handleVideoLink(context, session.videoLink) },
                        )
                    }
                    GhostButton(
                        text = if (session.format == SessionFormat.ONLINE) null else "Написать",
                        icon = Icons.Outlined.Send,
                        modifier = if (session.format == SessionFormat.ONLINE) Modifier.width(54.dp) else Modifier.weight(1f),
                        onClick = { messageText = ""; showMessage = true },
                    )
                    GhostButton(
                        text = if (session.format == SessionFormat.ONLINE) null else "Заметка",
                        icon = Icons.Outlined.EditNote,
                        modifier = if (session.format == SessionFormat.ONLINE) Modifier.width(54.dp) else Modifier.weight(1f),
                        onClick = { onNoteClick(session.id) },
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GhostButton(
                        text = "Перенести",
                        icon = Icons.Outlined.Schedule,
                        modifier = Modifier.weight(1f),
                        onClick = viewModel::openRescheduleDialog,
                    )
                    GhostButton(
                        text = "Отменить",
                        icon = Icons.Outlined.Close,
                        danger = true,
                        modifier = Modifier.weight(1f),
                        onClick = { showCancelSheet = true },
                    )
                }
            }
        }

        if (uiState.showRescheduleDialog && session != null) {
            RescheduleSheet(
                uiState = uiState,
                currentDate = session.date,
                currentTime = session.startTime,
                onDateSelected = viewModel::loadFreeTimes,
                onConfirm = { date, time -> viewModel.reschedule(session.id, date, time) },
                onDismiss = viewModel::closeRescheduleDialog,
            )
        }

        if (showCancelSheet && session != null) {
            CancelSessionSheet(
                clientName = session.clientName,
                date = session.date,
                time = session.startTime,
                isLoading = uiState.isActionLoading,
                onDismiss = { showCancelSheet = false },
                onConfirm = {
                    showCancelSheet = false
                    viewModel.cancel(session.id)
                },
            )
        }

        if (showMessage && session != null) {
            SendMessageSheet(
                clientName = session.clientName,
                channel = channel,
                bound = bound,
                initialText = messageText,
                onClose = { showMessage = false },
                onSend = { viewModel.sendMessage(session.clientId, session.id, it) },
            )
        }
    }
}

@Composable
private fun SessionPushHeader(
    onBack: () -> Unit,
    onMore: () -> Unit,
    showMenu: Boolean,
    onDismissMenu: () -> Unit,
    onReschedule: () -> Unit,
    onCancel: () -> Unit,
) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        IconButtonGlass(Icons.AutoMirrored.Outlined.ArrowBack, "Назад", onClick = onBack)
        Text("Сессия", style = tSection, color = CompasFg, modifier = Modifier.weight(1f).padding(horizontal = 12.dp))
        Box {
            IconButtonGlass(Icons.Outlined.MoreHoriz, "Меню", onClick = onMore)
            DropdownMenu(expanded = showMenu, onDismissRequest = onDismissMenu) {
                DropdownMenuItem(text = { Text("Перенести") }, leadingIcon = { Icon(Icons.Outlined.Schedule, null) }, onClick = onReschedule)
                DropdownMenuItem(
                    text = { Text("Отменить", color = CompasDestructive) },
                    leadingIcon = { Icon(Icons.Outlined.Close, null, tint = CompasDestructive) },
                    onClick = onCancel,
                )
            }
        }
    }
}

@Composable
private fun SessionHero(
    session: Session,
    clientDetail: ClientDetail?,
    onClient: () -> Unit,
) {
    GlassCard(modifier = Modifier.fillMaxWidth(), strong = true, padding = 18.dp) {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                Eyebrow(formatLongDate(session.date))
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(session.startTime.take(5), style = tKpi.copy(fontSize = 38.sp, lineHeight = 40.sp), color = CompasFg)
                    Spacer(Modifier.width(8.dp))
                    Text("${session.durationMinutes()} мин", style = tMeta, color = CompasMutedFg, modifier = Modifier.padding(bottom = 5.dp))
                }
            }
            StatusPill(session.status)
        }
        Spacer(Modifier.height(14.dp))
        ClientTile(session = session, since = clientDetail?.lastSessionDate, onClick = onClient)
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            InfoChip(
                icon = if (session.format == SessionFormat.ONLINE) Icons.Outlined.Videocam else Icons.Outlined.LocationOn,
                label = "Формат",
                value = if (session.format == SessionFormat.ONLINE) "Онлайн" else "В кабинете",
                modifier = Modifier.weight(1f),
            )
            InfoChip(
                icon = confirmationIcon(session.status),
                label = "Подтверждение",
                value = confirmationLabel(session.status),
                modifier = Modifier.weight(1f),
            )
        }
        if (session.status == SessionStatus.PENDING) {
            Spacer(Modifier.height(10.dp))
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(GoldSoft).padding(11.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.Schedule, null, Modifier.size(18.dp), tint = CompasAccent)
                Spacer(Modifier.width(8.dp))
                Text("Ожидаем ответа клиента на напоминание", style = tMeta, color = Color(0xFF8B6914))
            }
        }
    }
}

@Composable
private fun ClientTile(session: Session, since: String?, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(17.dp)).background(Sage50)
            .clickable(interactionSource = interaction, indication = null, onClick = onClick).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Avatar(session.clientName, 46.dp)
        Spacer(Modifier.width(11.dp))
        Column(Modifier.weight(1f)) {
            Text(session.clientName, style = tBody, color = CompasFg, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(
                buildString {
                    append(if (session.occurrenceIndex != null) "${session.occurrenceIndex}-я сессия" else "Клиент")
                    if (!since.isNullOrBlank()) append(" · с ${formatShortDate(since)}")
                },
                style = tMeta,
                color = CompasMutedFg,
            )
        }
        Icon(Icons.Outlined.ChevronRight, null, Modifier.size(20.dp), tint = CompasMutedFg)
    }
}

@Composable
private fun InfoChip(icon: ImageVector, label: String, value: String, modifier: Modifier = Modifier) {
    Row(modifier.clip(RoundedCornerShape(14.dp)).background(Sage50).padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, Modifier.size(18.dp), tint = Forest600)
        Spacer(Modifier.width(8.dp))
        Column {
            Text(label, style = tMeta, color = CompasMutedFg)
            Text(value, style = tMeta, color = CompasFg, maxLines = 1)
        }
    }
}

@Composable
private fun SessionNotesPreview(text: String, onClick: (() -> Unit)?) {
    GlassCard(modifier = Modifier.fillMaxWidth(), padding = 15.dp, onClick = onClick) {
        Row(Modifier.fillMaxWidth()) {
            Box(Modifier.width(4.dp).heightIn(min = 72.dp).clip(RoundedCornerShape(999.dp)).background(CompasAccent))
            Spacer(Modifier.width(12.dp))
            Text(text, style = tBody2, maxLines = 6, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun RescheduleSheet(
    uiState: SessionDetailUiState,
    currentDate: String,
    currentTime: String,
    onDateSelected: (String) -> Unit,
    onConfirm: (String, String) -> Unit,
    onDismiss: () -> Unit,
) {
    var date by remember { mutableStateOf(currentDate) }
    var time by remember { mutableStateOf("") }
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { onDateSelected(date) }

    CompasBottomSheet(onClose = onDismiss) {
        SheetHead("Перенести сессию", "После переноса клиент должен подтвердить новое время")
        Spacer(Modifier.height(16.dp))
        GlassCard(Modifier.fillMaxWidth(), padding = 14.dp, onClick = { showDatePicker = true }) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.CalendarMonth, null, Modifier.size(21.dp), tint = Forest700)
                Spacer(Modifier.width(11.dp))
                Column(Modifier.weight(1f)) {
                    Text("Новая дата", style = tMeta, color = CompasMutedFg)
                    Text(formatLongDate(date), style = tBody, color = CompasFg)
                }
                Icon(Icons.Outlined.ChevronRight, null, Modifier.size(19.dp), tint = CompasMutedFg)
            }
        }
        Spacer(Modifier.height(14.dp))
        Eyebrow("Свободное время")
        Spacer(Modifier.height(9.dp))
        when {
            uiState.isLoadingFreeTimes -> LinearProgressIndicator(Modifier.fillMaxWidth(), color = Forest700)
            uiState.freeTimes.isNotEmpty() -> FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                uiState.freeTimes.forEach { slot ->
                    FilterChip(selected = time == slot, onClick = { time = slot }, label = { Text(slot) })
                }
            }
            else -> {
                Text(uiState.freeTimesError ?: "Свободные слоты не найдены", style = tBody2)
                Spacer(Modifier.height(9.dp))
                GhostButton("Выбрать другое время", { showTimePicker = true }, Modifier.fillMaxWidth(), Icons.Outlined.Schedule)
            }
        }
        if (time.isNotBlank()) {
            Spacer(Modifier.height(12.dp))
            Text("Выбрано: ${formatLongDate(date)}, $time", style = tBody, color = Forest700)
        }
        Spacer(Modifier.height(18.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GhostButton("Отмена", onDismiss, Modifier.weight(1f), Icons.Outlined.Close)
            PrimaryButton(
                "Перенести",
                { onConfirm(date, time) },
                Modifier.weight(1f),
                Icons.Outlined.Check,
                enabled = time.matches(Regex("\\d{2}:\\d{2}")) && !uiState.isActionLoading,
            )
        }
    }

    if (showDatePicker) {
        val initial = runCatching { LocalDate.parse(date) }.getOrDefault(LocalDate.now())
        val state = rememberDatePickerState(
            initialSelectedDateMillis = initial.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli(),
        )
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { millis ->
                        date = Instant.ofEpochMilli(millis).atZone(ZoneId.systemDefault()).toLocalDate().toString()
                        time = ""
                        onDateSelected(date)
                    }
                    showDatePicker = false
                }) { Text("Выбрать") }
            },
            dismissButton = { TextButton(onClick = { showDatePicker = false }) { Text("Отмена") } },
        ) { DatePicker(state) }
    }

    if (showTimePicker) {
        val parsed = runCatching { LocalTime.parse(currentTime) }.getOrDefault(LocalTime.of(12, 0))
        val state = rememberTimePickerState(parsed.hour, parsed.minute, true)
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            title = { Text("Другое время", style = tSection) },
            text = { Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { TimePicker(state) } },
            confirmButton = {
                TextButton(onClick = {
                    time = LocalTime.of(state.hour, state.minute).format(DateTimeFormatter.ofPattern("HH:mm"))
                    showTimePicker = false
                }) { Text("Выбрать") }
            },
            dismissButton = { TextButton(onClick = { showTimePicker = false }) { Text("Отмена") } },
        )
    }
}

@Composable
private fun CancelSessionSheet(
    clientName: String,
    date: String,
    time: String,
    isLoading: Boolean,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    CompasBottomSheet(onClose = onDismiss) {
        SheetHead("Отменить сессию?", "$clientName · ${formatLongDate(date)}, ${time.take(5)}")
        Spacer(Modifier.height(14.dp))
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(17.dp)).background(RedSoft).padding(14.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Icon(Icons.Outlined.WarningAmber, null, Modifier.size(21.dp), tint = CompasDestructive)
            Spacer(Modifier.width(10.dp))
            Text(
                "Запись будет отменена и удалена из календаря. Если мессенджер клиента подключён, сервис отправит уведомление автоматически.",
                style = tBody2,
                color = CompasFg,
                modifier = Modifier.weight(1f),
            )
        }
        Spacer(Modifier.height(18.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GhostButton("Оставить", onDismiss, Modifier.weight(1f), Icons.Outlined.ArrowBack)
            PrimaryButton(
                if (isLoading) "Отменяем…" else "Отменить",
                onConfirm,
                Modifier.weight(1f),
                Icons.Outlined.Close,
                enabled = !isLoading,
            )
        }
    }
}

private fun confirmationIcon(status: SessionStatus): ImageVector = when (status) {
    SessionStatus.CONFIRMED -> Icons.Outlined.Verified
    SessionStatus.PENDING -> Icons.Outlined.Schedule
    SessionStatus.CANCELLED -> Icons.Outlined.EventBusy
    SessionStatus.COMPLETED -> Icons.Outlined.CheckCircle
    SessionStatus.NO_SHOW -> Icons.Outlined.PersonOff
}

private fun confirmationLabel(status: SessionStatus): String = when (status) {
    SessionStatus.CONFIRMED -> "Подтверждено"
    SessionStatus.PENDING -> "Ожидается"
    SessionStatus.CANCELLED -> "Отменено"
    SessionStatus.COMPLETED -> "Завершено"
    SessionStatus.NO_SHOW -> "Не состоялась"
}

private fun Session.durationMinutes(): Long {
    val start = runCatching { LocalTime.parse(startTime) }.getOrNull()
    val end = runCatching { LocalTime.parse(endTime) }.getOrNull()
    return if (start != null && end != null) java.time.Duration.between(start, end).toMinutes().coerceAtLeast(0) else 50
}

private fun formatLongDate(raw: String): String {
    val date = runCatching { LocalDate.parse(raw) }.getOrNull() ?: return raw
    val weekday = date.dayOfWeek.getDisplayName(TextStyle.FULL, Locale("ru"))
    return "$weekday, ${date.format(DateTimeFormatter.ofPattern("d MMMM", Locale("ru")))}"
}

private fun formatShortDate(raw: String): String {
    val date = runCatching { LocalDate.parse(raw) }.getOrNull() ?: return raw
    return date.format(DateTimeFormatter.ofPattern("MMM yyyy", Locale("ru"))).trimEnd('.')
}
