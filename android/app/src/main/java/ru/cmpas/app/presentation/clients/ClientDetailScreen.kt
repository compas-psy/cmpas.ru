package ru.cmpas.app.presentation.clients

import androidx.compose.foundation.background
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.*
import ru.cmpas.app.presentation.components.*
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
    viewModel: ClientDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(clientId) { viewModel.loadClient(clientId) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(bottom = 80.dp),
    ) {
        // ─── Header ───
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Назад")
            }
            Spacer(Modifier.width(4.dp))
            if (uiState.client != null) {
                AvatarCircle(name = uiState.client!!.name, size = 36.dp)
                Spacer(Modifier.width(10.dp))
                Text(
                    uiState.client!!.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                ClientStatusBadge(uiState.client!!.status)
            }
            Spacer(Modifier.width(8.dp))
            IconButton(onClick = {}) {
                Icon(Icons.Outlined.MoreVert, "Ещё")
            }
        }

        when {
            uiState.isLoading -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            }
            uiState.client != null -> {
                val client = uiState.client!!
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    // ─── Rhythm Card ───
                    item {
                        RhythmCard(client = client)
                    }

                    // ─── Quick Actions ───
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            SmartActionChip("Занять\nслед. неделю", Icons.Outlined.Replay, {}, Modifier.weight(1f))
                            SmartActionChip("Изменить\nслот", Icons.Outlined.Edit, {}, Modifier.weight(1f))
                            SmartActionChip("Продлить\nсерию", Icons.Outlined.TrendingUp, {}, Modifier.weight(1f))
                            SmartActionChip("Написать", Icons.Outlined.Chat, {}, Modifier.weight(1f))
                        }
                    }

                    // ─── Status indicators ───
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            StatusIndicator(Icons.Outlined.CheckCircle, "Согласие", "Получено", BadgePaidText, Modifier.weight(1f))
                            StatusIndicator(Icons.Outlined.CreditCard, "Оплаты", "В порядке", BadgePaidText, Modifier.weight(1f))
                            StatusIndicator(Icons.Outlined.Assignment, "Д/з", "1 задание", CompasOrange, Modifier.weight(1f))
                        }
                    }

                    // ─── Sessions History ───
                    item {
                        SectionHeader(title = "История сессий")
                    }

                    if (uiState.sessions.isEmpty()) {
                        item {
                            Text(
                                "Нет сессий",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(vertical = 8.dp),
                            )
                        }
                    } else {
                        items(uiState.sessions, key = { it.id }) { session ->
                            Card(
                                onClick = { onSessionClick(session.id) },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            ) {
                                Row(
                                    modifier = Modifier.padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            session.date,
                                            style = MaterialTheme.typography.titleSmall,
                                            color = MaterialTheme.colorScheme.onSurface,
                                        )
                                        Text(
                                            "${session.startTime}–${session.endTime} · ${if (session.format == SessionFormat.ONLINE) "Онлайн" else "Очно"}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                    if (session.occurrenceIndex != null && session.seriesTotal != null) {
                                        SeriesBadge(session.occurrenceIndex, session.seriesTotal)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            uiState.error != null -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(uiState.error!!, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.height(16.dp))
                        OutlinedButton(onClick = onBack) { Text("Назад") }
                    }
                }
            }
        }
    }
}

// ═══════════════════════════════════════════
// Rhythm Card — central element
// ═══════════════════════════════════════════

@Composable
private fun RhythmCard(client: Client) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Outlined.Star,
                    null,
                    Modifier.size(18.dp),
                    tint = CompasAccent,
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    "Ритм работы",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
            Spacer(Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                RhythmItem(
                    icon = Icons.Outlined.CalendarMonth,
                    label = "Регулярный слот",
                    value = if (client.anchorWeekday != null && client.anchorTime != null) {
                        "${DayOfWeek.of(client.anchorWeekday!!).getDisplayName(TextStyle.SHORT, Locale("ru"))} ${client.anchorTime}"
                    } else "—",
                )
                RhythmItem(
                    icon = Icons.Outlined.Videocam,
                    label = "Формат",
                    value = when (client.anchorFormat) {
                        SessionFormat.ONLINE -> "Онлайн"
                        SessionFormat.IN_PERSON -> "Офлайн"
                        else -> "—"
                    },
                )
                RhythmItem(
                    icon = Icons.Outlined.FormatListNumbered,
                    label = "Серия",
                    value = if (client.packageTotal != null && client.packageCompleted != null)
                        "${client.packageCompleted} из ${client.packageTotal}" else "—",
                )
                RhythmItem(
                    icon = Icons.Outlined.Event,
                    label = "Следующая",
                    value = client.nextSessionDate ?: "—",
                )
            }
        }
    }
}

@Composable
private fun RhythmItem(
    icon: ImageVector,
    label: String,
    value: String,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(icon, null, Modifier.size(22.dp), tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(6.dp))
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Text(
            value,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
        )
    }
}

// ═══════════════════════════════════════════
// Status Indicator
// ═══════════════════════════════════════════

@Composable
private fun StatusIndicator(
    icon: ImageVector,
    label: String,
    value: String,
    color: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, Modifier.size(16.dp), tint = color)
        Spacer(Modifier.width(6.dp))
        Column {
            Text(label, style = MaterialTheme.typography.labelSmall, color = color)
            Text(value, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
