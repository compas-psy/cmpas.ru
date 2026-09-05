package ru.cmpas.app.presentation.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String) {
    data object Login : Screen("login")
    data object Dashboard : Screen("dashboard")
    data object Calendar : Screen("calendar")
    data object Clients : Screen("clients")
    data object Notes : Screen("notes")
    data object Settings : Screen("settings")
    data object Schedule : Screen("schedule")
    data object Addresses : Screen("addresses")
    // Необязательные параметры маршрута (Задача 23): экран остаётся один, но
    // умеет открыться сразу на нужном действии. Второго редактора записи,
    // второй карточки клиента и второго экрана сессии не появляется.
    data object QuickAction : Screen("quick-action/{type}?clientId={clientId}") {
        fun createRoute(type: String) = "quick-action/$type"
        /** Запись создаётся для конкретного клиента: он подставлен заранее. */
        fun createRoute(type: String, clientId: String) = "quick-action/$type?clientId=$clientId"
    }
    data object ClientDetail : Screen("clients/{id}?focus={focus}") {
        fun createRoute(id: String) = "clients/$id"
        fun createRoute(id: String, focus: ScreenFocus) = "clients/$id?focus=${focus.key}"
    }
    data object SessionDetail : Screen("session/{id}?focus={focus}") {
        fun createRoute(id: String) = "session/$id"
        fun createRoute(id: String, focus: ScreenFocus) = "session/$id?focus=${focus.key}"
    }
    data object PostSessionNote : Screen("notes/post-session/{sessionId}") {
        fun createRoute(sessionId: String) = "notes/post-session/$sessionId"
    }
    // Client-facing
    data object Booking : Screen("booking/{psychologistId}") {
        fun createRoute(id: String) = "booking/$id"
    }
    data object MyBookings : Screen("my-bookings")
}

/**
 * На чём открыть экран. Пустое значение — обычный заход, экран показывает
 * себя целиком; иначе он сразу раскрывает названное действие.
 *
 * Перечисление, а не свободная строка: опечатка в «consent» иначе тихо
 * открывала бы карточку без действия — ровно то, от чего Задача 23 уходит.
 */
enum class ScreenFocus(val key: String) {
    /** Карточка клиента: сразу отправка документа-согласия. */
    CONSENT("consent"),
    /** Карточка сессии: сразу отметка оплаты. */
    PAYMENT("payment");

    companion object {
        fun from(key: String?): ScreenFocus? = entries.firstOrNull { it.key == key }
    }
}

// Dock = 4 tabs + central FAB (SPEC). Notes is reached from client/session cards.
enum class BottomNavItem(
    val screen: Screen,
    val label: String,
    val icon: ImageVector,
) {
    TODAY(Screen.Dashboard, "Сегодня", Icons.Outlined.Home),
    CALENDAR(Screen.Calendar, "Календарь", Icons.Outlined.CalendarMonth),
    CLIENTS(Screen.Clients, "Клиенты", Icons.Outlined.Groups),
    PROFILE(Screen.Settings, "Профиль", Icons.Outlined.Person),
}
