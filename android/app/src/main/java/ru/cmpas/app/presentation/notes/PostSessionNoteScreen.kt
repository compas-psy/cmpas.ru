package ru.cmpas.app.presentation.notes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowBack
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.EditNote
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.Save
import androidx.compose.material.icons.outlined.Summarize
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostSessionNoteScreen(
    sessionId: String,
    onBack: () -> Unit,
    onSaved: () -> Unit,
    viewModel: PostSessionNoteViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    var mode by remember { mutableStateOf(NoteMode.BLOCKS) }
    var request by remember { mutableStateOf("") }
    var observation by remember { mutableStateOf("") }
    var intervention by remember { mutableStateOf("") }
    var dynamics by remember { mutableStateOf("") }
    var nextStep by remember { mutableStateOf("") }

    fun buildNoteText(): String = buildString {
        appendLine("Формат: ${mode.label}")
        appendBlock("Запрос", request)
        appendBlock("Наблюдение", observation)
        appendBlock("Интервенция", intervention)
        appendBlock("Динамика", dynamics)
        appendBlock("Следующий шаг", nextStep)
    }.trim()

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Заметка после сессии", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text("Сессия $sessionId", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.Outlined.ArrowBack, contentDescription = "Назад") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        bottomBar = {
            Surface(tonalElevation = 2.dp, color = MaterialTheme.colorScheme.surface) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .imePadding()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    OutlinedButton(onClick = onBack, modifier = Modifier.weight(1f), shape = RoundedCornerShape(16.dp)) { Text("Позже") }
                    Button(
                        enabled = !uiState.isSaving,
                        onClick = {
                            val text = buildNoteText()
                            viewModel.saveNote(sessionId, text) { success, message ->
                                scope.launch {
                                    snackbarHostState.showSnackbar(message)
                                    if (success) onSaved()
                                }
                            }
                        },
                        modifier = Modifier.weight(1.4f),
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                    ) {
                        Icon(Icons.Outlined.Save, contentDescription = null)
                        Text(if (uiState.isSaving) "Сохраняю…" else "Сохранить")
                    }
                }
            }
        },
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Surface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.surface, tonalElevation = 1.dp) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Как зафиксировать?", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        NoteMode.entries.forEach { item ->
                            FilterChip(
                                selected = mode == item,
                                onClick = { mode = item },
                                label = { Text(item.label) },
                                leadingIcon = {
                                    Icon(
                                        imageVector = when (item) {
                                            NoteMode.SHORT -> Icons.Outlined.EditNote
                                            NoteMode.BLOCKS -> Icons.Outlined.Summarize
                                            NoteMode.VOICE -> Icons.Outlined.Mic
                                        },
                                        contentDescription = null,
                                    )
                                },
                            )
                        }
                    }
                }
            }

            NoteBlockField("Запрос", "Что было главным запросом клиента?", request) { request = it }
            NoteBlockField("Наблюдение", "Эмоциональный фон, контакт, важные проявления", observation) { observation = it }
            NoteBlockField("Интервенция", "Что использовали в работе", intervention) { intervention = it }
            NoteBlockField("Динамика", "Что изменилось, что осталось сложным", dynamics) { dynamics = it }
            NoteBlockField("Следующий шаг", "ДЗ, договорённости, фокус следующей встречи", nextStep) { nextStep = it }

            Surface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f)) {
                Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(imageVector = Icons.Outlined.AutoAwesome, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Column(modifier = Modifier.padding(start = 12.dp).weight(1f)) {
                        Text("AI-помощник", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Text("После сохранения можно будет сделать резюме, теги и подготовку к следующей сессии.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    TextButton(onClick = {}) { Text("Позже") }
                }
            }
        }
    }
}

@Composable
private fun NoteBlockField(title: String, placeholder: String, value: String, onValueChange: (String) -> Unit) {
    Surface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surface, tonalElevation = 1.dp) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(value = value, onValueChange = onValueChange, modifier = Modifier.fillMaxWidth(), minLines = 2, placeholder = { Text(placeholder) }, shape = RoundedCornerShape(16.dp))
        }
    }
}

private fun StringBuilder.appendBlock(title: String, content: String) {
    if (content.isNotBlank()) {
        appendLine()
        appendLine("$title:")
        appendLine(content.trim())
    }
}

private enum class NoteMode(val label: String) {
    SHORT("Кратко"),
    BLOCKS("По блокам"),
    VOICE("Голосом"),
}
