package ru.cmpas.app.presentation.clients

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.*
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.calendar.CompasSegmentedControl
import ru.cmpas.app.presentation.theme.*
import java.time.DayOfWeek
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClientDetailScreen(
    clientId: String,
    onBack: () -> Unit,
    onSessionClick: (String) -> Unit = {},
    onScheduleClick: () -> Unit = {},
    onNoteClick: () -> Unit = {},
    onQuickAction: (String) -> Unit = {},
    viewModel: ClientDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    var tabIndex by remember { mutableStateOf(0) }
    var showClientMenu by remember { mutableStateOf(false) }
    LaunchedEffect(clientId) { viewModel.loadClient(clientId) }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Назад") }
            Spacer(Modifier.width(4.dp))
            uiState.client?.let { client ->
                AvatarCircle(name = client.name, size = 38.dp)
                Spacer(Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        client.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        clientSubtitle(client),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                ClientStatusBadge(client.status)
            } ?: Spacer(Modifier.weight(1f))
            Box {
                IconButton(onClick = { showClientMenu = true }) { Icon(Icons.Outlined.MoreVert, "Ещё") }
                DropdownMenu(expanded = showClientMenu, onDismissRequest = { showClientMenu = false }) {
                    DropdownMenuItem(
                        text = { Text("Запланировать сессию") },
                        leadingIcon = { Icon(Icons.Outlined.CalendarMonth, null) },
                        onClick = { showClientMenu = false; onScheduleClick() },
                    )
                    DropdownMenuItem(
                        text = { Text("Добавить заметку") },
                        leadingIcon = { Icon(Icons.Outlined.EditNote, null) },
                        onClick = { showClientMenu = false; onNoteClick() },
                    )
                    DropdownMenuItem(
                        text = { Text("Пауза в работе") },
                        leadingIcon = { Icon(Icons.Outlined.PauseCircle, null) },
                        onClick = { showClientMenu = false; onQuickAction("block-time") },
                    )
                }
            }
        }

        when {
            uiState.isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
            uiState.client != null -> {
                val client = uiState.client!!

                CompasSegmentedControl(
                    items = listOf("Обзор", "Записи", "Заметки", "Документы"),
                    selectedIndex = tabIndex,
                    onSelect = { tabIndex = it },
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )

                LazyColumn(
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 132.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    when (tabIndex) {
                        0 -> {
                            item { RhythmCard(client) }
                            item {
                                ClientPrimaryActions(
                                    onScheduleClick = onScheduleClick,
                                    onChangeSlotClick = onScheduleClick,
                                    onExtendSeriesClick = { onQuickAction("repeat-slot") },
                                    onPauseClick = { onQuickAction("block-time") },
                                )
                            }
                            item { ClientStatusOverview() }
                            item { ClientNextSession(client, uiState.sessions.firstOrNull(), onSessionClick) }
                            item { ClientTherapyOverview(client, onNoteClick) }
                        }
                        1 -> {
                            item { SectionHeader(title = "Записи") }
                            if (uiState.sessions.isEmpty()) {
                                item { EmptyClientBlock("Записей пока нет", "Запланируйте первую сессию с клиентом.", Icons.Outlined.CalendarMonth) }
                            } else {
                                items(uiState.sessions, key = { it.id }) { session ->
                                    ClientSessionRow(session = session, onClick = { onSessionClick(session.id) })
                                }
                            }
                        }
                        2 -> {
                            item { SectionHeader(title = "Заметки") }
                            item { EmptyClientBlock("Заметок пока нет", "После сессии можно быстро добавить заметку по блокам или голосом.", Icons.Outlined.EditNote) }
                            item {
                                Button(
                                    onClick = onNoteClick,
                                    modifier = Modifier.fillMaxWidth().height(52.dp),
                                    shape = RoundedCornerShape(16.dp),
                                ) { Text("Добавить заметку") }
                            }
                        }
                        3 -> {
                            item { SectionHeader(title = "Документы") }
                            item { DocumentStatusCard("Информированное согласие", "Получено", true) }
                            item { DocumentStatusCard("Политика конфиденциальности", "Подписано", true) }
                            item { DocumentStatusCard("Договор / правила отмены", "Не добавлено", false) }
                        }
                    }
                }
            }
            uiState.error != null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(uiState.error!!, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(16.dp))
                    OutlinedButton(onClick = onBack) { Text("Назад") }
                }
            }
        }
    }
}

@Composable
private fun RhythmCard(client: Client) {
    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(1.dp),
    ) {
        Column(Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Star, null, Modifier.size(18.dp), tint = CompasAccent)
                Spacer(Modifier.width(8.dp))
                Text("Ритм работы", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.height(14.dp))
            RhythmInfoLine(Icons.Outlined.Schedule, "Регулярный слот", anchoredSlotLabel(client))
            RhythmInfoLine(Icons.Outlined.Videocam, "Формат", formatLabel(client.anchorFormat))
            RhythmInfoLine(Icons.Outlined.TrendingUp, "Серия", seriesLabel(client))
            RhythmInfoLine(Icons.Outlined.EventAvailable, "Следующая", client.nextSessionDate ?: "Не назначена")
            if (client.anchorWeekday != null) {
                Spacer(Modifier.height(10.dp))
                StatusBadge("Слот закреплён", Sage100, Forest600)
            }
        }
    }
}

@Composable
private fun RhythmInfoLine(icon: ImageVector, label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.width(10.dp))
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun ClientPrimaryActions(
    onScheduleClick: () -> Unit,
    onChangeSlotClick: () -> Unit,
    onExtendSeriesClick: () -> Unit,
    onPauseClick: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Быстрые действия", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            ClientActionRow(Icons.Outlined.Replay, "Занять след. неделю", "Создать запись в том же слоте", onScheduleClick)
            ClientActionRow(Icons.Outlined.Edit, "Изменить слот", "Перенести регулярное время клиента", onChangeSlotClick)
            ClientActionRow(Icons.Outlined.TrendingUp, "Продлить серию", "Добавить продолжение работы", onExtendSeriesClick)
            ClientActionRow(Icons.Outlined.PauseCircle, "Пауза", "Временно остановить регулярные встречи", onPauseClick)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ClientActionRow(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, null, Modifier.size(21.dp), tint = MaterialTheme.colorScheme.primary)
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Icon(Icons.Outlined.ChevronRight, null, Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
        }
    }
}

@Composable
private fun ClientStatusOverview() {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        StatusIndicator(Icons.Outlined.CheckCircle, "Согласие", "Получено", BadgePaidText, Modifier.weight(1f))
        StatusIndicator(Icons.Outlined.CreditCard, "Оплаты", "В порядке", BadgePaidText, Modifier.weight(1f))
        StatusIndicator(Icons.Outlined.Assignment, "Д/з", "1 задание", CompasOrange, Modifier.weight(1f))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ClientNextSession(client: Client, session: Session?, onSessionClick: (String) -> Unit) {
    SectionHeader(title = "Следующая сессия")
    Card(
        onClick = { session?.let { onSessionClick(it.id) } },
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(client.nextSessionDate ?: session?.date ?: "Не назначена", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Text(
                    session?.let { "${it.startTime}–${it.endTime} · ${if (it.format == SessionFormat.ONLINE) "Онлайн" else "Офлайн"}" } ?: "Запланируйте следующую встречу",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Icon(Icons.Outlined.ChevronRight, null, Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
        }
    }
}

@Composable
private fun ClientTherapyOverview(client: Client, onNoteClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Psychology, null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.width(8.dp))
                Text("Фокус работы", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.height(8.dp))
            Text(
                client.notes ?: "Здесь будет краткий запрос, цели терапии и важные договорённости по клиенту.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(12.dp))
            OutlinedButton(onClick = onNoteClick, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp)) {
                Text("Добавить заметку")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ClientSessionRow(session: Session, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(session.date, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Text("${session.startTime}–${session.endTime} · ${if (session.format == SessionFormat.ONLINE) "Онлайн" else "Очно"}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (session.occurrenceIndex != null && session.seriesTotal != null) SeriesBadge(session.occurrenceIndex, session.seriesTotal)
            Spacer(Modifier.width(6.dp))
            Icon(Icons.Outlined.ChevronRight, null, Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
        }
    }
}

@Composable
private fun DocumentStatusCard(title: String, status: String, isOk: Boolean) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(if (isOk) Icons.Outlined.CheckCircle else Icons.Outlined.Description, null, Modifier.size(22.dp), tint = if (isOk) BadgePaidText else MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                Text(status, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun EmptyClientBlock(title: String, subtitle: String, icon: ImageVector) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.padding(22.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(icon, null, Modifier.size(36.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(10.dp))
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun StatusIndicator(icon: ImageVector, label: String, value: String, color: androidx.compose.ui.graphics.Color, modifier: Modifier = Modifier) {
    Surface(modifier = modifier, shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.surface) {
        Column(Modifier.padding(12.dp), horizontalAlignment = Alignment.Start) {
            Icon(icon, null, Modifier.size(18.dp), tint = color)
            Spacer(Modifier.height(6.dp))
            Text(label, style = MaterialTheme.typography.labelSmall, color = color, maxLines = 1)
            Text(value, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

private fun clientSubtitle(client: Client): String {
    return buildList {
        client.phone?.takeIf { it.isNotBlank() }?.let { add(it) }
        client.email?.takeIf { it.isNotBlank() }?.let { add(it) }
        if (isEmpty()) add("${client.sessionsCount} сессий")
    }.joinToString(" · ")
}

private fun anchoredSlotLabel(client: Client): String {
    val weekday = client.anchorWeekday
    val time = client.anchorTime
    return if (weekday != null && time != null) {
        val day = DayOfWeek.of(weekday).getDisplayName(TextStyle.SHORT, Locale("ru")).replaceFirstChar { it.uppercase() }
        "$day $time"
    } else "Не закреплён"
}

private fun formatLabel(format: SessionFormat?): String = when (format) {
    SessionFormat.ONLINE -> "Онлайн"
    SessionFormat.IN_PERSON -> "Офлайн"
    null -> "—"
}

private fun seriesLabel(client: Client): String {
    return if (client.packageTotal != null && client.packageCompleted != null) "${client.packageCompleted} из ${client.packageTotal}" else "Не задана"
}
