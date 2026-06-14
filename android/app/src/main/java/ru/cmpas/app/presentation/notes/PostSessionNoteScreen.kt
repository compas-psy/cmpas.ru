package ru.cmpas.app.presentation.notes

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*

enum class NoteMode(val label: String) { SHORT("Кратко"), BLOCKS("По блокам"), VOICE("Голосом") }

@Composable
fun PostSessionNoteScreen(
    sessionId: String,
    onBack: () -> Unit,
    onSaved: () -> Unit,
    viewModel: PostSessionNoteViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    var mode by rememberSaveable { mutableStateOf(NoteMode.BLOCKS) }
    var shortText by rememberSaveable { mutableStateOf("") }
    var request by rememberSaveable { mutableStateOf("") }
    var observation by rememberSaveable { mutableStateOf("") }
    var intervention by rememberSaveable { mutableStateOf("") }
    var dynamics by rememberSaveable { mutableStateOf("") }
    var nextStep by rememberSaveable { mutableStateOf("") }
    var tags by rememberSaveable { mutableStateOf(listOf("тревога", "схема-терапия")) }
    var addingTag by remember { mutableStateOf(false) }
    var newTag by remember { mutableStateOf("") }
    var isRecording by rememberSaveable { mutableStateOf(false) }
    var hasVoiceDraft by rememberSaveable { mutableStateOf(false) }
    var restored by remember { mutableStateOf(false) }

    LaunchedEffect(sessionId) { viewModel.loadNote(sessionId) }
    LaunchedEffect(uiState.savedText) {
        val saved = uiState.savedText.orEmpty()
        if (!restored && saved.isNotBlank()) {
            shortText = saved
            request = extractBlock(saved, "Запрос")
            observation = extractBlock(saved, "Наблюдение")
            intervention = extractBlock(saved, "Интервенция")
            dynamics = extractBlock(saved, "Динамика")
            nextStep = extractBlock(saved, "Следующий шаг")
            restored = true
        }
    }

    fun buildText(): String = buildString {
        appendLine("Формат: ${mode.label}")
        if (tags.isNotEmpty()) appendLine("Теги: ${tags.joinToString(", ")}")
        when (mode) {
            NoteMode.SHORT -> append(shortText.trim())
            NoteMode.BLOCKS -> {
                appendBlock("Запрос", request)
                appendBlock("Наблюдение", observation)
                appendBlock("Интервенция", intervention)
                appendBlock("Динамика", dynamics)
                appendBlock("Следующий шаг", nextStep)
            }
            NoteMode.VOICE -> append(if (hasVoiceDraft) "Голосовая заметка зафиксирована и ожидает расшифровки." else shortText.trim())
        }
    }.trim()

    Box(Modifier.fillMaxSize().background(CompasBg)) {
        Ambient()

        Column(Modifier.fillMaxSize()) {
            NotePushHeader(onBack)
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 10.dp, bottom = 112.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item { NoteContextCard(session = uiState.session, sessionId = sessionId) }
                item { PrivacyBanner() }
                item { Eyebrow("Как зафиксировать") }
                item {
                    CompasSegmented(
                        options = NoteMode.entries.map { it.label },
                        selectedIndex = mode.ordinal,
                        onSelect = { mode = NoteMode.entries[it] },
                    )
                }
                when (mode) {
                    NoteMode.SHORT -> item {
                        NoteField(
                            title = "Заметка",
                            hint = "Что важно сохранить после этой встречи?",
                            value = shortText,
                            minLines = 8,
                            onValueChange = { shortText = it },
                        )
                    }
                    NoteMode.BLOCKS -> {
                        item { NoteField("Запрос", "Что было главным запросом клиента?", request) { request = it } }
                        item { NoteField("Наблюдение", "Эмоциональный фон, контакт, важные проявления", observation) { observation = it } }
                        item { NoteField("Интервенция", "Что использовали в работе", intervention) { intervention = it } }
                        item { NoteField("Динамика", "Что изменилось, что осталось сложным", dynamics) { dynamics = it } }
                        item { NoteField("Следующий шаг", "Договорённости и фокус следующей встречи", nextStep) { nextStep = it } }
                    }
                    NoteMode.VOICE -> item {
                        VoiceCapture(
                            recording = isRecording,
                            hasDraft = hasVoiceDraft,
                            onToggle = {
                                if (isRecording) hasVoiceDraft = true
                                isRecording = !isRecording
                            },
                        )
                    }
                }
                item { Eyebrow("Теги") }
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        FlowRowCompat {
                            tags.forEach { tag ->
                                TagPill(tag) { tags = tags - tag }
                            }
                            AddTagPill { addingTag = true }
                        }
                        if (addingTag) {
                            OutlinedTextField(
                                value = newTag,
                                onValueChange = { newTag = it },
                                modifier = Modifier.fillMaxWidth(),
                                label = { Text("Новый тег") },
                                singleLine = true,
                                trailingIcon = {
                                    IconButton(onClick = {
                                        val clean = newTag.trim().removePrefix("#")
                                        if (clean.isNotBlank() && clean !in tags) tags = tags + clean
                                        newTag = ""
                                        addingTag = false
                                    }) { Icon(Icons.Outlined.Check, "Добавить") }
                                },
                            )
                        }
                    }
                }
                item { AiHelperCard() }
            }
        }

        Row(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth()
                .background(CompasBg.copy(alpha = 0.94f))
                .navigationBarsPadding().imePadding()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            GhostButton("Позже", onBack, modifier = Modifier.weight(1f), icon = Icons.Outlined.Schedule)
            PrimaryButton(
                text = if (uiState.isSaving) "Сохраняю…" else "Сохранить заметку",
                icon = Icons.Outlined.Check,
                enabled = !uiState.isSaving,
                modifier = Modifier.weight(1.55f),
                onClick = {
                    viewModel.saveNote(sessionId, buildText()) { success, _ -> if (success) onSaved() }
                },
            )
        }
    }
}

@Composable
private fun NotePushHeader(onBack: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        IconButtonGlass(Icons.AutoMirrored.Outlined.ArrowBack, "Назад", onClick = onBack)
        Text("Заметка после сессии", style = tSection, color = CompasFg, modifier = Modifier.padding(start = 12.dp))
    }
}

@Composable
private fun NoteContextCard(session: Session?, sessionId: String) {
    GlassTintCard(modifier = Modifier.fillMaxWidth(), padding = 16.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(session?.clientName ?: "Клиент", 44.dp, ring = true)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(session?.clientName ?: "Заметка клиента", style = tBody, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    session?.let { "${it.startTime} · ${it.durationMinutes()} мин · ${if (it.occurrenceIndex != null) "${it.occurrenceIndex}-я сессия" else "сессия"}" }
                        ?: "Контекст: $sessionId",
                    style = tMeta,
                    color = Color.White.copy(alpha = 0.72f),
                )
            }
            Icon(Icons.Outlined.EditNote, null, Modifier.size(22.dp), tint = CompasAccent400)
        }
    }
}

@Composable
private fun PrivacyBanner() {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Sage100).padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Outlined.VerifiedUser, null, Modifier.size(20.dp), tint = Forest700)
        Spacer(Modifier.width(10.dp))
        Column {
            Text("Приватная заметка", style = tBody, color = CompasFg)
            Text("Клиент её не видит. Хранится только у вас.", style = tMeta, color = CompasMutedFg)
        }
    }
}

@Composable
private fun NoteField(
    title: String,
    hint: String,
    value: String,
    minLines: Int = 3,
    onValueChange: (String) -> Unit,
) {
    GlassCard(modifier = Modifier.fillMaxWidth(), padding = 15.dp) {
        Text(title, style = tBody, color = CompasFg)
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text(hint) },
            minLines = minLines,
            shape = RoundedCornerShape(15.dp),
        )
    }
}

@Composable
private fun VoiceCapture(recording: Boolean, hasDraft: Boolean, onToggle: () -> Unit) {
    val transition = rememberInfiniteTransition(label = "voice")
    val wave by transition.animateFloat(
        initialValue = 0.35f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(520), RepeatMode.Reverse),
        label = "wave",
    )
    GlassCard(modifier = Modifier.fillMaxWidth(), strong = true, padding = 24.dp) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            if (recording) {
                Row(Modifier.height(38.dp), horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
                    repeat(7) { index ->
                        val factor = if (index % 2 == 0) wave else 1.2f - wave * 0.45f
                        Box(Modifier.width(5.dp).height((14 + 22 * factor).dp).clip(RoundedCornerShape(999.dp)).background(CompasDestructive))
                    }
                }
                Spacer(Modifier.height(14.dp))
            }
            val interaction = remember { MutableInteractionSource() }
            Box(
                Modifier.size(78.dp).clip(CircleShape)
                    .background(if (recording) Brush.linearGradient(listOf(Red, Color(0xFF8E1631))) else Brush.linearGradient(listOf(Forest700, Forest900)))
                    .clickable(interactionSource = interaction, indication = null, onClick = onToggle),
                contentAlignment = Alignment.Center,
            ) {
                Icon(if (recording) Icons.Outlined.Stop else Icons.Outlined.Mic, null, Modifier.size(32.dp), tint = Color.White)
            }
            Spacer(Modifier.height(12.dp))
            Text(
                when { recording -> "Идёт запись — нажмите, чтобы остановить"; hasDraft -> "Голосовой черновик сохранён"; else -> "Запишите голосом" },
                style = tBody,
                color = CompasFg,
            )
            Text("После сохранения запись можно будет расшифровать", style = tMeta, color = CompasMutedFg)
        }
    }
}

@Composable
private fun FlowRowCompat(content: @Composable RowScope.() -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(7.dp),
        verticalAlignment = Alignment.CenterVertically,
        content = content,
    )
}

@Composable
private fun TagPill(tag: String, onRemove: () -> Unit) {
    Row(
        Modifier.clip(RoundedCornerShape(999.dp)).background(Sage100).padding(start = 11.dp, end = 5.dp, top = 5.dp, bottom = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("#$tag", style = tMeta, color = Forest700)
        IconButton(onClick = onRemove, modifier = Modifier.size(24.dp)) {
            Icon(Icons.Outlined.Close, null, Modifier.size(14.dp), tint = Forest700)
        }
    }
}

@Composable
private fun AddTagPill(onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    Row(
        Modifier.clip(RoundedCornerShape(999.dp)).border(1.dp, CompasBorder, RoundedCornerShape(999.dp))
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .padding(horizontal = 11.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Outlined.Add, null, Modifier.size(14.dp), tint = CompasMutedFg)
        Spacer(Modifier.width(4.dp))
        Text("тег", style = tMeta, color = CompasMutedFg)
    }
}

@Composable
private fun AiHelperCard() {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(19.dp))
            .background(Brush.linearGradient(listOf(GoldSoft, Color(0xFFFFFBF1))))
            .border(1.dp, CompasAccent400.copy(alpha = 0.55f), RoundedCornerShape(19.dp))
            .padding(15.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(40.dp).clip(RoundedCornerShape(13.dp)).background(Color.White.copy(alpha = 0.7f)), contentAlignment = Alignment.Center) {
            Icon(Icons.Outlined.AutoAwesome, null, Modifier.size(21.dp), tint = CompasAccent)
        }
        Spacer(Modifier.width(11.dp))
        Column(Modifier.weight(1f)) {
            Text("AI-помощник", style = tBody, color = CompasFg)
            Text("После сохранения сделает резюме, предложит теги и подготовку к следующей сессии.", style = tMeta, color = CompasMutedFg)
        }
    }
}

private fun StringBuilder.appendBlock(title: String, content: String) {
    if (content.isNotBlank()) {
        if (isNotEmpty()) appendLine()
        appendLine("$title:")
        appendLine(content.trim())
    }
}

private fun extractBlock(text: String, title: String): String {
    val marker = "$title:"
    val start = text.indexOf(marker)
    if (start < 0) return ""
    val after = text.substring(start + marker.length)
    val markers = listOf("Запрос:", "Наблюдение:", "Интервенция:", "Динамика:", "Следующий шаг:").filterNot { it == marker }
    val end = markers.map { after.indexOf(it) }.filter { it >= 0 }.minOrNull() ?: after.length
    return after.substring(0, end).trim()
}

private fun Session.durationMinutes(): Long {
    val start = runCatching { java.time.LocalTime.parse(startTime) }.getOrNull()
    val end = runCatching { java.time.LocalTime.parse(endTime) }.getOrNull()
    return if (start != null && end != null) java.time.Duration.between(start, end).toMinutes() else 50
}
