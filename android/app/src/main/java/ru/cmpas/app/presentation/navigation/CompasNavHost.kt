package ru.cmpas.app.presentation.navigation

import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
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
import ru.cmpas.app.presentation.components.ActionMenuItem
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
        // Main content — no bottom padding from Scaffold, dock floats on top
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
                LoginScreen(
                    onLoginSuccess = {
                        navController.navigate(Screen.Dashboard.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    }
                )
            }

            composable(Screen.Dashboard.route) {
                DashboardScreen(
                    onSessionClick = { id ->
                        navController.navigate(Screen.SessionDetail.createRoute(id))
                    },
                    onCalendarClick = {
                        navController.navigate(Screen.Calendar.route) {
                            popUpTo(Screen.Dashboard.route) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    onClientClick = { id ->
                        navController.navigate(Screen.ClientDetail.createRoute(id))
                    },
                )
            }

            composable(Screen.Calendar.route) {
                CalendarScreen(
                    onSessionClick = { id ->
                        navController.navigate(Screen.SessionDetail.createRoute(id))
                    },
                    onClientClick = { id ->
                        navController.navigate(Screen.ClientDetail.createRoute(id))
                    },
                )
            }

            composable(Screen.Clients.route) {
                ClientsScreen(
                    onClientClick = { id ->
                        navController.navigate(Screen.ClientDetail.createRoute(id))
                    }
                )
            }

            composable(Screen.Notes.route) {
                NotesScreen(
                    onSessionNoteClick = { sessionId ->
                        navController.navigate(Screen.PostSessionNote.createRoute(sessionId))
                    },
                )
            }

            composable(Screen.Settings.route) {
                SettingsScreen(
                    onLogout = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }

            // Detail screens
            composable(
                route = Screen.SessionDetail.route,
                arguments = listOf(navArgument("id") { type = NavType.StringType }),
            ) { backStackEntry ->
                val sessionId = backStackEntry.arguments?.getString("id") ?: ""
                SessionDetailScreen(
                    sessionId = sessionId,
                    onBack = { navController.popBackStack() },
                    onClientClick = { id ->
                        navController.navigate(Screen.ClientDetail.createRoute(id))
                    },
                )
            }

            composable(
                route = Screen.ClientDetail.route,
                arguments = listOf(navArgument("id") { type = NavType.StringType }),
            ) { backStackEntry ->
                val clientId = backStackEntry.arguments?.getString("id") ?: ""
                ClientDetailScreen(
                    clientId = clientId,
                    onBack = { navController.popBackStack() },
                    onSessionClick = { id ->
                        navController.navigate(Screen.SessionDetail.createRoute(id))
                    },
                )
            }
        }

        // Floating Navigation Dock — above bottom edge
        if (showDock) {
            FloatingNavigationDock(
                currentRoute = currentRoute,
                onItemClick = { item ->
                    if (currentRoute != item.screen.route) {
                        navController.navigate(item.screen.route) {
                            popUpTo(Screen.Dashboard.route) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                },
                modifier = Modifier.align(Alignment.BottomCenter),
            )

            // Expandable Action Menu
            val actionItems = remember(currentRoute) {
                when (currentRoute) {
                    Screen.Clients.route -> DefaultActions.clientsActions()
                    Screen.Notes.route -> DefaultActions.notesActions()
                    else -> DefaultActions.todayActions()
                }
            }
            ExpandableActionMenu(
                items = actionItems,
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}
