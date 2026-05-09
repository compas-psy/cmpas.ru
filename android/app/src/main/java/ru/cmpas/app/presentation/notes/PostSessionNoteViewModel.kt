package ru.cmpas.app.presentation.notes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.api.UpdateSessionRequest
import ru.cmpas.app.data.local.LocalPracticeStore
import javax.inject.Inject

@HiltViewModel
class PostSessionNoteViewModel @Inject constructor(
    private val api: CompasApi,
    private val localStore: LocalPracticeStore,
) : ViewModel() {
    private val _uiState = MutableStateFlow(PostSessionNoteUiState())
    val uiState = _uiState.asStateFlow()

    fun saveNote(sessionId: String, text: String, onFinished: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true) }
            try {
                if (sessionId.isNotBlank() && !sessionId.startsWith("quick") && !sessionId.startsWith("voice") && !sessionId.startsWith("text") && !sessionId.startsWith("template") && !sessionId.startsWith("client-") && !sessionId.startsWith("local-")) {
                    val response = api.updateSession(sessionId, UpdateSessionRequest(notes = text))
                    if (response.isSuccessful) {
                        response.body()?.let { localStore.upsertSession(it) }
                    }
                }
                localStore.saveNote(sessionId = sessionId, text = text)
                _uiState.update { it.copy(isSaving = false) }
                onFinished(true, "Заметка сохранена")
            } catch (_: Exception) {
                localStore.saveNote(sessionId = sessionId, text = text)
                _uiState.update { it.copy(isSaving = false) }
                onFinished(true, "Заметка сохранена локально")
            }
        }
    }
}

data class PostSessionNoteUiState(
    val isSaving: Boolean = false,
)
