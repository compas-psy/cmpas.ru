package ru.cmpas.app.presentation.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.api.MagicLinkRequest
import ru.cmpas.app.data.api.SimpasIdExchangeRequest
import ru.cmpas.app.data.datastore.UserPreferences
import ru.cmpas.simpasid.Platform
import ru.cmpas.simpasid.SimpasIdClient
import javax.inject.Inject

/**
 * ВХОД: СИМПАС ГЛАВНОЙ ДВЕРЬЮ, ПРЕЖНИЕ СПОСОБЫ — ЗАПАСНОЙ.
 *
 * Почему не заменой. Рецепт СИМПАС (docs/integration/practice-android.md)
 * в первых же строках говорит: «добавляет вход СИМПАС РЯДОМ с действующими;
 * не выключает вход по ссылке из письма». Причина не в осторожности: пять
 * специалистов из шестнадцати входят ТОЛЬКО магической ссылкой на почту,
 * учётной записи в СИМПАС у них нет, и выключение заперло бы их снаружи
 * собственной практики. Ровно тот же довод уже записан в вебе
 * (src/lib/auth/simpasid.ts).
 *
 * Почему браузера нет ни разу. Требование СИМПАС 12_NATIVE_AUTH: вход идёт
 * первичным токен-API. Приложение, собирающее пароль от чужого сервиса, —
 * готовая схема фишинга, и именно против неё придуман OAuth. Поэтому на
 * почту приходит КОД, а не ссылка: ссылка увела бы человека в почтовый
 * клиент и браузер, откуда в приложение он не возвращается.
 *
 * Про кнопки провайдеров. Состав — ПЕРЕСЕЧЕНИЕ двух перечней: что готов
 * принять сервер (`authMethods`) и чьи нативные SDK собраны в приложение.
 * Ни один из перечней не зашивается в код: сервер не знает, какие SDK мы
 * собрали, приложение не знает, какие ключи заведены у СИМПАС.
 *
 * Сегодня наша половина пуста — нативных SDK Яндекса и VK в сборке нет,
 * поэтому нативных кнопок на главном экране не появляется. Прежняя кнопка
 * «Войти через Яндекс» при этом НЕ УБРАНА, а переехала в запасную дверь:
 * убрать работающий вход, не собрав замену, — это изъятие, а не переезд
 * (сторона СИМПАС, issue #172, 11.09.2026). Она вернётся на главное место
 * нативной, когда SDK окажется в сборке.
 */
@HiltViewModel
class LoginViewModel @Inject constructor(
    private val api: CompasApi,
    private val userPreferences: UserPreferences,
    private val simpasId: SimpasIdClient,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState = _uiState.asStateFlow()

    init {
        loadSimpasIdState()
    }

    /**
     * Что умеет единый вход и какая редакция Соглашения сейчас действует.
     *
     * Номер редакции спрашивается у сервера, а не вписан в сборку: он
     * меняется без выпуска приложения, и вписанный однажды отправил бы
     * человека принимать не ту редакцию, которую он видит.
     */
    private fun loadSimpasIdState() {
        viewModelScope.launch {
            try {
                val methods = simpasId.authMethods(Platform.ANDROID)
                val documents = simpasId.legalDocuments()
                val terms = documents.firstOrNull { it.documentCode == CENTRAL_TERMS_CODE }
                _uiState.update {
                    it.copy(
                        simpasIdAvailable = methods.email,
                        // Пересечение: сервер называет доступные провайдеры,
                        // приложение — те, чей нативный SDK у него есть.
                        // Показать провайдера без SDK значит показать кнопку,
                        // которая уводит в браузер.
                        // Три условия, а не два: сервер назвал провайдера,
                        // у нас есть его SDK И сервер прислал идентификатор
                        // приложения. Без идентификатора SDK нечем завести, и
                        // нажатие увело бы человека в ошибку провайдера
                        // (рецепт СИМПАС, шаг 4).
                        providers = methods.providers.filter { name ->
                            name in PROVIDERS_WITH_NATIVE_SDK && !methods.providerAppIds[name].isNullOrBlank()
                        },
                        providerAppIds = methods.providerAppIds,
                        centralTermsVersion = terms?.version,
                    )
                }
            } catch (error: Exception) {
                // Единый вход недоступен — это не поломка ПРАКТИКИ, и
                // человека из приложения никто не выкидывает: запасная
                // дверь на экране остаётся.
                _uiState.update { it.copy(simpasIdAvailable = false, simpasIdDown = true) }
            }
        }
    }

    fun onEmailChange(email: String) {
        _uiState.update { it.copy(email = email, error = null) }
    }

    fun onCodeChange(code: String) {
        _uiState.update { it.copy(code = code.filter { ch -> ch.isDigit() }.take(CODE_LENGTH), error = null) }
    }

    /** Назад к выбору способа входа — из кода и из запасной двери. */
    fun backToStart() {
        _uiState.update { it.copy(step = LoginStep.EMAIL, code = "", error = null) }
    }

    fun openFallback() {
        _uiState.update { it.copy(step = LoginStep.FALLBACK_EMAIL, error = null) }
    }

    // ── Единый вход ──────────────────────────────────────────────────

    /** Шаг первый: просим прислать код на почту. */
    fun requestSimpasIdCode() {
        val email = _uiState.value.email.trim()
        if (!looksLikeEmail(email)) {
            _uiState.update { it.copy(error = "Введите корректный email") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val deviceKey = userPreferences.getOrCreateDeviceKey()
                val pause = simpasId.startEmailAuth(
                    email = email,
                    deviceKey = deviceKey,
                    platform = Platform.ANDROID,
                    termsVersion = _uiState.value.centralTermsVersion,
                )
                _uiState.update {
                    it.copy(isLoading = false, step = LoginStep.CODE, resendPauseSeconds = pause, code = "")
                }
            } catch (error: Exception) {
                _uiState.update { it.copy(isLoading = false, error = SIGN_IN_UNAVAILABLE) }
            }
        }
    }

    /** Шаг второй: код из письма превращается в личность, а та — в нашу сессию. */
    fun verifySimpasIdCode() {
        val email = _uiState.value.email.trim()
        val code = _uiState.value.code
        if (code.length < CODE_LENGTH) {
            _uiState.update { it.copy(error = "Введите код из письма") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null, step = LoginStep.VERIFY) }
            try {
                val deviceKey = userPreferences.getOrCreateDeviceKey()
                val tokens = simpasId.verifyEmailAuth(email, code, deviceKey, Platform.ANDROID)
                adoptSimpasIdSession(tokens.accessToken, tokens.account.id)
            } catch (error: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, step = LoginStep.CODE, error = "Код не подошёл. Проверьте и попробуйте снова")
                }
            }
        }
    }

    // ── Вход через провайдера ────────────────────────────────────────

    /**
     * Начать вход через провайдера его НАТИВНЫМ SDK.
     *
     * Здесь недостаёт ровно одного — самого SDK в сборке. Всё, что после
     * кода, уже написано и работает: completeProviderSignIn ниже.
     *
     * Кнопка провайдера показывается только при пересечении двух перечней,
     * и наша половина сегодня пуста, поэтому сюда не попасть. Метод всё
     * равно отвечает честно, а не молчит: молчащая кнопка хуже отсутствующей.
     */
    fun signInWithProvider(provider: String) {
        _uiState.update { it.copy(error = SIGN_IN_UNAVAILABLE) }
    }

    /**
     * Вход через провайдера отменён или не удался.
     *
     * Отмена — не ошибка: человек передумал, и красная строка на экране
     * была бы обвинением. Поэтому отмена просто возвращает экран в
     * исходное состояние, а отказ провайдера называется общей фразой.
     */
    fun onProviderSignInAborted(failed: Boolean) {
        _uiState.update {
            it.copy(isLoading = false, step = LoginStep.EMAIL, error = if (failed) SIGN_IN_UNAVAILABLE else null)
        }
    }

    /**
     * Подписанный провайдером JWT — в личность, личность — в нашу сессию.
     *
     * Для SDK, которые кода не отдают. Android-SDK Яндекса из них: его
     * результат — `YandexAuthResult.Success(YandexAuthToken)`, типа с кодом
     * авторизации в публичном API нет вовсе (проверено чтением артефакта
     * com.yandex.android:authsdk:3.2.1).
     *
     * Голый ключ доступа сюда не попадает и сервером не принимается: ключ,
     * выданный чужому приложению, подходит к справочнику профиля так же,
     * как наш, и подменой токена можно было бы войти чужой учётной
     * записью. Отличает «провайдер подтвердил» от «приложение сказало»
     * только подпись.
     */
    fun completeProviderJwtSignIn(provider: String, providerJwt: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null, step = LoginStep.VERIFY) }
            try {
                val deviceKey = userPreferences.getOrCreateDeviceKey()
                val tokens = simpasId.exchangeProviderJwt(
                    provider = provider,
                    providerJwt = providerJwt,
                    deviceKey = deviceKey,
                    platform = Platform.ANDROID,
                )
                adoptSimpasIdSession(tokens.accessToken, tokens.account.id)
            } catch (error: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, step = LoginStep.EMAIL, error = SIGN_IN_UNAVAILABLE)
                }
            }
        }
    }

    /**
     * Код от нативного SDK — в личность, личность — в нашу сессию.
     *
     * Почему у VK четыре поля, а у Яндекса одно: в браузерном входе
     * авторизацию начинает сервер и потому знает и строку состояния, и
     * проверочный код PKCE. В нативном её начинает приложение — эти
     * значения существуют только у него. VK требует их все, Яндексу хватает
     * кода (сторона СИМПАС, issue #172).
     *
     * codeVerifier секретом не является: это одноразовая величина одной
     * попытки входа.
     */
    fun completeProviderSignIn(
        provider: String,
        providerCode: String,
        codeVerifier: String? = null,
        providerDeviceId: String? = null,
        state: String? = null,
        redirectUri: String? = null,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null, step = LoginStep.VERIFY) }
            try {
                val deviceKey = userPreferences.getOrCreateDeviceKey()
                val tokens = simpasId.exchangeProviderCode(
                    provider = provider,
                    providerCode = providerCode,
                    deviceKey = deviceKey,
                    platform = Platform.ANDROID,
                    codeVerifier = codeVerifier,
                    providerDeviceId = providerDeviceId,
                    state = state,
                    redirectUri = redirectUri,
                )
                adoptSimpasIdSession(tokens.accessToken, tokens.account.id)
            } catch (error: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, step = LoginStep.EMAIL, error = SIGN_IN_UNAVAILABLE)
                }
            }
        }
    }

    /**
     * Ключ СИМПАС превращается в нашу сессию.
     *
     * Один путь для входа по коду и для входа через провайдера: расходиться
     * им незачем, а разойдясь — они разойдутся молча.
     */
    private suspend fun adoptSimpasIdSession(simpasAccessToken: String, accountId: String) {
        // Ключ СИМПАС нужен дальше ровно для одного: сказать консент-центру,
        // что человек принял Особые условия ПРАКТИКИ.
        userPreferences.saveSimpasIdSession(simpasAccessToken, accountId)

        val exchanged = api.exchangeSimpasIdToken(SimpasIdExchangeRequest(simpasAccessToken))
        val ours = exchanged.body()
        if (!exchanged.isSuccessful || ours == null) {
            _uiState.update { it.copy(isLoading = false, step = LoginStep.EMAIL, error = SIGN_IN_UNAVAILABLE) }
            return
        }

        userPreferences.saveTokens(ours.accessToken, ours.refreshToken)
        _uiState.update { it.copy(isLoading = false, isAuthenticated = true) }
    }

    // ── Запасная дверь: прежние способы входа ────────────────────────

    fun requestMagicLink() {
        val email = _uiState.value.email.trim()
        if (!looksLikeEmail(email)) {
            _uiState.update { it.copy(error = "Введите корректный email") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val response = api.requestMagicLink(MagicLinkRequest(email))
                if (response.isSuccessful) {
                    _uiState.update { it.copy(isLoading = false, step = LoginStep.CHECK_EMAIL) }
                } else {
                    _uiState.update { it.copy(isLoading = false, error = "Не удалось отправить ссылку") }
                }
            } catch (error: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, error = "Ошибка подключения: ${error.localizedMessage}")
                }
            }
        }
    }

    private fun looksLikeEmail(value: String): Boolean =
        value.isNotBlank() && value.contains("@") && value.substringAfterLast("@").contains(".")

    companion object {
        /** Код центрального Пользовательского соглашения в реестре СИМПАС. */
        const val CENTRAL_TERMS_CODE = "cmpas_terms"

        /**
         * Провайдеры, чей НАТИВНЫЙ SDK подключён к приложению.
         *
         * Яндекс — есть: com.yandex.android:authsdk. ВК пока нет, и причина
         * не в лени: его SDK требует идентификатор приложения ВНУТРИ сборки
         * (manifest placeholder VKIDClientID и, что неустранимо, схема
         * возврата VKIDRedirectScheme = "vk" + идентификатор — это
         * intent-фильтр манифеста, вычислить его после установки нельзя).
         * Значение придёт от учредителя отдельным секретом; до тех пор
         * кнопки ВК на экране быть не должно.
         */
        val PROVIDERS_WITH_NATIVE_SDK: Set<String> = setOf(PROVIDER_YANDEX)

        /**
         * Прежний вход через Яндекс — уходом в системный браузер.
         *
         * Требованию СИМПАС он не отвечает: код возвращается на веб-адрес
         * ПРАКТИКИ, а не приложению, и человека уносит из приложения. Но
         * он РАБОТАЕТ, и им пользуются. Живёт в запасной двери до тех пор,
         * пока не соберётся нативный SDK, и выключается в тот же день, а
         * не раньше.
         */
        const val LEGACY_YANDEX_URL = "https://oauth.yandex.ru/authorize" +
            "?response_type=code" +
            "&client_id=1b261cbc153045beb7d707389fc27515" +
            "&redirect_uri=https%3A%2F%2Fcmpas.ru%2Fapi%2Fmobile%2Fauth%2Fyandex%2Fcallback" +
            "&force_confirm=yes"

        /** Имена провайдеров в реестре СИМПАС. */
        const val PROVIDER_YANDEX = "yandex"
        const val PROVIDER_VK = "vkid"

        /** Подпись кнопки провайдера. Человеку — имя сервиса, а не код. */
        fun providerLabel(provider: String): String = when (provider) {
            PROVIDER_YANDEX -> "Войти через Яндекс"
            PROVIDER_VK -> "Войти через VK"
            else -> "Войти через $provider"
        }

        const val CODE_LENGTH = 6

        /** Дословно из рецепта: ни кода ошибки, ни адреса сервера человеку. */
        const val SIGN_IN_UNAVAILABLE = "Вход временно недоступен. Мы уже чиним. Попробуйте через несколько минут."
    }
}
