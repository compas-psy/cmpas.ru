package ru.cmpas.app.presentation.auth

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.cmpas.app.BuildConfig
import ru.cmpas.app.data.api.CompasApi
import ru.cmpas.app.data.api.MagicLinkRequest
import ru.cmpas.app.data.api.SimpasIdExchangeRequest
import ru.cmpas.app.data.datastore.UserPreferences
import ru.cmpas.simpasid.LegalDocument
import ru.cmpas.simpasid.Platform
import ru.cmpas.simpasid.SimpasIdClient
import ru.cmpas.simpasid.SimpasIdException
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
                val legalLinks = legalLinksFrom(documents)
                _uiState.update {
                    it.copy(
                        simpasIdAvailable = methods.email,
                        // Пересечение: сервер называет доступные провайдеры,
                        // приложение — те, чей нативный SDK у него есть.
                        // Показать провайдера без SDK значит показать кнопку,
                        // которая уводит в браузер.
                        // Кнопка показывается, только если идентификатор
                        // приложения в сборке СОВПАЛ с тем, что назвал
                        // сервер. Это сильнее, чем «есть SDK и есть
                        // идентификатор»: сменят идентификатор у себя —
                        // кнопка исчезнет, а не поведёт в отказ провайдера.
                        providers = methods.providers.filter { name ->
                            matchesBuiltInAppId(name, methods.providerAppIds[name])
                        },
                        providerAppIds = methods.providerAppIds,
                        centralTermsVersion = terms?.version,
                        legalLinks = legalLinks,
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
        _uiState.update { it.copy(email = email, error = null, errorDetails = null) }
    }

    fun onCodeChange(code: String) {
        _uiState.update { it.copy(code = code.filter { ch -> ch.isDigit() }.take(CODE_LENGTH), error = null) }
    }

    /** Назад к выбору способа входа — из кода и из запасной двери. */
    fun backToStart() {
        _uiState.update { it.copy(step = LoginStep.EMAIL, code = "", error = null, errorDetails = null) }
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
                _uiState.update { it.copy(isLoading = false, error = signInErrorMessage(error)) }
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
                // «Код не подошёл» на исчерпанных попытках — ложь: человек
                // может вводить верный код, а его уже не принимают.
                val message = if ((error as? SimpasIdException)?.code == "too_many_attempts") {
                    signInErrorMessage(error)
                } else {
                    "Код не подошёл. Проверьте и попробуйте снова"
                }
                _uiState.update { it.copy(isLoading = false, step = LoginStep.CODE, error = message) }
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
    fun onProviderSignInAborted(failed: Boolean, reason: String? = null) {
        // Отказ здесь — это отказ ПРОВАЙДЕРА (не дал токен, не отдал JWT), а
        // не наша поломка. Общая фраза «мы уже чиним» звала бы ждать того,
        // чего не случится: у человека есть рабочий второй путь, и назвать
        // его — единственное полезное, что тут можно сделать.
        //
        // ТЕКСТ РАЗНЫЙ ДЛЯ УСТРОЙСТВА И ДЛЯ СЕРВЕРА. Раньше здесь и на
        // отказе обмена стояла одна фраза, и по снимку экрана нельзя было
        // сказать, где именно вход развалился: в SDK на телефоне или в
        // обмене кода у СИМПАС. Это два разных отказа с двумя разными
        // виновниками, и лечатся они по-разному.
        //
        // Причина уходит в журнал устройства, а не на экран: человеку она
        // ничего не объясняет. Ни токена, ни кода в ней нет — только то,
        // чем SDK объяснил свой отказ.
        if (failed && reason != null) {
            Log.w(LOG_TAG, "Вход через провайдера прерван на устройстве: $reason")
        }
        val message = if (failed) {
            PROVIDER_REFUSED_ON_DEVICE
        } else {
            null
        }
        // Причина — ПОД «Подробностями» на экране, а не только в журнале
        // устройства. Журнал читается с компьютера и кабелем; человек,
        // которому не открылся вход, сидит с телефоном в руках, и между
        // «причина есть, но недостижима» и «причины нет» разницы для него
        // никакой.
        _uiState.update {
            it.copy(
                isLoading = false,
                step = LoginStep.EMAIL,
                error = message,
                errorDetails = if (failed) reason else null,
            )
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
                // Тот же разбор причин, что и на пути с кодом. Разойтись им
                // нечем: отказы приходят от одной и той же ручки, и человеку
                // безразлично, чем именно его SDK подтверждал вход.
                logExchangeFailure(provider, error)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        step = LoginStep.EMAIL,
                        error = signInErrorMessage(error),
                        errorDetails = exchangeFailureDetails(provider, error),
                    )
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
                logExchangeFailure(provider, error)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        step = LoginStep.EMAIL,
                        error = signInErrorMessage(error),
                        errorDetails = exchangeFailureDetails(provider, error),
                    )
                }
            }
        }
    }

    /**
     * Отказ обмена — в журнал устройства, с кодом и состоянием ответа.
     *
     * На экране кода нет и не будет: он ничего не объясняет человеку. Но без
     * него отказ неотличим от отказа SDK на телефоне, и разбирать поломку
     * приходится гаданием. Ни токена, ни почты, ни кода из письма здесь нет.
     */
    /**
     * Та же причина, но для экрана — под «Подробностями».
     *
     * Кода отказа в ГЛАВНОЙ строке нет и не будет: человеку он ничего не
     * объясняет, и рецепт СИМПАС это прямо запрещает. Но спрятать причину
     * совсем значит оставить и себя без неё: два дня разбора отказа ВК ушли
     * ровно на то, что причину знал только телефон и никому не показывал.
     */
    private fun exchangeFailureDetails(provider: String, error: Throwable): String {
        val simpas = error as? SimpasIdException
        if (simpas != null) {
            return "СИМПАС отказал в обмене для $provider: код=${simpas.code ?: "нет"} статус=${simpas.status ?: "нет"}"
        }
        return "Обмен для $provider не состоялся: ${error::class.simpleName ?: "ошибка"}"
    }

    private fun logExchangeFailure(provider: String, error: Throwable) {
        val simpas = error as? SimpasIdException
        Log.w(
            LOG_TAG,
            "СИМПАС отказал в обмене для $provider: " +
                "код=${simpas?.code ?: "нет"} статус=${simpas?.status ?: "нет"}",
        )
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
        const val CENTRAL_PRIVACY_CODE = "cmpas_privacy"
        const val PRACTICE_TERMS_CODE = "cmpas_practice_terms"

        /**
         * Ссылки на документы для строки внизу экрана входа.
         *
         * Те же три документа и те же коды, что в вебе
         * (src/lib/auth/simpasid-legal.ts): расхождение означало бы, что
         * человек с телефона и человек из браузера читают разное.
         *
         * Каждая ссылка падает на свой запасной вариант отдельно: у
         * центральных текстов и у Особых условий разные сроки публикации, и
         * отсутствие одного не должно уносить остальные. Особые условия,
         * которых в реестре ещё нет, не показываются вовсе — выдуманного
         * адреса тут быть не может.
         */
        fun legalLinksFrom(documents: List<LegalDocument>): LegalLinks {
            val byCode = documents.associateBy { it.documentCode }
            val fallback = LegalLinks()
            return LegalLinks(
                terms = absoluteLegalUrl(byCode[CENTRAL_TERMS_CODE]?.url) ?: fallback.terms,
                privacy = absoluteLegalUrl(byCode[CENTRAL_PRIVACY_CODE]?.url) ?: fallback.privacy,
                practiceTerms = absoluteLegalUrl(byCode[PRACTICE_TERMS_CODE]?.url),
            )
        }

        /** Адрес редакции приходит относительным — разворачиваем от издателя. */
        fun absoluteLegalUrl(url: String?): String? {
            val value = url?.trim()?.takeIf { it.isNotBlank() } ?: return null
            if (value.startsWith("http://") || value.startsWith("https://")) return value
            return BuildConfig.SIMPASID_ISSUER.trimEnd('/') + "/" + value.trimStart('/')
        }

        /**
         * Идентификаторы приложений провайдеров, ЗАШИТЫЕ В СБОРКУ.
         *
         * Копия здесь вынужденная, а не по недосмотру. Оба SDK объявляют
         * адрес возврата intent-фильтром манифеста — у Яндекса схема
         * `yx<идентификатор>`, у ВК `vk<идентификатор>`. Манифест часть
         * APK; вычислить адрес возврата после установки нельзя, и без
         * подстановки сборка не собирается вовсе.
         *
         * ЧТО С ЭТИМ СДЕЛАНО. Копию убрать нельзя — можно убрать её
         * молчание: значение сверяется с тем, что назвал сервер. Разошлись
         * — кнопки нет, и человек видит прежнюю дверь вместо «вход не
         * работает» без причины на экране.
         *
         * У ВК то же самое и по той же причине: `VKIDRedirectScheme` —
         * это `vk` плюс идентификатор приложения, то есть intent-фильтр в
         * манифесте.
         */
        val BUILT_IN_PROVIDER_APP_IDS: Map<String, String> = mapOf(
            PROVIDER_YANDEX to BuildConfig.YANDEX_NATIVE_CLIENT_ID,
            PROVIDER_VK to BuildConfig.VK_NATIVE_CLIENT_ID,
        )

        /**
         * Совпал ли идентификатор из сборки с тем, что назвал сервер.
         *
         * Пустой в сборке — нативного входа этого провайдера у нас нет.
         * Пустой у сервера — заводить SDK нечем. Разные — заводить SDK
         * НЕЛЬЗЯ: код, выданный под наш идентификатор, сервер обменяет
         * своим, и провайдер откажет.
         */
        fun matchesBuiltInAppId(provider: String, serverAppId: String?): Boolean =
            appIdMatches(BUILT_IN_PROVIDER_APP_IDS[provider], serverAppId)

        /**
         * Само правило, отдельно от того, что лежит в сборке.
         *
         * Вынесено, чтобы его можно было проверить всеми четырьмя случаями:
         * привязанный к BuildConfig тест проверял бы не правило, а значение
         * секрета в конкретном прогоне — и менял бы ответ в тот день, когда
         * секрет появится.
         */
        fun appIdMatches(builtIn: String?, serverAppId: String?): Boolean =
            !builtIn.isNullOrBlank() && !serverAppId.isNullOrBlank() && builtIn == serverAppId

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

        /**
         * Провайдер не подтвердил вход.
         *
         * Одна строка на два места — отказ его SDK на устройстве и отказ
         * обмена на сервере: для человека это одно и то же событие, и
         * разными словами об одном он решил бы, что это две разные беды.
         */
        const val PROVIDER_REFUSED = "Провайдер не подтвердил вход. Попробуйте ещё раз или войдите по почте."

        /**
         * Отказ случился НА УСТРОЙСТВЕ, в SDK провайдера.
         *
         * Отдельная фраза нужна не человеку, а разбору: с ней снимок экрана
         * говорит, где вход развалился, — в приложении провайдера на
         * телефоне или в обмене кода у СИМПАС. Обе фразы называют одно и то
         * же действие, потому что действие у человека и правда одно.
         */
        const val PROVIDER_REFUSED_ON_DEVICE =
            "Вход через провайдера не завершился на этом устройстве. Попробуйте ещё раз или войдите по почте."

        private const val LOG_TAG = "LoginViewModel"

        /**
         * Отказ единого входа — человеческими словами.
         *
         * Раньше на все случаи была одна фраза «вход временно недоступен, мы
         * уже чиним». Для половины отказов это НЕПРАВДА: чинить нечего, и
         * ждать бесполезно. Человек, у которого провайдер не отдал
         * подтверждённой почты, будет жать кнопку до вечера — а ему надо
         * войти по почте, и мы это знаем в момент отказа.
         *
         * Коды взяты из перечня стороны СИМПАС (issue #172, 11.09.2026) и
         * сверены с их сервером, а не придуманы по смыслу.
         *
         * Ни кода ошибки, ни адреса сервера в тексте нет — это требование их
         * же рецепта, и оно верное: человеку они ничего не объясняют.
         */
        fun signInErrorMessage(error: Throwable): String =
            when ((error as? SimpasIdException)?.code) {
                // Провайдер не дал подтверждённой почты. Ждать нечего —
                // называем действие, которое сработает.
                "email_required" ->
                    "Этот способ входа не дал подтверждённой почты. Войдите по почте."

                // Личность провайдера уже за другой учётной записью. Вторую
                // практику рядом человеку заводить нельзя, и он этого не
                // хочет — ему надо в свою.
                "identity_taken" ->
                    "Этот аккаунт уже связан с другой учётной записью ПРАКТИКИ. Войдите тем способом, которым входили раньше."

                "too_many_attempts" ->
                    "Слишком много попыток. Попробуйте через несколько минут."

                // Провайдер отказал или подпись не сошлась. Виноваты не мы и
                // не он — но человеку нужен выход, а не разбирательство.
                "invalid_provider_code" -> PROVIDER_REFUSED

                "provider_unavailable" ->
                    "Этот способ входа сейчас недоступен. Войдите по почте."

                // forbidden_client, invalid_request и всё неизвестное — это
                // НАША ошибка настройки или сети. Человеку правда нечего
                // делать, и общая фраза здесь честна.
                else -> SIGN_IN_UNAVAILABLE
            }
    }
}
