package ru.cmpas.app.presentation.notes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.analytics.AnalyticsRecorder
import ru.cmpas.app.data.analytics.NoteMode as AnalyticsNoteMode
import ru.cmpas.app.data.analytics.SinceSessionBucket
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.api.FeatureInterestRequest
import ru.cmpas.app.data.api.UpdateSessionRequest
import ru.cmpas.app.data.local.LocalPracticeStore
import ru.cmpas.app.domain.model.Session
import ru.cmpas.app.domain.model.SmartNoteBlock
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.temporal.ChronoUnit
import javax.inject.Inject

@HiltViewModel
class PostSessionNoteViewModel @Inject constructor(
    private val api: CompasApi,
    private val localStore: LocalPracticeStore,
    private val analytics: AnalyticsRecorder,
) : ViewModel() {
    private val _uiState = MutableStateFlow(PostSessionNoteUiState())
    val uiState = _uiState.asStateFlow()

    fun loadNote(sessionId: String) {
        viewModelScope.launch {
            val localText = localStore.getLatestNote(sessionId)?.text
            var session: Session? = null
            runCatching {
                val response = api.getSession(sessionId)
                if (response.isSuccessful) session = response.body()
            }.onFailure {
                runCatching {
                    val response = api.getSessions()
                    session = response.body()?.firstOrNull { it.id == sessionId }
                }
            }
            _uiState.update {
                it.copy(
                    session = session,
                    structuredNotes = session?.structuredNotes.orEmpty(),
                    savedText = session?.notesPlain?.takeIf(String::isNotBlank)
                        ?: session?.notes?.takeIf(String::isNotBlank)
                        ?: localText?.takeIf(String::isNotBlank),
                )
            }
        }
    }

    fun saveNote(sessionId: String, text: String, structuredNotes: List<SmartNoteBlock>, onFinished: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true) }
            try {
                // Заметка считается дошедшей до сервера, только если сессия
                // серверная И ответ успешен. Раньше у этой проверки не было
                // ветки else: при неуспешном ответе и при локальном sessionId
                // заметка оседала на устройстве, а пользователю сообщалось
                // «Заметка сохранена» — без единого признака, что на сервер
                // ничего не ушло и никогда не уйдёт.
                val delivered = if (sessionId.isRemoteSessionId()) {
                    val response = api.updateSession(
                        sessionId,
                        UpdateSessionRequest(notes = text, structuredNotes = structuredNotes),
                    )
                    if (response.isSuccessful) {
                        response.body()?.let { localStore.upsertSession(it) }
                        true
                    } else {
                        false
                    }
                } else {
                    false
                }
                localStore.saveNote(sessionId = sessionId, text = text)
                _uiState.update { state ->
                    state.copy(
                        isSaving = false,
                        savedText = text,
                        structuredNotes = structuredNotes,
                        session = state.session?.copy(notes = text, notesPlain = text, structuredNotes = structuredNotes),
                    )
                }
                onFinished(true, if (delivered) "Заметка сохранена" else "Заметка сохранена на устройстве")

                // Аналитика сохранения заметки
                runCatching {
                    val mode = if (structuredNotes.isNotEmpty()) AnalyticsNoteMode.BLOCKS else AnalyticsNoteMode.SHORT
                    val blocksFilled = structuredNotes.size.takeIf { it > 0 }
                    val sinceSessionBucket = runCatching {
                        computeSinceSessionBucket(_uiState.value.session)
                    }.getOrNull()
                    analytics.recordSessionNoteSaved(
                        delivered = delivered,
                        mode = mode,
                        blocksFilled = blocksFilled,
                        sinceSessionBucket = sinceSessionBucket,
                    )
                }
            } catch (_: Exception) {
                localStore.saveNote(sessionId = sessionId, text = text)
                _uiState.update { state ->
                    state.copy(
                        isSaving = false,
                        savedText = text,
                        session = state.session?.copy(notes = text, notesPlain = text),
                    )
                }
                onFinished(true, "Заметка сохранена на устройстве")

                // Аналитика сохранения при ошибке
                runCatching {
                    val mode = if (structuredNotes.isNotEmpty()) AnalyticsNoteMode.BLOCKS else AnalyticsNoteMode.SHORT
                    val blocksFilled = structuredNotes.size.takeIf { it > 0 }
                    val sinceSessionBucket = runCatching {
                        computeSinceSessionBucket(_uiState.value.session)
                    }.getOrNull()
                    analytics.recordSessionNoteSaved(
                        delivered = false,
                        mode = mode,
                        blocksFilled = blocksFilled,
                        sinceSessionBucket = sinceSessionBucket,
                    )
                }
            }
        }
    }

    fun markAiInterest(onFinished: (String) -> Unit) {
        if (_uiState.value.aiInterestRecorded || _uiState.value.isMarkingAiInterest) return
        viewModelScope.launch {
            _uiState.update { it.copy(isMarkingAiInterest = true) }
            val response = runCatching {
                api.markFeatureInterest(FeatureInterestRequest("ai_notes_assistant"))
            }.getOrNull()
            _uiState.update { it.copy(isMarkingAiInterest = false, aiInterestRecorded = response?.isSuccessful == true) }
            onFinished(if (response?.isSuccessful == true) "Вы в списке первыми" else "Не удалось записать интерес")
        }
    }

    fun noteEditorClosed(hadInput: Boolean) {
        viewModelScope.launch {
            runCatching {
                analytics.recordSessionNoteAbandoned(hadInput)
            }
        }
    }

    private fun computeSinceSessionBucket(session: Session?): SinceSessionBucket? {
        val session = session ?: return null
        val sessionDateTime = runCatching {
            val date = LocalDate.parse(session.date)
            val time = LocalTime.parse(session.startTime)
            LocalDateTime.of(date, time)
        }.getOrNull() ?: return null

        val now = LocalDateTime.now()

        return when {
            sessionDateTime.isAfter(now) -> SinceSessionBucket.BEFORE_SESSION
            else -> {
                val daysBetween = ChronoUnit.DAYS.between(sessionDateTime.toLocalDate(), now.toLocalDate()).toInt()
                when {
                    daysBetween == 0 -> SinceSessionBucket.SAME_DAY
                    daysBetween == 1 -> SinceSessionBucket.NEXT_DAY
                    daysBetween in 2..7 -> SinceSessionBucket.WITHIN_WEEK
                    else -> SinceSessionBucket.LATER
                }
            }
        }
    }

    private fun String.isRemoteSessionId(): Boolean =
        isNotBlank() && !startsWith("quick") && !startsWith("voice") && !startsWith("text") && !startsWith("template") && !startsWith("client-") && !startsWith("local-")
}

data class PostSessionNoteUiState(
    val isSaving: Boolean = false,
    val savedText: String? = null,
    val structuredNotes: List<SmartNoteBlock> = emptyList(),
    val session: Session? = null,
    val isMarkingAiInterest: Boolean = false,
    val aiInterestRecorded: Boolean = false,
)
