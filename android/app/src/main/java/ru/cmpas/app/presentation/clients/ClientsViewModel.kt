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
import ru.cmpas.app.domain.model.ClientStatus
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
                        )
                    }
                    applyFilters()
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false) }
            }
        }
    }

    fun onSearchChange(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
        applyFilters()
    }

    fun setStatusFilter(status: ClientStatus?) {
        _uiState.update { it.copy(statusFilter = status) }
        applyFilters()
    }

    private fun applyFilters() {
        _uiState.update { state ->
            var filtered = state.allClients

            // Status filter
            state.statusFilter?.let { status ->
                filtered = filtered.filter { it.status == status }
            }

            // Search filter
            if (state.searchQuery.isNotBlank()) {
                filtered = filtered.filter {
                    it.name.contains(state.searchQuery, ignoreCase = true) ||
                    it.email?.contains(state.searchQuery, ignoreCase = true) == true ||
                    it.notes?.contains(state.searchQuery, ignoreCase = true) == true
                }
            }

            state.copy(filteredClients = filtered)
        }
    }
}

data class ClientsUiState(
    val isLoading: Boolean = false,
    val searchQuery: String = "",
    val statusFilter: ClientStatus? = null,
    val allClients: List<Client> = emptyList(),
    val filteredClients: List<Client> = emptyList(),
)
