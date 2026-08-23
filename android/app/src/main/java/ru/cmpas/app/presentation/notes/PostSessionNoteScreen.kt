package ru.cmpas.app.presentation.notes

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.launch
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.domain.model.SmartNoteBlock
import ru.cmpas.app.presentation.components.*
import ru.cmpas.app.presentation.theme.*
import java.io.File
import kotlin.math.max

enum class NoteMode(val label: String) { SHORT("Кратко"), BLOCKS("По блокам"), VOICE("Голосом") }

@Composable
fun PostSessionNoteScreen(
    sessionId: String,
    onBack: () -> Unit,
    onSaved: () -> Unit,
    viewModel: PostSessionNoteViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
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
    var voiceFilePath by rememberSaveable { mutableStateOf<String?>(null) }
    var voiceDurationMs by rememberSaveable { mutableStateOf(0L) }
    var voiceStartedAt by remember { mutableStateOf(0L) }
    var micDenied by rememberSaveable { mutableStateOf(false) }
    var isPlayingVoice by rememberSaveable { mutableStateOf(false) }
    var recorder by remember { mutableStateOf<MediaRecorder?>(null) }
    var player by remember { mutableStateOf<MediaPlayer?>(null) }
    var restored by remember { mutableStateOf(false) }
    var hasSaved by remember { mutableStateOf(false) }

    fun startVoiceRecording() {
        runCatching {
            val output = newVoiceFile(context, sessionId)
            @Suppress("DEPRECATION")
            val nextRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) MediaRecorder(context) else MediaRecorder()
            nextRecorder.setAudioSource(MediaRecorder.AudioSource.MIC)
            nextRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            nextRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            // Speech, not music: mono/16kHz/32kbps AAC is clearly intelligible for a
            // spoken clinical note and ~4-6x smaller than the unconfigured defaults
            // (which default to a stereo, music-oriented bitrate on most devices).
            nextRecorder.setAudioChannels(1)
            nextRecorder.setAudioSamplingRate(16_000)
            nextRecorder.setAudioEncodingBitRate(32_000)
            nextRecorder.setOutputFile(output.absolutePath)
            nextRecorder.prepare()
            nextRecorder.start()
            recorder = nextRecorder
            voiceFilePath = output.absolutePath
            voiceStartedAt = System.currentTimeMillis()
            voiceDurationMs = 0L
            hasVoiceDraft = false
            micDenied = false
            isRecording = true
        }.onFailure {
            runCatching { recorder?.release() }
            recorder = null
            isRecording = false
            micDenied = true
        }
    }

    fun stopVoiceRecording() {
        val started = voiceStartedAt.takeIf { it > 0L } ?: System.currentTimeMillis()
        runCatching { recorder?.stop() }
        runCatching { recorder?.release() }
        recorder = null
        isRecording = false
        voiceDurationMs = max(1_000L, System.currentTimeMillis() - started)
        hasVoiceDraft = voiceFilePath?.let { File(it).exists() } == true
        // Only one take is ever surfaced per session (latestVoiceFile picks the
        // newest by timestamp) — without this, every re-recording silently leaves
        // the previous take orphaned on disk forever. Clean up only after
        // confirming the new take actually saved, so a failed re-record never
        // costs the user their previous good one.
        if (hasVoiceDraft) {
            val keepPath = voiceFilePath
            runCatching {
                voiceDirectory(context).listFiles { file ->
                    file.isFile && file.name.startsWith(safeSessionId(sessionId)) && file.extension == "m4a" && file.absolutePath != keepPath
                }?.forEach { it.delete() }
            }
        }
    }

    fun stopVoicePlayback() {
        runCatching { player?.stop() }
        runCatching { player?.release() }
        player = null
        isPlayingVoice = false
    }

    fun playVoiceDraft() {
        val path = voiceFilePath ?: return
        val file = File(path)
        if (!file.exists()) return
        if (isPlayingVoice) {
            stopVoicePlayback()
            return
        }
        runCatching {
            val nextPlayer = MediaPlayer()
            nextPlayer.setDataSource(file.absolutePath)
            nextPlayer.setOnCompletionListener {
                it.release()
                if (player === it) player = null
                isPlayingVoice = false
            }
            nextPlayer.prepare()
            nextPlayer.start()
            player = nextPlayer
            isPlayingVoice = true
        }
    }

    val requestMicPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) startVoiceRecording() else micDenied = true
    }

    fun toggleVoiceRecording() {
        if (isRecording) {
            stopVoiceRecording()
            return
        }
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            startVoiceRecording()
        } else {
            requestMicPermission.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            runCatching { if (isRecording) recorder?.stop() }
            runCatching { recorder?.release() }
            runCatching { player?.release() }

            // Аналитика: покидание экрана редактора без сохранения
            if (!hasSaved) {
                val hadInput = shortText.isNotBlank() || request.isNotBlank() || observation.isNotBlank() ||
                               intervention.isNotBlank() || dynamics.isNotBlank() || nextStep.isNotBlank() ||
                               (voiceFilePath != null && hasVoiceDraft)
                viewModel.noteEditorClosed(hadInput)
            }
        }
    }

    LaunchedEffect(sessionId) {
        viewModel.loadNote(sessionId)
        latestVoiceFile(context, sessionId)?.let { file ->
            voiceFilePath = file.absolutePath
            voiceDurationMs = voiceDurationMs(file.absolutePath)
            hasVoiceDraft = true
        }
    }
    LaunchedEffect(uiState.structuredNotes, uiState.savedText) {
        if (restored) return@LaunchedEffect
        val structured = uiState.structuredNotes
        val saved = uiState.savedText.orEmpty()
        if (structured.isNotEmpty()) {
            shortText = structured.blockText("short_note", "text")
            request = structured.blockText("request", "formulation")
            observation = structured.blockText("observation", "emotional_state")
            intervention = structured.blockText("intervention", "technique")
            dynamics = structured.blockText("dynamics", "changes")
            nextStep = structured.blockText("next_step", "focus")
            if (structured.any { it.definitionId == "voice_note" }) {
                mode = NoteMode.VOICE
                hasVoiceDraft = hasVoiceDraft || structured.blockText("voice_note", "text").isNotBlank()
            } else {
                mode = if (shortText.isNotBlank() && listOf(request, observation, intervention, dynamics, nextStep).all { it.isBlank() }) NoteMode.SHORT else NoteMode.BLOCKS
            }
            restored = true
        } else if (saved.isNotBlank()) {
            shortText = saved
            request = extractBlock(saved, "Запрос")
            observation = extractBlock(saved, "Наблюдение")
            intervention = extractBlock(saved, "Интервенция")
            dynamics = extractBlock(saved, "Динамика")
            nextStep = extractBlock(saved, "Следующий шаг")
            restored = true
        }
    }

    fun voiceNoteText(): String = "🎤 Голосовая заметка (${formatVoiceDuration(voiceDurationMs)})"

    fun showMessage(message: String) {
        scope.launch { snackbarHostState.showSnackbar(message) }
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
            NoteMode.VOICE -> append(if (hasVoiceDraft) voiceNoteText() else shortText.trim())
        }
    }.trim()

    fun buildStructured(): List<SmartNoteBlock> = buildStructuredNotes(
        mode = mode,
        shortText = shortText,
        request = request,
        observation = observation,
        intervention = intervention,
        dynamics = dynamics,
        nextStep = nextStep,
        voiceText = if (hasVoiceDraft) voiceNoteText() else shortText,
    )

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
                            durationMs = voiceDurationMs,
                            permissionDenied = micDenied,
                            playing = isPlayingVoice,
                            onToggle = { toggleVoiceRecording() },
                            onPlay = { playVoiceDraft() },
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
                item {
                    AiHelperCard(
                        isLoading = uiState.isMarkingAiInterest,
                        recorded = uiState.aiInterestRecorded,
                        onInterested = { viewModel.markAiInterest(::showMessage) },
                    )
                }
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
                enabled = !uiState.isSaving && !isRecording,
                modifier = Modifier.weight(1.55f),
                onClick = {
                    viewModel.saveNote(sessionId, buildText(), buildStructured()) { success, _ ->
                        if (success) {
                            hasSaved = true
                            onSaved()
                        }
                    }
                },
            )
        }
        SnackbarHost(snackbarHostState, Modifier.align(Alignment.TopCenter).padding(top = 12.dp))
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
private fun VoiceCapture(
    recording: Boolean,
    hasDraft: Boolean,
    durationMs: Long,
    permissionDenied: Boolean,
    playing: Boolean,
    onToggle: () -> Unit,
    onPlay: () -> Unit,
) {
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
                when {
                    recording -> "Идёт запись — нажмите, чтобы остановить"
                    hasDraft -> "Голосовая заметка записана · ${formatVoiceDuration(durationMs)}"
                    else -> "Запишите голосом"
                },
                style = tBody,
                color = CompasFg,
            )
            Text("Расшифровка появится в следующих версиях", style = tMeta, color = CompasMutedFg)
            if (permissionDenied) {
                Spacer(Modifier.height(10.dp))
                Text("Чтобы записать голосовую заметку, разрешите доступ к микрофону.", style = tMeta, color = CompasDestructive)
            }
            if (hasDraft) {
                Spacer(Modifier.height(14.dp))
                GhostButton(if (playing) "Остановить" else "Прослушать", onPlay, Modifier.fillMaxWidth(), if (playing) Icons.Outlined.Stop else Icons.Outlined.PlayArrow)
            }
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
private fun AiHelperCard(isLoading: Boolean, recorded: Boolean, onInterested: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(19.dp))
            .background(Brush.linearGradient(listOf(GoldSoft, Color(0xFFFFFBF1))))
            .border(1.dp, CompasAccent400.copy(alpha = 0.55f), RoundedCornerShape(19.dp))
            .padding(15.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(40.dp).clip(RoundedCornerShape(13.dp)).background(Color.White.copy(alpha = 0.7f)), contentAlignment = Alignment.Center) {
                Icon(Icons.Outlined.AutoAwesome, null, Modifier.size(21.dp), tint = CompasAccent)
            }
            Spacer(Modifier.width(11.dp))
            Column(Modifier.weight(1f)) {
                Text("AI-помощник · скоро ✨", style = tBody, color = CompasFg)
                Text("Будет делать резюме, предлагать теги и готовить фокус следующей сессии. Сейчас можно попасть в список первых.", style = tMeta, color = CompasMutedFg)
            }
        }
        Spacer(Modifier.height(12.dp))
        GhostButton(
            text = when {
                recorded -> "Вы в списке"
                isLoading -> "Записываем…"
                else -> "Хочу первым"
            },
            onClick = onInterested,
            modifier = Modifier.fillMaxWidth(),
            icon = if (recorded) Icons.Outlined.Check else Icons.Outlined.NotificationsActive,
        )
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

private fun List<SmartNoteBlock>.blockText(definitionId: String, preferredKey: String): String {
    val block = firstOrNull { it.definitionId == definitionId } ?: return ""
    return block.values[preferredKey]?.trim().takeUnless { it.isNullOrBlank() }
        ?: block.values.values.joinToString("\n") { it.trim() }.trim()
}

private fun buildStructuredNotes(
    mode: NoteMode,
    shortText: String,
    request: String,
    observation: String,
    intervention: String,
    dynamics: String,
    nextStep: String,
    voiceText: String,
): List<SmartNoteBlock> {
    val createdAt = java.time.Instant.now().toString()
    fun block(definitionId: String, key: String, text: String): SmartNoteBlock? =
        text.trim().takeIf { it.isNotBlank() }?.let {
            SmartNoteBlock(
                id = "android-$definitionId-${System.nanoTime()}",
                definitionId = definitionId,
                values = mapOf(key to it),
                createdAt = createdAt,
            )
        }
    return when (mode) {
        NoteMode.SHORT -> listOfNotNull(block("short_note", "text", shortText))
        NoteMode.BLOCKS -> listOfNotNull(
            block("request", "formulation", request),
            block("observation", "emotional_state", observation),
            block("intervention", "technique", intervention),
            block("dynamics", "changes", dynamics),
            block("next_step", "focus", nextStep),
        )
        NoteMode.VOICE -> listOfNotNull(block("voice_note", "text", voiceText))
    }
}

private fun Session.durationMinutes(): Long {
    val start = runCatching { java.time.LocalTime.parse(startTime) }.getOrNull()
    val end = runCatching { java.time.LocalTime.parse(endTime) }.getOrNull()
    return if (start != null && end != null) java.time.Duration.between(start, end).toMinutes() else 50
}

private fun safeSessionId(id: String): String = id.replace(Regex("[^A-Za-z0-9_-]"), "_")

private fun voiceDirectory(context: Context): File = File(context.filesDir, "voice-notes").apply { mkdirs() }

private fun newVoiceFile(context: Context, sessionId: String): File =
    File(voiceDirectory(context), "${safeSessionId(sessionId)}-${System.currentTimeMillis()}.m4a")

private fun latestVoiceFile(context: Context, sessionId: String): File? =
    voiceDirectory(context).listFiles { file ->
        file.isFile && file.name.startsWith(safeSessionId(sessionId)) && file.extension == "m4a"
    }?.maxByOrNull { it.lastModified() }

private fun voiceDurationMs(path: String): Long = runCatching {
    val mp = MediaPlayer()
    mp.setDataSource(path)
    mp.prepare()
    val duration = mp.duration.toLong()
    mp.release()
    duration
}.getOrDefault(0L)

private fun formatVoiceDuration(durationMs: Long): String {
    val seconds = max(1L, durationMs / 1_000L)
    val minutes = seconds / 60
    val rest = seconds % 60
    return "$minutes:${rest.toString().padStart(2, '0')}"
}
