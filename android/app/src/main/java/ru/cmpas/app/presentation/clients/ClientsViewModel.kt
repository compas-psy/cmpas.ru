package ru.cmpas.app.presentation.clients

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.local.LocalPracticeStore
import ru.cmpas.app.domain.model.Client
import ru.cmpas.app.domain.model.ClientStatus
import javax.inject.Inject

@HiltViewModel
class ClientsViewModel @Inject constructor(
    private val api: CompasApi,
    private val localStore: LocalPracticeStore,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ClientsUiState())
    val uiState = _uiState.asStateFlow()

    init { loadClients() }

    fun loadClients() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val localClients = localStore.getClients()
            try {
                val response = api.getClients()
                val remoteClients = if (response.isSuccessful) response.body().orEmpty() else emptyList()
                remoteClients.forEach { localStore.upsertClient(it) }
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        allClients = mergeClients(remoteClients, localStore.getClients()),
                    )
                }
            } catch (_: Exception) {
                _uiState.update { it.copy(isLoading = false, allClients = localClients) }
            }
            applyFilters()
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
            state.statusFilter?.let { status -> filtered = filtered.filter { it.status == status } }
            if (state.searchQuery.isNotBlank()) {
                filtered = filtered.filter {
                    it.name.contains(state.searchQuery, ignoreCase = true) ||
                        it.email?.contains(state.searchQuery, ignoreCase = true) == true ||
                        it.phone?.contains(state.searchQuery, ignoreCase = true) == true ||
                        it.notes?.contains(state.searchQuery, ignoreCase = true) == true
                }
            }
            state.copy(filteredClients = filtered.sortedBy { it.name.lowercase() })
        }
    }

    private fun mergeClients(remote: List<Client>, local: List<Client>): List<Client> {
        return (remote + local).distinctBy { it.id }.sortedBy { it.name.lowercase() }
    }
}

data class ClientsUiState(
    val isLoading: Boolean = false,
    val searchQuery: String = "",
    val statusFilter: ClientStatus? = null,
    val allClients: List<Client> = emptyList(),
    val filteredClients: List<Client> = emptyList(),
)
