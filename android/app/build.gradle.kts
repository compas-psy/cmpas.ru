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

// Geist is SIL OFL-licensed and sourced from Vercel's official repository.
// Pinning the release keeps APK typography reproducible while avoiding binary
// font files in git. The resources are generated before Android merges res/.
val geistVersion = "v1.7.2"
val geistFontDir = layout.projectDirectory.dir("src/main/res/font")
val geistFonts = mapOf(
    "geist_regular.ttf" to "Geist-Regular.ttf",
    "geist_medium.ttf" to "Geist-Medium.ttf",
    "geist_semibold.ttf" to "Geist-SemiBold.ttf",
    "geist_bold.ttf" to "Geist-Bold.ttf",
    "geist_extrabold.ttf" to "Geist-ExtraBold.ttf",
)

val prepareGeistFonts by tasks.registering {
    group = "build setup"
    description = "Download pinned Geist font resources from the official Vercel repository"

    val generatedFonts = geistFonts.keys.map { geistFontDir.file(it).asFile }
    outputs.files(generatedFonts)

    doLast {
        val fontDir = geistFontDir.asFile.apply { mkdirs() }
        geistFonts.forEach { (localName, upstreamName) ->
            val target = fontDir.resolve(localName)
            if (!target.exists() || target.length() < 50_000L) {
                val temp = fontDir.resolve("$localName.tmp")
                val source = "https://raw.githubusercontent.com/vercel/geist-font/$geistVersion/fonts/Geist/ttf/$upstreamName"

                java.net.URI(source).toURL().openStream().buffered().use { input ->
                    temp.outputStream().buffered().use { output -> input.copyTo(output) }
                }
                require(temp.length() > 50_000L) {
                    "Downloaded Geist font is invalid: $upstreamName"
                }
                java.nio.file.Files.move(
                    temp.toPath(),
                    target.toPath(),
                    java.nio.file.StandardCopyOption.REPLACE_EXISTING,
                )
            }
        }
    }
}

tasks.configureEach {
    if (name == "preBuild") dependsOn(prepareGeistFonts)
}

// main split the monolithic Models.kt into focused model files (Core/Client/Note/
// Workflow). The legacy Models.kt is kept on disk but excluded from compilation to
// avoid redeclaration. We DO compile SessionReminderFactory.kt: our redesigned
// SessionDetailViewModel relies on its buildReminders() and no longer defines it.
tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
    exclude("**/Models.kt")
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
