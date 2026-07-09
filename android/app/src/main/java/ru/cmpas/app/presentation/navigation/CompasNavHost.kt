package ru.cmpas.app.presentation.navigation

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import ru.cmpas.app.presentation.actions.NewActionSheet
import ru.cmpas.app.presentation.actions.QuickActionScreen
import ru.cmpas.app.presentation.auth.LoginScreen
import ru.cmpas.app.presentation.calendar.CalendarScreen
import ru.cmpas.app.presentation.clients.ClientDetailScreen
import ru.cmpas.app.presentation.clients.ClientsScreen
import ru.cmpas.app.presentation.clients.ClientsViewModel
import ru.cmpas.app.presentation.components.DockTab
import ru.cmpas.app.presentation.components.GlassDock
import ru.cmpas.app.presentation.dashboard.DashboardScreen
import ru.cmpas.app.presentation.legal.LegalGateOverlay
import ru.cmpas.app.presentation.notes.NotesScreen
import ru.cmpas.app.presentation.notes.PostSessionNoteScreen
import ru.cmpas.app.presentation.schedule.ScheduleScreen
import ru.cmpas.app.presentation.session.SessionDetailScreen
import ru.cmpas.app.presentation.settings.SettingsScreen
import ru.cmpas.app.presentation.theme.Ambient
import ru.cmpas.app.presentation.theme.CompasBg

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
    var showActionSheet by remember { mutableStateOf(false) }

    // This root surface extends beneath the transparent status bar. Content
    // remains inset by statusBarsPadding(), while the visual background no
    // longer breaks at the system tray boundary.
    Box(modifier = Modifier.fillMaxSize().background(CompasBg)) {
        Ambient()

        NavHost(
            navController = navController,
            startDestination = startDestination,
            modifier = Modifier.fillMaxSize().statusBarsPadding(),
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
                    onNoteClick = { navController.navigate(Screen.PostSessionNote.createRoute(it)) },
                    onCalendarClick = { navController.navigateTopLevel(Screen.Calendar) },
                    onClientClick = { navController.navigate(Screen.ClientDetail.createRoute(it)) },
                )
            }
            composable(Screen.Calendar.route) {
                CalendarScreen(
                    onSessionClick = { navController.navigate(Screen.SessionDetail.createRoute(it)) },
                    onClientClick = { navController.navigate(Screen.ClientDetail.createRoute(it)) },
                    onAddSession = { navController.navigate(Screen.QuickAction.createRoute("new-session")) },
                )
            }
            composable(Screen.Clients.route) {
                ClientsScreen(
                    onClientClick = { navController.navigate(Screen.ClientDetail.createRoute(it)) },
                    onAddClient = { navController.navigate(Screen.QuickAction.createRoute("new-client")) },
                )
            }
            composable(Screen.Notes.route) {
                NotesScreen(onSessionNoteClick = { navController.navigate(Screen.PostSessionNote.createRoute(it)) })
            }
            composable(Screen.Settings.route) {
                SettingsScreen(
                    onLogout = {
                        navController.navigate(Screen.Login.route) { popUpTo(0) { inclusive = true } }
                    },
                    onScheduleClick = { navController.navigate(Screen.Schedule.route) },
                )
            }
            composable(Screen.Schedule.route) {
                ScheduleScreen(onBack = { navController.popBackStack() })
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
                    onNoteClick = { sessionId -> navController.navigate(Screen.PostSessionNote.createRoute(sessionId)) },
                    onQuickAction = { type -> navController.navigate(Screen.QuickAction.createRoute(type)) },
                )
            }
        }

        if (showDock) {
            val tabs = remember { BottomNavItem.entries.map { DockTab(it.screen.route, it.label, it.icon) } }
            GlassDock(
                tabs = tabs,
                activeKey = currentRoute ?: Screen.Dashboard.route,
                onTab = { tab ->
                    if (currentRoute != tab.key) {
                        BottomNavItem.entries.firstOrNull { it.screen.route == tab.key }
                            ?.let { navController.navigateTopLevel(it.screen) }
                    }
                },
                onFab = { showActionSheet = true },
                modifier = Modifier.align(Alignment.BottomCenter),
            )
        }

        if (showActionSheet) {
            val clientsViewModel: ClientsViewModel = hiltViewModel()
            val clientsState by clientsViewModel.uiState.collectAsState()
            NewActionSheet(
                clients = clientsState.allClients,
                onClose = { showActionSheet = false },
                onNewSession = {
                    showActionSheet = false
                    navController.navigate(Screen.QuickAction.createRoute("new-session"))
                },
                onNewClient = {
                    showActionSheet = false
                    navController.navigate(Screen.QuickAction.createRoute("new-client"))
                },
                onClient = { id ->
                    showActionSheet = false
                    navController.navigate(Screen.ClientDetail.createRoute(id))
                },
            )
        }

        if (isLoggedIn) {
            LegalGateOverlay()
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
