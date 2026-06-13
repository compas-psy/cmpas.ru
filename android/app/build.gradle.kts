plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
    // alias(libs.plugins.google.services) // Enable when google-services.json is added
}

android {
    namespace = "ru.cmpas.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "ru.cmpas.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 6
        versionName = "1.0.5"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        buildConfigField("String", "API_BASE_URL", "\"https://cmpas.ru/api/mobile/\"")
    }

    signingConfigs {
        // Stable signing key committed to the repo so every APK (debug or
        // release) is signed identically -> installs update in place instead
        // of forcing an uninstall. Safe to commit: it only signs our own
        // sideloaded distribution builds, not Play Store releases.
        create("compas") {
            storeFile = rootProject.file("keystore/compas-release.jks")
            storePassword = "compas2026"
            keyAlias = "compas"
            keyPassword = "compas2026"
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("compas")
            buildConfigField("String", "API_BASE_URL", "\"https://cmpas.ru/api/mobile/\"")
        }
        release {
            signingConfig = signingConfigs.getByName("compas")
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

    implementation(libs.coroutines.core)
    implementation(libs.coroutines.android)
}
