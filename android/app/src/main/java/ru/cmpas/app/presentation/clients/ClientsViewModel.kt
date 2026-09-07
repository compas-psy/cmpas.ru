package ru.cmpas.app.presentation.clients

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.local.LocalPracticeStore
import ru.cmpas.app.domain.model.Client
import ru.cmpas.app.domain.model.ClientStatus
import ru.cmpas.app.presentation.util.PracticeRefreshBus
import javax.inject.Inject

@HiltViewModel
class ClientsViewModel @Inject constructor(
    private val api: CompasApi,
    private val localStore: LocalPracticeStore,
) : ViewModel() {
    private val _uiState = MutableStateFlow(ClientsUiState())
    val uiState = _uiState.asStateFlow()

    init {
        loadClients()
        viewModelScope.launch {
            PracticeRefreshBus.changes.collectLatest { loadClients(false) }
        }
    }

    fun refresh() = loadClients(false)

    fun loadClients(showLoader: Boolean = true) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = showLoader && it.allClients.isEmpty(), isRefreshing = !showLoader) }
            val localClients = localStore.getClients()
            try {
                val response = api.getClients()
                if (response.isSuccessful) {
                    val remoteClients = response.body().orEmpty()
                    remoteClients.forEach(localStore::upsertClient)
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isRefreshing = false,
                            error = null,
                            allClients = mergeClients(remoteClients, localStore.getClients()),
                        )
                    }
                } else {
                    // Неуспешный ответ раньше превращался в ПУСТОЙ список
                    // клиентов, и склейка с кэшем отдавала старый состав как
                    // будто он свежий. Экран выглядел обычным, просто без
                    // нового клиента — то есть отказ был неотличим от «всё в
                    // порядке, у вас правда столько клиентов».
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isRefreshing = false,
                            error = "Не удалось получить список с сервера (код ${response.code()}). Показан сохранённый.",
                            allClients = if (it.allClients.isEmpty()) localClients else it.allClients,
                        )
                    }
                }
            } catch (_: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isRefreshing = false,
                        error = "Нет связи с сервером. Показан сохранённый список.",
                        allClients = if (it.allClients.isEmpty()) localClients else it.allClients,
                    )
                }
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

    private fun mergeClients(remote: List<Client>, local: List<Client>): List<Client> =
        (remote + local).distinctBy { it.id }.sortedBy { it.name.lowercase() }
}

data class ClientsUiState(
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    /**
     * Почему список может быть устаревшим. null — список свежий.
     *
     * Раньше поля не было вовсе: любой отказ (401, 500, обрыв связи,
     * неразобранный ответ) молча подменял список сохранённым, и человек
     * видел обычный экран без нового клиента. Отличить «клиента нет» от
     * «мы не смогли спросить» было невозможно — ни ему, ни нам.
     */
    val error: String? = null,
    val searchQuery: String = "",
    val statusFilter: ClientStatus? = null,
    val allClients: List<Client> = emptyList(),
    val filteredClients: List<Client> = emptyList(),
)
