package ru.cmpas.app.presentation

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.*
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
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
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)

        // Check auth state before showing content
        val isLoggedIn = runBlocking { userPreferences.isLoggedIn() }

        enableEdgeToEdge()

        setContent {
            CompasTheme {
                CompasNavHost(isLoggedIn = isLoggedIn)
            }
        }
    }
}
