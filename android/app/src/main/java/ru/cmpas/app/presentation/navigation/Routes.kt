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
    data object QuickAction : Screen("quick-action/{type}") {
        fun createRoute(type: String) = "quick-action/$type"
    }
    data object ClientDetail : Screen("clients/{id}") {
        fun createRoute(id: String) = "clients/$id"
    }
    data object SessionDetail : Screen("session/{id}") {
        fun createRoute(id: String) = "session/$id"
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
