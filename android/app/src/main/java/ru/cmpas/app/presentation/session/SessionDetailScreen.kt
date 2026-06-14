package ru.cmpas.app.presentation.session

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.*
import ru.cmpas.app.presentation.comms.SendMessageSheet
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalLayoutApi::class)
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
    val uriHandler = LocalUriHandler.current
    var showMenu by remember { mutableStateOf(false) }
    var showCancelConfirm by remember { mutableStateOf(false) }
    var showMessage by remember { mutableStateOf(false) }
    var messageText by remember { mutableStateOf("") }

    LaunchedEffect(sessionId) { viewModel.loadSession(sessionId) }
    LaunchedEffect(uiState.cancelled) { if (uiState.cancelled) onBack() }

    if (uiState.showRescheduleDialog) {
        RescheduleDialog(
            uiState = uiState,
            onDateSelected = viewModel::loadFreeTimes,
            onConfirm = { date, time -> viewModel.reschedule(sessionId, date, time) },
            onDismiss = viewModel::closeRescheduleDialog,
        )
    }

    if (showCancelConfirm) {
        AlertDialog(
            onDismissRequest = { showCancelConfirm = false },
            icon = { Icon(Icons.Outlined.WarningAmber, null, tint = CompasDestructive) },
            title = { Text("Отменить сессию?") },
            text = { Text("Запись будет отменена. Клиенту потребуется отправить уведомление об изменении.") },
            confirmButton = {
                TextButton(onClick = { showCancelConfirm = false; viewModel.cancel(sessionId) }) {
                    Text("Отменить сессию", color = CompasDestructive)
                }
            },
            dismissButton = { TextButton(onClick = { showCancelConfirm = false }) { Text("Оставить") } },
        )
    }

    val session = uiState.session
    val clientDetail = uiState.clientDetail
    val bound = clientDetail?.hasMessenger == true
    val channel = clientDetail?.messengerChannel ?: if (!clientDetail?.telegramId.isNullOrBlank()) "telegram" else null

    Box(Modifier.fillMaxSize().background(CompasBg)) {
        Ambient()

        Column(Modifier.fillMaxSize()) {
            SessionPushHeader(
                onBack = onBack,
                onMore = { showMenu = true },
                showMenu = showMenu,
                onDismissMenu = { showMenu = false },
                onReschedule = { showMenu = false; viewModel.openRescheduleDialog() },
                onCancel = { showMenu = false; showCancelConfirm = true },
            )

            when {
                uiState.isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Forest700)
                }
                session != null -> LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 10.dp, bottom = 194.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item {
                        SessionHero(
                            session = session,
                            clientDetail = clientDetail,
                            onClient = { onClientClick(session.clientId) },
                            onConfirm = if (session.status == SessionStatus.PENDING) ({ viewModel.confirm(session.id) }) else null,
                        )
                    }
                    item {
                        SectionTitle(
                            title = "Заметки сессии",
                            actionLabel = "Открыть",
                            onAction = { onNoteClick(session.id) },
                        )
                    }
                    item {
                        SessionNotesPreview(
                            text = session.notes ?: session.previousNotesSummary
                                ?: "Зафиксируйте ключевой запрос, динамику и следующий шаг после встречи.",
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
                    GlassCard(padding = 20.dp) {
                        Text(uiState.error ?: "Не удалось загрузить сессию", style = tBody2)
                        Spacer(Modifier.height(12.dp))
                        GhostButton("Назад", onBack, modifier = Modifier.fillMaxWidth(), icon = Icons.AutoMirrored.Outlined.ArrowBack)
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
                    PrimaryButton(
                        text = "Подключиться",
                        icon = Icons.Outlined.Videocam,
                        modifier = Modifier.weight(1f),
                        onClick = {
                            val link = session.videoLink
                            if (!link.isNullOrBlank()) runCatching { uriHandler.openUri(link) }
                            else Toast.makeText(context, "Ссылка на встречу ещё не добавлена", Toast.LENGTH_SHORT).show()
                        },
                    )
                    GhostButton(
                        text = null,
                        icon = Icons.Outlined.Send,
                        modifier = Modifier.width(54.dp),
                        onClick = { messageText = ""; showMessage = true },
                    )
                    GhostButton(
                        text = null,
                        icon = Icons.Outlined.EditNote,
                        modifier = Modifier.width(54.dp),
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
                        onClick = { showCancelConfirm = true },
                    )
                }
            }
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
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
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
    onConfirm: (() -> Unit)?,
) {
    GlassCard(modifier = Modifier.fillMaxWidth(), strong = true, padding = 18.dp) {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                Eyebrow(formatLongDate(session.date))
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(session.startTime, style = tKpi.copy(fontSize = 38.sp, lineHeight = 40.sp), color = CompasFg)
                    Spacer(Modifier.width(8.dp))
                    Text("${session.durationMinutes()} мин", style = tMeta, color = CompasMutedFg, modifier = Modifier.padding(bottom = 5.dp))
                }
            }
            StatusPill(session.status)
        }
        Spacer(Modifier.height(14.dp))
        ClientTile(
            session = session,
            since = clientDetail?.lastSessionDate,
            onClick = onClient,
        )
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            InfoChip(
                icon = if (session.format == SessionFormat.ONLINE) Icons.Outlined.Videocam else Icons.Outlined.LocationOn,
                label = "Формат",
                value = if (session.format == SessionFormat.ONLINE) "Видео" else "Очно",
                modifier = Modifier.weight(1f),
            )
            InfoChip(
                icon = Icons.Outlined.CurrencyRuble,
                label = "Оплата",
                value = when (session.paymentStatus) {
                    PaymentStatus.PAID -> "Оплачено"
                    PaymentStatus.UNPAID -> "Ожидает"
                    PaymentStatus.PARTIAL -> "Частично"
                    PaymentStatus.NOT_REQUIRED -> "Не требуется"
                },
                modifier = Modifier.weight(1f),
            )
        }
        if (onConfirm != null) {
            Spacer(Modifier.height(10.dp))
            GhostButton("Подтвердить встречу", onConfirm, modifier = Modifier.fillMaxWidth(), icon = Icons.Outlined.CheckCircle)
        }
    }
}

@Composable
private fun ClientTile(session: Session, since: String?, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(17.dp)).background(Sage50)
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .padding(12.dp),
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
    Row(
        modifier.clip(RoundedCornerShape(14.dp)).background(Sage50).padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, Modifier.size(18.dp), tint = Forest600)
        Spacer(Modifier.width(8.dp))
        Column {
            Text(label, style = tMeta, color = CompasMutedFg)
            Text(value, style = tMeta, color = CompasFg, maxLines = 1)
        }
    }
}

@Composable
private fun SessionNotesPreview(text: String, onClick: () -> Unit) {
    GlassCard(modifier = Modifier.fillMaxWidth(), padding = 15.dp, onClick = onClick) {
        Row(Modifier.fillMaxWidth()) {
            Box(Modifier.width(4.dp).heightIn(min = 72.dp).clip(RoundedCornerShape(999.dp)).background(CompasAccent))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(text, style = tBody2, maxLines = 5, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    NoteTag("#тревога")
                    NoteTag("#схема-терапия")
                }
            }
        }
    }
}

@Composable
private fun NoteTag(text: String) {
    Text(
        text,
        style = tMeta,
        color = Color(0xFF8B6914),
        modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(GoldSoft).padding(horizontal = 9.dp, vertical = 4.dp),
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RescheduleDialog(
    uiState: SessionDetailUiState,
    onDateSelected: (String) -> Unit,
    onConfirm: (String, String) -> Unit,
    onDismiss: () -> Unit,
) {
    var date by remember { mutableStateOf("") }
    var time by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Перенести сессию") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = date,
                    onValueChange = {
                        date = it
                        if (it.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))) onDateSelected(it)
                    },
                    label = { Text("Дата, ГГГГ-ММ-ДД") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
                if (uiState.isLoadingFreeTimes) LinearProgressIndicator(Modifier.fillMaxWidth())
                if (uiState.freeTimes.isNotEmpty()) {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        uiState.freeTimes.forEach { slot ->
                            FilterChip(selected = time == slot, onClick = { time = slot }, label = { Text(slot) })
                        }
                    }
                } else {
                    OutlinedTextField(
                        value = time,
                        onValueChange = { time = it },
                        label = { Text("Время, ЧЧ:ММ") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                    )
                }
                uiState.freeTimesError?.let { Text(it, style = tMeta, color = CompasDestructive) }
            }
        },
        confirmButton = {
            TextButton(
                enabled = date.matches(Regex("\\d{4}-\\d{2}-\\d{2}")) && time.matches(Regex("\\d{2}:\\d{2}")),
                onClick = { onConfirm(date, time) },
            ) { Text("Перенести") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
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
