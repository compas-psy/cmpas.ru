# КОМПАС Android

Нативное Android-приложение для сервиса КОМПАС.

## Сборка

APK автоматически собирается через GitHub Actions при каждом push.
Скачать последнюю версию: [Releases](../../releases)

## Запуск в Android Studio

1. Открыть папку `android/` в Android Studio
2. Дождаться синхронизации Gradle
3. Run → Run 'app'

## Стек

- Kotlin 2.1 + Jetpack Compose
- Material 3 (Material You + Dynamic Color)
- Clean Architecture (MVVM)
- Hilt (DI), Retrofit + OkHttp, Room, DataStore
- Min SDK: 26 (Android 8.0)
