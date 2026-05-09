package ru.cmpas.app.presentation.actions

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.domain.model.Client
import javax.inject.Inject

@HiltViewModel
class QuickActionViewModel @Inject constructor(
    private val api: CompasApi,
) : ViewModel() {
    private val _uiState = MutableStateFlow(QuickActionUiState())
    val uiState = _uiState.asStateFlow()

    init {
        loadClients()
    }

    fun loadClients() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingClients = true) }
            try {
                val response = api.getClients()
                val clients = if (response.isSuccessful) response.body().orEmpty() else emptyList()
                _uiState.update { it.copy(isLoadingClients = false, clients = clients) }
            } catch (_: Exception) {
                _uiState.update { it.copy(isLoadingClients = false, clients = emptyList()) }
            }
        }
    }
}

data class QuickActionUiState(
    val isLoadingClients: Boolean = false,
    val clients: List<Client> = emptyList(),
)
