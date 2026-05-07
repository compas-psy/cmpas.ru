package ru.cmpas.app.presentation.clients

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.*
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.calendar.CompasSegmentedControl
import ru.cmpas.app.presentation.theme.*
import java.time.DayOfWeek
import java.time.format.TextStyle
import java.util.Locale

@Composable
fun ClientDetailScreen(
    clientId: String, onBack: () -> Unit, onSessionClick: (String) -> Unit = {},
    viewModel: ClientDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    var tabIndex by remember { mutableStateOf(0) }
    LaunchedEffect(clientId) { viewModel.loadClient(clientId) }

    Column(Modifier.fillMaxSize().padding(bottom = 100.dp)) {
        // Header
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Назад") }
            Spacer(Modifier.width(4.dp))
            if (uiState.client != null) {
                AvatarCircle(name = uiState.client!!.name, size = 36.dp); Spacer(Modifier.width(10.dp))
                Text(uiState.client!!.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                ClientStatusBadge(uiState.client!!.status)
            }
            Spacer(Modifier.width(8.dp)); IconButton(onClick = {}) { Icon(Icons.Outlined.MoreVert, "Ещё") }
        }

        when {
            uiState.isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = MaterialTheme.colorScheme.primary) }
            uiState.client != null -> {
                val client = uiState.client!!

                // Segmented control
                CompasSegmentedControl(
                    items = listOf("Обзор", "Записи", "Заметки", "Документы"),
                    selectedIndex = tabIndex, onSelect = { tabIndex = it },
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )

                LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    when (tabIndex) {
                        0 -> { // Обзор
                            item { RhythmCard(client) }
                            item {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    SmartActionChip("Занять\nслед. неделю", Icons.Outlined.Replay, {}, Modifier.weight(1f))
                                    SmartActionChip("Изменить\nслот", Icons.Outlined.Edit, {}, Modifier.weight(1f))
                                    SmartActionChip("Продлить\nсерию", Icons.Outlined.TrendingUp, {}, Modifier.weight(1f))
                                    SmartActionChip("Пауза", Icons.Outlined.PauseCircle, {}, Modifier.weight(1f))
                                }
                            }
                            item {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    StatusIndicator(Icons.Outlined.CheckCircle, "Согласие", "Получено", BadgePaidText, Modifier.weight(1f))
                                    StatusIndicator(Icons.Outlined.CreditCard, "Оплаты", "В порядке", BadgePaidText, Modifier.weight(1f))
                                    StatusIndicator(Icons.Outlined.Assignment, "Д/з", "1 задание", CompasOrange, Modifier.weight(1f))
                                }
                            }
                            // Last session
                            if (uiState.sessions.isNotEmpty()) {
                                item { SectionHeader(title = "Последняя сессия") }
                                item {
                                    val last = uiState.sessions.first()
                                    Card(onClick = { onSessionClick(last.id) }, Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp),
                                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                                        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                            Column(Modifier.weight(1f)) {
                                                Text(last.date, style = MaterialTheme.typography.titleSmall)
                                                Text("${last.startTime}–${last.endTime} · ${if (last.format == SessionFormat.ONLINE) "Онлайн" else "Очно"}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                            }
                                            if (last.occurrenceIndex != null && last.seriesTotal != null) SeriesBadge(last.occurrenceIndex, last.seriesTotal)
                                        }
                                    }
                                }
                            }
                        }
                        1 -> { // Записи
                            item { SectionHeader(title = "История сессий") }
                            if (uiState.sessions.isEmpty()) { item { Text("Нет сессий", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
                            else { items(uiState.sessions, key = { it.id }) { s ->
                                Card(onClick = { onSessionClick(s.id) }, Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp),
                                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Column(Modifier.weight(1f)) { Text(s.date, style = MaterialTheme.typography.titleSmall)
                                            Text("${s.startTime}–${s.endTime} · ${if (s.format == SessionFormat.ONLINE) "Онлайн" else "Очно"}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                                        if (s.occurrenceIndex != null && s.seriesTotal != null) SeriesBadge(s.occurrenceIndex, s.seriesTotal)
                                    }
                                }
                            } }
                        }
                        2 -> { item { Text("Заметки появятся после добавления", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
                        3 -> { item { Text("Документы: согласия, договоры", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
                    }
                }
            }
            uiState.error != null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) { Text(uiState.error!!, color = MaterialTheme.colorScheme.onSurfaceVariant); Spacer(Modifier.height(16.dp)); OutlinedButton(onClick = onBack) { Text("Назад") } } }
        }
    }
}

// Rhythm Card — переработан в текстовый
@Composable
private fun RhythmCard(client: Client) {
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), elevation = CardDefaults.cardElevation(1.dp)) {
        Column(Modifier.padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Star, null, Modifier.size(18.dp), tint = CompasAccent); Spacer(Modifier.width(8.dp))
                Text("Ритм работы", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.height(12.dp))
            val slot = if (client.anchorWeekday != null && client.anchorTime != null) {
                "${DayOfWeek.of(client.anchorWeekday!!).getDisplayName(TextStyle.FULL, Locale("ru")).replaceFirstChar { it.uppercase() }} ${client.anchorTime}"
            } else "Не закреплён"
            val format = when (client.anchorFormat) { SessionFormat.ONLINE -> "онлайн"; SessionFormat.IN_PERSON -> "офлайн"; else -> "—" }
            Text("$slot · $format · 50 минут", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface)
            if (client.packageTotal != null && client.packageCompleted != null) {
                Text("Серия: ${client.packageCompleted} из ${client.packageTotal}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text("Следующая: ${client.nextSessionDate ?: "—"}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (client.anchorWeekday != null) {
                Spacer(Modifier.height(4.dp)); StatusBadge("Слот закреплён", Sage100, Forest600)
            }
        }
    }
}

@Composable
private fun StatusIndicator(icon: ImageVector, label: String, value: String, color: androidx.compose.ui.graphics.Color, modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, Modifier.size(16.dp), tint = color); Spacer(Modifier.width(6.dp))
        Column { Text(label, style = MaterialTheme.typography.labelSmall, color = color); Text(value, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}
