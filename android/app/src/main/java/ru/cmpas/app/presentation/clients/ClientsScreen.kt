package ru.cmpas.app.presentation.clients

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.*
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*
import java.time.DayOfWeek
import java.time.format.TextStyle
import java.util.Locale

@Composable
fun ClientsScreen(
    onClientClick: (String) -> Unit = {},
    viewModel: ClientsViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(bottom = 80.dp), // dock space
    ) {
        // ─── Header ───
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    "Клиенты",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                )
                Text(
                    "${uiState.filteredClients.size} ${clientsWord(uiState.filteredClients.size)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = {}) {
                Icon(Icons.Outlined.Search, "Поиск", tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            IconButton(onClick = {}) {
                Icon(Icons.Outlined.Tune, "Фильтр", tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        // ─── Status Filter Chips ───
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            val statuses = listOf(
                ClientStatus.ACTIVE to "Активные",
                ClientStatus.PAUSED to "Пауза",
                ClientStatus.ARCHIVED to "Архив",
            )
            statuses.forEach { (status, label) ->
                val count = uiState.allClients.count { it.status == status }
                val isSelected = uiState.statusFilter == status
                FilterChip(
                    selected = isSelected,
                    onClick = { viewModel.setStatusFilter(if (isSelected) null else status) },
                    label = {
                        Text("$label $count", style = MaterialTheme.typography.labelMedium)
                    },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                        selectedLabelColor = MaterialTheme.colorScheme.primary,
                    ),
                )
            }
        }

        // ─── Search ───
        OutlinedTextField(
            value = uiState.searchQuery,
            onValueChange = viewModel::onSearchChange,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            placeholder = { Text("Поиск по имени или заметкам...") },
            leadingIcon = { Icon(Icons.Outlined.Search, null) },
            singleLine = true,
            shape = RoundedCornerShape(16.dp),
        )

        // ─── Client List ───
        LazyColumn(
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(uiState.filteredClients, key = { it.id }) { client ->
                SmartClientRow(client = client, onClick = { onClientClick(client.id) })
            }
        }
    }
}

// ═══════════════════════════════════════════
// Smart Client Row — matches mockup
// ═══════════════════════════════════════════

@Composable
private fun SmartClientRow(client: Client, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Avatar
            AvatarCircle(name = client.name, size = 44.dp)
            Spacer(Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    client.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                // Next session
                if (client.nextSessionDate != null) {
                    Text(
                        "Следующая сессия",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        "${client.nextSessionDate}${client.nextSessionTime?.let { " · $it" } ?: ""}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    Text(
                        "${client.sessionsCount} сессий${client.lastSessionDate?.let { " · Посл. $it" } ?: ""}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            // Right side: status + cadence
            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                ClientStatusBadge(client.status)

                // Cadence label
                if (client.cadenceType != CadenceType.NONE && client.anchorWeekday != null && client.anchorTime != null) {
                    val dayName = DayOfWeek.of(client.anchorWeekday!!)
                        .getDisplayName(TextStyle.SHORT, Locale("ru")).lowercase()
                    StatusBadge(
                        "каждый $dayName ${client.anchorTime}",
                        Sage100,
                        Forest600,
                    )
                }

                // Package progress
                if (client.packageTotal != null && client.packageCompleted != null) {
                    Text(
                        "${client.packageCompleted} из ${client.packageTotal}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(Modifier.width(4.dp))
            Icon(Icons.Outlined.ChevronRight, null, Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
        }
    }
}

private fun clientsWord(count: Int): String {
    val mod10 = count % 10
    val mod100 = count % 100
    return when {
        mod100 in 11..14 -> "клиентов"
        mod10 == 1 -> "клиент"
        mod10 in 2..4 -> "клиента"
        else -> "клиентов"
    }
}
