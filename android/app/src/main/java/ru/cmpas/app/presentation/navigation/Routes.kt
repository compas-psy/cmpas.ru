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
    data object ClientDetail : Screen("clients/{id}") {
        fun createRoute(id: String) = "clients/$id"
    }
    data object SessionDetail : Screen("session/{id}") {
        fun createRoute(id: String) = "session/$id"
    }
    // Client-facing
    data object Booking : Screen("booking/{psychologistId}") {
        fun createRoute(id: String) = "booking/$id"
    }
    data object MyBookings : Screen("my-bookings")
}

enum class BottomNavItem(
    val screen: Screen,
    val label: String,
    val icon: ImageVector,
) {
    TODAY(Screen.Dashboard, "Главная", Icons.Outlined.Home),
    CALENDAR(Screen.Calendar, "Календарь", Icons.Outlined.CalendarMonth),
    CLIENTS(Screen.Clients, "Клиенты", Icons.Outlined.People),
    NOTES(Screen.Notes, "Заметки", Icons.Outlined.EditNote),
    SETTINGS(Screen.Settings, "Ещё", Icons.Outlined.MoreHoriz),
}
