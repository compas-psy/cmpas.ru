package ru.cmpas.app.presentation.theme

import android.app.Activity
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// ═══════════════════════════════════════════
// ALWAYS light theme — matching cmpas.ru
// ═══════════════════════════════════════════
private val CompasLightColorScheme = lightColorScheme(
    primary = Forest800,                    // #1D4735
    onPrimary = Color.White,
    primaryContainer = Sage150,             // #E7F0EA
    onPrimaryContainer = Forest900,         // #143D2F

    secondary = Forest600,                  // #2F6A52
    onSecondary = Color.White,
    secondaryContainer = Sage100,           // #EEF4EF
    onSecondaryContainer = Forest900,

    tertiary = CompasAccent,                // #CC9E50
    onTertiary = Color.White,
    tertiaryContainer = CompasAccentLight,
    onTertiaryContainer = Color(0xFF3D2E0F),

    background = CompasBackground,          // #F7F8F4
    onBackground = CompasForeground,        // #142018
    surface = CompasCard,                   // #FFFFFF
    onSurface = CompasForeground,
    surfaceVariant = Sage50,                // #F6FAF6
    onSurfaceVariant = CompasMutedForeground, // #5F6C64

    outline = CompasBorder,                 // #E4E9E3
    outlineVariant = Sage200,

    error = CompasDestructive,              // #E35D4F
    onError = Color.White,
    errorContainer = Color(0xFFFCE4E4),
    onErrorContainer = Color(0xFF5F1412),

    inverseSurface = Forest900,
    inverseOnSurface = Sage50,
    inversePrimary = Sage150,

    surfaceTint = Forest800,
)

@Composable
fun CompasTheme(
    content: @Composable () -> Unit,
) {
    // Always use light theme to match the website
    val colorScheme = CompasLightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = CompasBackground.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = true
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = CompasTypography,
        shapes = CompasShapes,
        content = content,
    )
}
