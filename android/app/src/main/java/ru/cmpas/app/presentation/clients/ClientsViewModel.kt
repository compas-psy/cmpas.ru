package ru.cmpas.app.presentation.clients

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
class ClientsViewModel @Inject constructor(
    private val api: CompasApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ClientsUiState())
    val uiState = _uiState.asStateFlow()

    init {
        loadClients()
    }

    fun loadClients() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val response = api.getClients()
                if (response.isSuccessful) {
                    val clients = response.body() ?: emptyList()
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            allClients = clients,
                            filteredClients = clients,
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false) }
            }
        }
    }

    fun onSearchChange(query: String) {
        _uiState.update { state ->
            state.copy(
                searchQuery = query,
                filteredClients = if (query.isBlank()) state.allClients
                else state.allClients.filter {
                    it.name.contains(query, ignoreCase = true) ||
                    it.email?.contains(query, ignoreCase = true) == true
                }
            )
        }
    }
}

data class ClientsUiState(
    val isLoading: Boolean = false,
    val searchQuery: String = "",
    val allClients: List<Client> = emptyList(),
    val filteredClients: List<Client> = emptyList(),
)
