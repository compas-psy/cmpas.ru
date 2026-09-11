pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // SDK ВК на Maven Central не публикуется — только здесь. Фильтр по
        // группе обязателен: без него Gradle ходил бы в чужой репозиторий за
        // КАЖДОЙ зависимостью проекта, то есть и за теми, чьи имена он мог бы
        // там встретить раньше, чем в Maven Central.
        maven {
            url = uri("https://artifactory-external.vkpartner.ru/artifactory/vkid-sdk-android/")
            // Не одна группа, а всё семейство: сам SDK тянет свои же модули
            // (com.vk.id.*), капчу (com.vk.id.captcha) и справочник
            // идентификаторов (com.vk:android-sdk-id). Узкий фильтр по одной
            // группе ронял бы сборку на первой же транзитивной зависимости.
            content { includeGroupByRegex("com\\.vk(\\..*)?") }
        }
    }
}

rootProject.name = "compas"
include(":app")
