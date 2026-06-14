package ru.cmpas.app.presentation.clients

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.CalendarToday
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.Client
import ru.cmpas.app.domain.model.ClientStatus
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun ClientsScreen(
    onClientClick: (String) -> Unit = {},
    onAddClient: () -> Unit = {},
    viewModel: ClientsViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val segments = listOf("Активные", "Все", "Архив")
    val selIndex = when (uiState.statusFilter) {
        ClientStatus.ACTIVE -> 0
        ClientStatus.ARCHIVED -> 2
        else -> 1
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
                        Eyebrow("База · ${uiState.allClients.size} ${peopleWord(uiState.allClients.size)}")
                        Spacer(Modifier.height(4.dp))
                        Text("Клиенты", style = tHero, color = CompasFg)
                    }
                    IconButtonGlass(Icons.Outlined.Add, "Добавить", onClick = onAddClient)
                }
            }

            // Search
            item {
                Row(
                    Modifier.fillMaxWidth().height(46.dp).glass(radius = 15.dp).padding(horizontal = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Outlined.Search, null, Modifier.size(18.dp), tint = CompasMutedFg)
                    Spacer(Modifier.width(10.dp))
                    Box(Modifier.weight(1f)) {
                        if (uiState.searchQuery.isEmpty()) {
                            Text("Поиск по имени", style = tBody, color = CompasMutedFg)
                        }
                        BasicTextField(
                            value = uiState.searchQuery,
                            onValueChange = viewModel::onSearchChange,
                            singleLine = true,
                            textStyle = tBody.copy(color = CompasFg),
                            cursorBrush = SolidColor(Forest700),
                        )
                    }
                }
            }

            // Segment
            item {
                CompasSegmented(segments, selIndex, onSelect = { i ->
                    viewModel.setStatusFilter(
                        when (i) {
                            0 -> ClientStatus.ACTIVE
                            2 -> ClientStatus.ARCHIVED
                            else -> null
                        },
                    )
                })
            }

            if (uiState.isLoading && uiState.filteredClients.isEmpty()) {
                item {
                    Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                    }
                }
            } else if (uiState.filteredClients.isEmpty()) {
                item {
                    GlassCard(padding = 18.dp) { Text("Никого не найдено", style = tBody2) }
                }
            } else {
                items(uiState.filteredClients, key = { it.id }) { c ->
                    ClientRow(c, onClick = { onClientClick(c.id) })
                }
            }
        }
    }
}

@Composable
private fun ClientRow(c: Client, onClick: () -> Unit) {
    GlassCard(padding = 12.dp, onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(c.name, 46.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(c.name, color = CompasFg, fontSize = 15.5.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                    Spacer(Modifier.width(8.dp))
                    TagPill("${c.sessionsCount} ${sessionsWord(c.sessionsCount)}")
                }
                Spacer(Modifier.height(4.dp))
                val next = nextLabel(c)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.CalendarToday, null, Modifier.size(13.dp), tint = if (next.soon) Forest700 else CompasMutedFg)
                    Spacer(Modifier.width(5.dp))
                    Text(next.text, style = tMeta, color = if (next.soon) Forest700 else CompasMutedFg, maxLines = 1)
                }
            }
            Spacer(Modifier.width(8.dp))
            Icon(Icons.Outlined.ChevronRight, null, Modifier.size(18.dp), tint = CompasMutedFg)
        }
    }
}

@Composable
private fun TagPill(text: String) {
    Box(
        Modifier.clip(RoundedCornerShape(999.dp)).background(Sage100).padding(horizontal = 9.dp, vertical = 3.dp),
    ) {
        Text(text, color = Forest600, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

private data class NextLabel(val text: String, val soon: Boolean)

private fun nextLabel(c: Client): NextLabel {
    val d = c.nextSessionDate ?: return NextLabel("Нет ближайших записей", false)
    val pretty = try {
        val date = LocalDate.parse(d)
        val today = LocalDate.now()
        val day = when (date) {
            today -> "Сегодня"
            today.plusDays(1) -> "Завтра"
            else -> date.format(DateTimeFormatter.ofPattern("d MMM", Locale("ru")))
        }
        val time = c.nextSessionTime?.let { " · $it" } ?: ""
        "$day$time" to (date == today)
    } catch (_: Exception) {
        (d + (c.nextSessionTime?.let { " · $it" } ?: "")) to false
    }
    return NextLabel(pretty.first, pretty.second)
}

private fun peopleWord(n: Int): String = when {
    n % 10 == 1 && n % 100 != 11 -> "человек"
    else -> "человек"
}

private fun sessionsWord(n: Int): String = when {
    n % 10 == 1 && n % 100 != 11 -> "сессия"
    n % 10 in 2..4 && (n % 100 < 10 || n % 100 >= 20) -> "сессии"
    else -> "сессий"
}
