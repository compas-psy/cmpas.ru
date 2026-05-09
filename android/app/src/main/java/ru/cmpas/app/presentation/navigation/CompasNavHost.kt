package ru.cmpas.app.presentation.navigation

import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
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
import ru.cmpas.app.presentation.actions.QuickActionScreen
import ru.cmpas.app.presentation.auth.LoginScreen
import ru.cmpas.app.presentation.dashboard.DashboardScreen
import ru.cmpas.app.presentation.calendar.CalendarScreen
import ru.cmpas.app.presentation.clients.ClientsScreen
import ru.cmpas.app.presentation.clients.ClientDetailScreen
import ru.cmpas.app.presentation.notes.NotesScreen
import ru.cmpas.app.presentation.notes.PostSessionNoteScreen
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
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding(),
            enterTransition = { fadeIn() + slideInHorizontally { it / 4 } },
            exitTransition = { fadeOut() + slideOutHorizontally { -it / 4 } },
            popEnterTransition = { fadeIn() + slideInHorizontally { -it / 4 } },
            popExitTransition = { fadeOut() + slideOutHorizontally { it / 4 } },
        ) {
            composable(Screen.Login.route) {
                LoginScreen(onLoginSuccess = {
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                })
            }
            composable(Screen.Dashboard.route) {
                DashboardScreen(
                    onSessionClick = { navController.navigate(Screen.SessionDetail.createRoute(it)) },
                    onCalendarClick = { navController.navigateTopLevel(Screen.Calendar) },
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
                SettingsScreen(onLogout = {
                    navController.navigate(Screen.Login.route) { popUpTo(0) { inclusive = true } }
                })
            }
            composable(
                Screen.QuickAction.route,
                arguments = listOf(navArgument("type") { type = NavType.StringType }),
            ) {
                QuickActionScreen(
                    type = it.arguments?.getString("type") ?: "default",
                    onBack = { navController.popBackStack() },
                    onDone = { navController.popBackStack() },
                )
            }
            composable(
                Screen.PostSessionNote.route,
                arguments = listOf(navArgument("sessionId") { type = NavType.StringType }),
            ) {
                PostSessionNoteScreen(
                    sessionId = it.arguments?.getString("sessionId") ?: "",
                    onBack = { navController.popBackStack() },
                    onSaved = { navController.popBackStack() },
                )
            }
            composable(Screen.SessionDetail.route, arguments = listOf(navArgument("id") { type = NavType.StringType })) {
                SessionDetailScreen(
                    sessionId = it.arguments?.getString("id") ?: "",
                    onBack = { navController.popBackStack() },
                    onClientClick = { id -> navController.navigate(Screen.ClientDetail.createRoute(id)) },
                    onNoteClick = { id -> navController.navigate(Screen.PostSessionNote.createRoute(id)) },
                    onQuickAction = { type -> navController.navigate(Screen.QuickAction.createRoute(type)) },
                )
            }
            composable(Screen.ClientDetail.route, arguments = listOf(navArgument("id") { type = NavType.StringType })) { entry ->
                val clientId = entry.arguments?.getString("id") ?: ""
                ClientDetailScreen(
                    clientId = clientId,
                    onBack = { navController.popBackStack() },
                    onSessionClick = { id -> navController.navigate(Screen.SessionDetail.createRoute(id)) },
                    onScheduleClick = { navController.navigate(Screen.QuickAction.createRoute("new-session")) },
                    onNoteClick = { navController.navigate(Screen.PostSessionNote.createRoute("client-$clientId")) },
                    onQuickAction = { type -> navController.navigate(Screen.QuickAction.createRoute(type)) },
                )
            }
        }

        if (showDock) {
            FloatingNavigationDock(
                currentRoute = currentRoute,
                onItemClick = { item ->
                    if (currentRoute != item.screen.route) navController.navigateTopLevel(item.screen)
                },
                modifier = Modifier.align(Alignment.BottomCenter),
            )

            val actionItems = remember(currentRoute) {
                when (currentRoute) {
                    Screen.Calendar.route -> DefaultActions.calendarActions(
                        onNewSession = { navController.navigate(Screen.QuickAction.createRoute("new-session")) },
                        onBlockTime = { navController.navigate(Screen.QuickAction.createRoute("block-time")) },
                        onRepeatSlot = { navController.navigate(Screen.QuickAction.createRoute("repeat-slot")) },
                        onScheduleSettings = { navController.navigateTopLevel(Screen.Settings) },
                    )
                    Screen.Clients.route -> DefaultActions.clientsActions(
                        onNewClient = { navController.navigate(Screen.QuickAction.createRoute("new-client")) },
                        onScheduleSession = { navController.navigate(Screen.QuickAction.createRoute("new-session")) },
                        onSendBookingLink = { navController.navigate(Screen.QuickAction.createRoute("booking-link")) },
                        onBlockTime = { navController.navigate(Screen.QuickAction.createRoute("block-time")) },
                    )
                    Screen.Notes.route -> DefaultActions.notesActions(
                        onVoiceNote = { navController.navigate(Screen.PostSessionNote.createRoute("voice")) },
                        onLastSessionNote = { navController.navigate(Screen.PostSessionNote.createRoute("last")) },
                        onTextNote = { navController.navigate(Screen.PostSessionNote.createRoute("text")) },
                        onTemplateNote = { navController.navigate(Screen.PostSessionNote.createRoute("template")) },
                    )
                    else -> DefaultActions.todayActions(
                        onNewSession = { navController.navigate(Screen.QuickAction.createRoute("new-session")) },
                        onPostNote = { navController.navigate(Screen.PostSessionNote.createRoute("quick")) },
                        onBlockSlot = { navController.navigate(Screen.QuickAction.createRoute("block-time")) },
                        onMarkPayment = { navController.navigate(Screen.QuickAction.createRoute("payment")) },
                    )
                }
            }
            ExpandableActionMenu(items = actionItems, modifier = Modifier.fillMaxSize())
        }
    }
}

private fun NavHostController.navigateTopLevel(screen: Screen) {
    navigate(screen.route) {
        popUpTo(Screen.Dashboard.route) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}
