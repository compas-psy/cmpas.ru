package ru.cmpas.app.presentation.notes

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.EditNote
import androidx.compose.material.icons.outlined.NoteAdd
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun NotesScreen(
    onSessionNoteClick: (String) -> Unit = {},
    viewModel: NotesViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Box(Modifier.fillMaxSize().background(CompasBg)) {
        Ambient()
        when {
            uiState.isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Forest700)
            }
            else -> LazyColumn(
                contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 120.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item {
                    Column {
                        Eyebrow("Практика")
                        Spacer(Modifier.height(3.dp))
                        Text("Заметки", style = tHero, color = CompasFg)
                        Text("Записи после сессий и подготовка к следующим встречам", style = tBody2, color = CompasMutedFg)
                    }
                }

                if (uiState.recentSessions.isEmpty()) {
                    item {
                        GlassCard(Modifier.fillMaxWidth(), strong = true, padding = 24.dp) {
                            Icon(Icons.Outlined.EditNote, null, Modifier.size(38.dp), tint = Forest700)
                            Spacer(Modifier.height(12.dp))
                            Text("Заметок пока нет", style = tSection, color = CompasFg)
                            Spacer(Modifier.height(4.dp))
                            Text("Откройте завершённую сессию и зафиксируйте главное — кратко, по блокам или голосом.", style = tBody2, color = CompasMutedFg)
                        }
                    }
                } else {
                    item { SectionTitle("Последние сессии") }
                    items(uiState.recentSessions, key = { it.id }) { session ->
                        NoteSessionCard(session) { onSessionNoteClick(session.id) }
                    }
                }
            }
        }
    }
}

@Composable
private fun NoteSessionCard(session: Session, onClick: () -> Unit) {
    GlassCard(Modifier.fillMaxWidth(), padding = 15.dp, onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(session.clientName, 46.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(session.clientName, style = tBody, color = CompasFg, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(2.dp))
                Text("${prettyDate(session.date)} · ${session.startTime}–${session.endTime}", style = tMeta, color = CompasMutedFg)
                if (session.occurrenceIndex != null) {
                    Spacer(Modifier.height(2.dp))
                    Text("Сессия ${session.occurrenceIndex}${session.seriesTotal?.let { " из $it" }.orEmpty()}", style = tMeta, color = CompasAccent)
                }
            }
            if (session.notes.isNullOrBlank()) {
                GhostButton("Добавить", onClick, Modifier.width(108.dp), Icons.Outlined.NoteAdd)
            } else {
                Column(horizontalAlignment = Alignment.End) {
                    Icon(Icons.Outlined.CheckCircle, null, Modifier.size(21.dp), tint = Success)
                    Spacer(Modifier.height(4.dp))
                    Text("Есть заметка", style = tMeta, color = Success)
                }
            }
        }
        if (!session.notes.isNullOrBlank()) {
            Spacer(Modifier.height(10.dp))
            Text(session.notes!!.lineSequence().filter { it.isNotBlank() }.take(2).joinToString(" "), style = tBody2, color = CompasMutedFg, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}

private fun prettyDate(raw: String): String {
    val date = runCatching { LocalDate.parse(raw) }.getOrNull() ?: return raw
    return date.format(DateTimeFormatter.ofPattern("d MMM", Locale("ru")))
}
