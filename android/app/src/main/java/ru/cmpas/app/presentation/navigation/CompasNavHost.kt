package ru.cmpas.app.presentation.navigation

import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import ru.cmpas.app.presentation.auth.LoginScreen
import ru.cmpas.app.presentation.dashboard.DashboardScreen
import ru.cmpas.app.presentation.calendar.CalendarScreen
import ru.cmpas.app.presentation.clients.ClientsScreen
import ru.cmpas.app.presentation.clients.ClientDetailScreen
import ru.cmpas.app.presentation.notes.NotesScreen
import ru.cmpas.app.presentation.session.SessionDetailScreen
import ru.cmpas.app.presentation.settings.SettingsScreen
import ru.cmpas.app.presentation.components.FloatingNavigationDock
import ru.cmpas.app.presentation.components.ExpandableActionMenu
import ru.cmpas.app.presentation.components.DefaultActions

@Composable
fun CompasNavHost(
    navController: NavHostController = rememberNavController(),
    isLoggedIn: Boolean,
) {
    val startDestination = if (isLoggedIn) Screen.Dashboard.route else Screen.Login.route
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val mainRoutes = BottomNavItem.entries.map { it.screen.route }
    val showDock = isLoggedIn && currentRoute in mainRoutes

    Box(modifier = Modifier.fillMaxSize()) {
        NavHost(
            navController = navController,
            startDestination = startDestination,
            modifier = Modifier.fillMaxSize(),
            enterTransition = { fadeIn() + slideInHorizontally { it / 4 } },
            exitTransition = { fadeOut() + slideOutHorizontally { -it / 4 } },
            popEnterTransition = { fadeIn() + slideInHorizontally { -it / 4 } },
            popExitTransition = { fadeOut() + slideOutHorizontally { it / 4 } },
        ) {
            composable(Screen.Login.route) {
                LoginScreen(onLoginSuccess = {
                    navController.navigate(Screen.Dashboard.route) { popUpTo(Screen.Login.route) { inclusive = true } }
                })
            }
            composable(Screen.Dashboard.route) {
                DashboardScreen(
                    onSessionClick = { navController.navigate(Screen.SessionDetail.createRoute(it)) },
                    onCalendarClick = { navController.navigate(Screen.Calendar.route) { popUpTo(Screen.Dashboard.route) { saveState = true }; launchSingleTop = true; restoreState = true } },
                    onClientClick = { navController.navigate(Screen.ClientDetail.createRoute(it)) },
                )
            }
            composable(Screen.Calendar.route) {
                CalendarScreen(
                    onSessionClick = { navController.navigate(Screen.SessionDetail.createRoute(it)) },
                    onClientClick = { navController.navigate(Screen.ClientDetail.createRoute(it)) },
                )
            }
            composable(Screen.Clients.route) {
                ClientsScreen(onClientClick = { navController.navigate(Screen.ClientDetail.createRoute(it)) })
            }
            composable(Screen.Notes.route) {
                NotesScreen(onSessionNoteClick = { navController.navigate(Screen.PostSessionNote.createRoute(it)) })
            }
            composable(Screen.Settings.route) {
                SettingsScreen(onLogout = { navController.navigate(Screen.Login.route) { popUpTo(0) { inclusive = true } } })
            }
            composable(Screen.SessionDetail.route, arguments = listOf(navArgument("id") { type = NavType.StringType })) {
                SessionDetailScreen(sessionId = it.arguments?.getString("id") ?: "", onBack = { navController.popBackStack() },
                    onClientClick = { id -> navController.navigate(Screen.ClientDetail.createRoute(id)) })
            }
            composable(Screen.ClientDetail.route, arguments = listOf(navArgument("id") { type = NavType.StringType })) {
                ClientDetailScreen(clientId = it.arguments?.getString("id") ?: "", onBack = { navController.popBackStack() },
                    onSessionClick = { id -> navController.navigate(Screen.SessionDetail.createRoute(id)) })
            }
        }

        if (showDock) {
            // Dock at bottom
            FloatingNavigationDock(
                currentRoute = currentRoute,
                onItemClick = { item ->
                    if (currentRoute != item.screen.route) {
                        navController.navigate(item.screen.route) { popUpTo(Screen.Dashboard.route) { saveState = true }; launchSingleTop = true; restoreState = true }
                    }
                },
                modifier = Modifier.align(Alignment.BottomCenter),
            )
            // FAB — contextual actions per screen
            val actionItems = remember(currentRoute) {
                when (currentRoute) {
                    Screen.Calendar.route -> DefaultActions.calendarActions()
                    Screen.Clients.route -> DefaultActions.clientsActions()
                    Screen.Notes.route -> DefaultActions.notesActions()
                    else -> DefaultActions.todayActions()
                }
            }
            ExpandableActionMenu(items = actionItems, modifier = Modifier.fillMaxSize())
        }
    }
}
