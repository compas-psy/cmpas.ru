package ru.cmpas.app.presentation.connect

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.BuildConfig
import ru.cmpas.app.data.datastore.UserPreferences
import ru.cmpas.app.data.simpasid.GrantResult
import ru.cmpas.app.data.simpasid.SimpasIdConsentClient
import ru.cmpas.simpasid.SimpasIdClient
import javax.inject.Inject

/**
 * ПЕРВОЕ ПОДКЛЮЧЕНИЕ ПРАКТИКИ.
 *
 * Единственное место, где продукт собирает акцепт. Пользовательское
 * соглашение Экосистемы принимается в СИМПАС при создании учётной записи;
 * продукт центральные документы не принимает вовсе. Здесь принимаются
 * Особые условия ПРАКТИКИ — документ о ЭТОМ сервисе
 * (14_LEGAL_PRODUCTS_UNIFIED.md §1, §4).
 *
 * НОМЕР РЕДАКЦИИ СПРАШИВАЕТСЯ У СЕРВЕРА И НИКОГДА НЕ ВПИСЫВАЕТСЯ В СБОРКУ.
 * Он меняется без выпуска приложения; вписанный однажды показал бы человеку
 * не ту редакцию, которую он принимает. Сервер к тому же отвергнет акцепт на
 * чужую редакцию (409 stale_document_version) — это защита, а не помеха.
 *
 * ДОКУМЕНТА БЕЗ ОПУБЛИКОВАННОЙ РЕДАКЦИИ В ОТВЕТЕ НЕТ. Если строки про
 * ПРАКТИКУ не пришло — Особые условия не опубликованы, принимать нечего, и
 * показывать этот экран запрещено. Сегодня это ровно так: тексты в
 * консент-центр ещё не легли, и экран не покажется никому.
 *
 * ЭКРАН НИКОГО НЕ ЗАПИРАЕТ. Любая неудача — нет ключа СИМПАС, единый вход
 * молчит, ключ истёк — пропускает человека в приложение. Он вошёл, он
 * работает; заблокировать ему практику из-за недоступности чужой службы
 * было бы хуже, чем отложить акцепт.
 */
sealed interface ServiceConnectState {
    data object Checking : ServiceConnectState

    /** Принимать нечего — пропускаем дальше молча. */
    data object NothingToAccept : ServiceConnectState

    data class Offer(
        val documentCode: String,
        val title: String,
        val version: String,
        /** Полный адрес ИМЕННО ЭТОЙ редакции. */
        val url: String,
        val isSending: Boolean = false,
        val error: String? = null,
    ) : ServiceConnectState

    data object Accepted : ServiceConnectState
}

@HiltViewModel
class ServiceConnectViewModel @Inject constructor(
    private val simpasId: SimpasIdClient,
    private val consents: SimpasIdConsentClient,
    private val userPreferences: UserPreferences,
) : ViewModel() {

    private val _state = MutableStateFlow<ServiceConnectState>(ServiceConnectState.Checking)
    val state = _state.asStateFlow()

    init {
        check()
    }

    private fun check() {
        viewModelScope.launch {
            _state.value = resolve()
        }
    }

    private suspend fun resolve(): ServiceConnectState {
        // Вошёл прежним способом — учётной записи в СИМПАС у него может не
        // быть вовсе, и отправлять акцепт некуда.
        val token = userPreferences.getSimpasIdAccessToken() ?: return ServiceConnectState.NothingToAccept

        val document = runCatching {
            simpasId.legalDocuments().firstOrNull { it.product == PRODUCT }
        }.getOrNull() ?: return ServiceConnectState.NothingToAccept

        // Уже принимал — второй раз не спрашиваем. Новая редакция сама по
        // себе повода не даёт: повторный акцепт собирается только при
        // СУЩЕСТВЕННОМ изменении, а судить о существенности продукт не
        // вправе — это решение того, кто выпускает документ
        // (14_LEGAL_PRODUCTS_UNIFIED.md §8.3-8.4).
        val already = runCatching { consents.accepted(token) }.getOrDefault(emptyList())
        if (already.any { it.documentCode == document.documentCode }) {
            return ServiceConnectState.NothingToAccept
        }

        return ServiceConnectState.Offer(
            documentCode = document.documentCode,
            title = document.title,
            version = document.version,
            url = absolute(document.url),
        )
    }

    /** Человек нажал содержательную кнопку — это и есть акцепт действием. */
    fun accept() {
        val offer = _state.value as? ServiceConnectState.Offer ?: return
        if (offer.isSending) return

        viewModelScope.launch {
            _state.value = offer.copy(isSending = true, error = null)
            val token = userPreferences.getSimpasIdAccessToken()
            if (token == null) {
                _state.value = ServiceConnectState.NothingToAccept
                return@launch
            }

            when (consents.grant(token, offer.documentCode, offer.version, ACTION)) {
                GrantResult.Ok -> _state.value = ServiceConnectState.Accepted

                // Экран показывал не ту редакцию, что действует сейчас.
                // Молча записать «как-нибудь» нельзя: согласие даётся на
                // редакцию, которую человек ВИДЕЛ. Перечитываем и показываем
                // заново.
                GrantResult.StaleVersion -> _state.value = resolve().let { fresh ->
                    if (fresh is ServiceConnectState.Offer) {
                        fresh.copy(error = "Условия обновились — посмотрите новую редакцию")
                    } else {
                        fresh
                    }
                }

                // Ключ истёк. Не запираем: человек вошёл в ПРАКТИКУ и
                // работает, акцепт спросим в следующий раз.
                GrantResult.Unauthorized -> _state.value = ServiceConnectState.NothingToAccept

                is GrantResult.Failed -> _state.value = offer.copy(
                    isSending = false,
                    error = "Не удалось записать. Попробуйте ещё раз",
                )
            }
        }
    }

    private fun absolute(url: String): String =
        if (url.startsWith("http")) url else BuildConfig.SIMPASID_ISSUER.trimEnd('/') + url

    companion object {
        /** Код продукта в реестре документов. */
        const val PRODUCT = "practice"

        /**
         * Имя действия, которым человек выразил согласие.
         *
         * Это не «нажал кнопку»: в записи о согласии остаётся именно
         * действие, и «начал работу в ПРАКТИКЕ» — то, что человек сделал.
         */
        const val ACTION = "started_practice"
    }
}
