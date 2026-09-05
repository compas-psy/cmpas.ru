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

android {
    namespace = "ru.cmpas.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "ru.cmpas.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 7
        versionName = "1.0.6"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
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
    implementation(libs.zxing.core)

    implementation(libs.coroutines.core)
    implementation(libs.coroutines.android)

    testImplementation("junit:junit:4.13.2")
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.core)
    // Позволяет тестировать viewModelScope.launch { ... } на JVM: без него
    // Dispatchers.Main не инициализирован в unit-тесте и падает с
    // IllegalStateException при первом launch на ViewModel.
    testImplementation(libs.coroutines.test)
}
