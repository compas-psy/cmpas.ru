package ru.cmpas.app.presentation

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.runBlocking
import ru.cmpas.app.data.datastore.UserPreferences
import ru.cmpas.app.presentation.navigation.CompasNavHost
import ru.cmpas.app.presentation.theme.CompasTheme
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var userPreferences: UserPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        // Draw the application background behind the transparent status bar.
        // Individual screens still consume system insets in CompasNavHost, so
        // controls never overlap the clock or status icons.
        WindowCompat.setDecorFitsSystemWindows(window, false)

        // Handle deep link auth callback
        handleAuthDeepLink(intent)

        val isLoggedIn = runBlocking { userPreferences.isLoggedIn() }

        setContent {
            CompasTheme {
                CompasNavHost(isLoggedIn = isLoggedIn)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleAuthDeepLink(intent)
    }

    /**
     * Handle compas://auth/callback?accessToken=...&refreshToken=...&expiresIn=...
     */
    private fun handleAuthDeepLink(intent: Intent?) {
        val uri = intent?.data ?: return
        if (uri.scheme == "compas" && uri.host == "auth" && uri.path == "/callback") {
            val accessToken = uri.getQueryParameter("accessToken") ?: return
            val refreshToken = uri.getQueryParameter("refreshToken") ?: return

            runBlocking {
                userPreferences.saveTokens(accessToken, refreshToken)
            }

            val restartIntent = Intent(this, MainActivity::class.java)
            restartIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(restartIntent)
            finish()
        }
    }
}
