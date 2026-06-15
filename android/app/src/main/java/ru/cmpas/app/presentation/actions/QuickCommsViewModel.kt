package ru.cmpas.app.presentation.actions

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.api.SendMessageRequest
import javax.inject.Inject

@HiltViewModel
class QuickCommsViewModel @Inject constructor(
    private val api: CompasApi,
) : ViewModel() {
    fun sendMessage(clientId: String, text: String) {
        viewModelScope.launch {
            runCatching {
                api.sendMessage(clientId, SendMessageRequest(type = "custom", text = text))
            }
        }
    }
}
