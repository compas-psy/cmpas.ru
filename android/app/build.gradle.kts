plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
    // alias(libs.plugins.google.services) // Enable when google-services.json is added
}

// Задача 28: приёмочный прогон обязан идти против одноразового стенда, а не
// против боевого сервера с данными живых клиентов. Адрес берётся из свойства
// сборки, и ТОЛЬКО если его передали снаружи; по умолчанию — тот же боевой
// адрес, что и был. Ни выкладка, ни релизная сборка своего поведения не
// меняют: `-PapiBaseUrl=...` передаёт только приёмочный workflow.
val apiBaseUrl: String = (project.findProperty("apiBaseUrl") as String?)
    ?.takeIf { it.isNotBlank() }
    ?: "https://cmpas.ru/api/mobile/"

// ЕДИНЫЙ ВХОД СИМПАС.
//
// Адрес и идентификатор клиента — не секрет: приложение на устройстве
// человека секрет не сохранит, и безопасность здесь держится на признаке
// first_party у самого клиента, а не на тайне его имени
// (compas-psy/auth, docs/integration/practice-android.md, «Что нужно от нас»).
// Поэтому оба значения лежат в сборке открыто, как и адрес нашего API.
//
// Пустой идентификатор означает «вход СИМПАС не настроен»: кнопки на экране
// не будет вовсе. Это не отказ, а честное состояние, и приложение в нём
// работает прежними способами входа.
val simpasIdIssuer: String = (project.findProperty("simpasIdIssuer") as String?)
    ?.takeIf { it.isNotBlank() }
    ?: "https://auth.cmpas.ru"
val simpasIdClientId: String = (project.findProperty("simpasIdClientId") as String?)
    ?.takeIf { it.isNotBlank() }
    ?: "practice-mobile"

// ИДЕНТИФИКАТОР ПРИЛОЖЕНИЯ ЯНДЕКСА — ВЫНУЖДЕННО В СБОРКЕ.
//
// Договорённость с СИМПАС была «идентификатор берётся из /v1/auth/methods и
// в сборку не попадает». Для ЗАПРОСА это выполнимо: SDK принимает его
// конструктором в рантайме. Для ВОЗВРАТА — нет: манифест самого SDK
// объявляет intent-фильтр со схемой `yx${YANDEX_CLIENT_ID}` и хостом
// `yx${YANDEX_CLIENT_ID}.oauth.yandex.ru`. Это часть APK; вычислить адрес
// возврата после установки нельзя. Без подстановки сборка даже не
// собирается — манифест-мерджер отказывает.
//
// Поэтому копия в сборке есть, но она СВЕРЯЕТСЯ с тем, что назвал сервер
// (LoginViewModel.nativeProviderAppId): разойдись значения — кнопка
// нативного входа не показывается, и человек видит прежнюю дверь вместо
// «вход не работает» без причины.
//
// Пусто — нативного Яндекса в сборке нет, и это честное состояние: прежний
// браузерный вход остаётся на экране.
val yandexNativeClientId: String = (project.findProperty("yandexNativeClientId") as String?)
    ?.takeIf { it.isNotBlank() }
    ?: System.getenv("YANDEX_NATIVE_CLIENT_ID").orEmpty()

android {
    namespace = "ru.cmpas.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "ru.cmpas.app"
        minSdk = 26
        targetSdk = 35
        // 1.1.2 — правда о времени сессии и отбор слотов по формату (#140).
        // 1.1.4 — аватарка клиента из его мессенджера (#155).
        // 1.1.5 — расписание правится с телефона, блокировка на часы (#156).
        // 1.1.6 — аватарка просилась по несуществующему адресу (#157).
        // 1.1.7 — развилка после «Была»/«Не пришли», «Тот же час» в карточке
        //         клиента, подписи кнопок больше не режутся, «уведомление о
        //         записи» после записи не отмечено заранее (#163, #167).
        //
        // ПОЧЕМУ ЭТО ВЕРСИЯ, А НЕ ПЕРЕСБОРКА 1.1.6. Правки #163 и #167 уже
        // уехали в main и дважды пересобрали релиз praktika-v1.1.6 — то есть
        // под одним номером у людей успели побывать два разных приложения.
        // Так вышло потому, что версию не подняли вместе с правкой; исправляем
        // здесь. Правило CLAUDE.md различает исправление доставки (сборка,
        // подпись, разрешения, имена) и новую версию продукта — это второе:
        // изменилось поведение экранов.
        //
        // versionCode растёт с каждой версией продукта: телефон с
        // установленной предыдущей не примет пакет с тем же кодом как
        // обновление, и постоянная ссылка отдавала бы файл, который
        // некуда поставить.
        //
        // Правило CLAUDE.md «versionCode не растёт от правок сборки,
        // подписи, разрешений или имён» здесь не применимо: изменилось
        // поведение продукта, а не способ его доставки.
        // 1.3.0 — вход СИМПАС и экран первого подключения (#172). Версия
        // растёт по правилу CLAUDE.md: меняется поведение продукта, а не
        // способ его доставки. Оставить 1.2.2 значило бы выложить под тем же
        // номером ДРУГОЕ приложение — телефон принял бы его как ту же
        // версию, а человек получил бы другой экран входа без предупреждения.
        // 1.3.2 — нативный вход Яндекса вместо ухода в браузер (#172).
        // Версия продукта, а не пересборка: человек видит другой экран
        // провайдера и не покидает приложение.
        versionCode = 21
        versionName = "1.3.2"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Подстановка обязательна даже когда идентификатора нет: без неё
        // манифест-мерджер роняет сборку целиком. "unset" не совпадёт ни с
        // одним значением от сервера, поэтому кнопка нативного входа при
        // пустом секрете не появится.
        manifestPlaceholders["YANDEX_CLIENT_ID"] = yandexNativeClientId.ifBlank { "unset" }

        buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
        buildConfigField("String", "YANDEX_NATIVE_CLIENT_ID", "\"$yandexNativeClientId\"")
        buildConfigField("String", "SIMPASID_ISSUER", "\"$simpasIdIssuer\"")
        buildConfigField("String", "SIMPASID_CLIENT_ID", "\"$simpasIdClientId\"")
    }

    // Ключ подписи приходит ИЗВНЕ, а не из репозитория.
    //
    // Раньше он лежал в android/keystore/compas-release.jks вместе с паролями
    // прямо здесь, в открытом виде. Любой, кто получал доступ к репозиторию,
    // мог подписать им своё приложение — и оно встало бы поверх настоящего на
    // телефонах людей как обновление, потому что для Android «то же самое
    // приложение» означает «тот же applicationId и та же подпись». Для
    // приложения, работающего с данными клиентов психолога, это неприемлемо.
    //
    // Ключ ОСТАЁТСЯ ТЕМ ЖЕ: смена ключа означала бы, что обновление поверх
    // установленных копий перестанет работать и людям пришлось бы удалять
    // приложение. Он просто переехал из рабочего дерева в секреты CI.
    //
    // Локальная сборка без этих переменных подпишется отладочным ключом
    // Android — так и задумано: разработчику на своей машине постоянный ключ
    // не нужен, а раздавать такой пакет запрещает сторож готового пакета
    // (scripts/check-apk.sh отказывает при CN=Android Debug).
    val keystorePath: String? = System.getenv("ANDROID_KEYSTORE_PATH")
    val hasSigningKey = !keystorePath.isNullOrBlank() && file(keystorePath).exists()

    signingConfigs {
        if (hasSigningKey) {
            create("release") {
                storeFile = file(keystorePath!!)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
            buildConfigField("String", "SIMPASID_ISSUER", "\"$simpasIdIssuer\"")
            buildConfigField("String", "SIMPASID_CLIENT_ID", "\"$simpasIdClientId\"")
        }
        release {
            if (hasSigningKey) {
                signingConfig = signingConfigs.getByName("release")
            }
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    // Robolectric поднимает настоящий Android-рантайм на JVM, поэтому
    // LocalPracticeStore проверяется с настоящим SharedPreferences, а не с
    // подменённым хранилищем: тест, написанный против собственной заглушки,
    // проверяет заглушку.
    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            isReturnDefaultValues = true
        }
    }
}

// Легаси Models.kt удалён 23.08.2026.
//
// Монолит был разбит на CoreModels/ClientModels/NoteModels/WorkflowModels, а сам
// файл оставили на диске и просто исключили из компиляции, чтобы не спорить с
// повторными объявлениями. Отладочной сборке это не мешало, а релизная запускает
// lintVitalRelease — и он падал именно на нём:
//
//   Unexpected failure during lint analysis of Models.kt
//   class ...KaFirMemberFunctionSymbolPointer pointer already disposed
//
// Lint разбирает исходники независимо от того, что исключено из компиляции.
// Исключение прятало дубли от компилятора, но не от него.
//
// Файл был мёртв полностью: 344 строки повторных объявлений (Session, Client,
// SessionReminder — все уже есть в живых файлах) и ни одной ссылки во всём
// модуле. Удалён вместе с исключением: глушить lint значило бы оставить причину
// на месте.
//
// Geist .ttf binaries are committed under src/main/res/font/ (no build-time fetch).

// Имена и причины упавших тестов печатаются в консоль, а не только в отчёт.
// Отчёт выгружается артефактом, но артефакты лежат в blob-хранилище GitHub,
// к которому из части сред нет доступа (CONNECT tunnel failed, 403) — и тогда
// «тесты упали» приходит без единого слова о том, какие и почему.
tasks.withType<Test>().configureEach {
    testLogging {
        events("passed", "skipped", "failed")
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
        showExceptions = true
        showCauses = true
        showStackTraces = true
    }
}

dependencies {
    val composeBom = platform(libs.compose.bom)
    implementation(composeBom)
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons)
    implementation(libs.compose.animation)
    implementation(libs.compose.foundation)
    debugImplementation(libs.compose.ui.tooling)

    implementation(libs.core.ktx)
    implementation(libs.activity.compose)
    implementation(libs.lifecycle.runtime)
    implementation(libs.lifecycle.viewmodel)
    implementation(libs.navigation.compose)
    implementation(libs.core.splashscreen)

    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)

    implementation(libs.retrofit)
    implementation(libs.retrofit.serialization)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.serialization.json)

    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)

    implementation(libs.datastore)
    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)
    implementation(libs.zxing.core)

    implementation(libs.coroutines.core)
    implementation(libs.coroutines.android)

    // НАТИВНЫЙ ВХОД ЯНДЕКС ID.
    //
    // Заменяет уход в системный браузер: тот возвращал код на веб-адрес
    // ПРАКТИКИ, а не приложению, и уносил человека из приложения.
    // Идентификатор приложения в сборку НЕ ПОПАДАЕТ — SDK принимает его в
    // рантайме, значение приходит от СИМПАС в /v1/auth/methods.
    implementation(libs.yandex.authsdk)

    testImplementation("junit:junit:4.13.2")
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.core)
    // Позволяет тестировать viewModelScope.launch { ... } на JVM: без него
    // Dispatchers.Main не инициализирован в unit-тесте и падает с
    // IllegalStateException при первом launch на ViewModel.
    testImplementation(libs.coroutines.test)
}
