package ru.cmpas.app.presentation.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// Light scheme matching cmpas.ru website exactly
private val CompasLightColorScheme = lightColorScheme(
    primary = Forest800,                    // #1D4735
    onPrimary = Color.White,
    primaryContainer = Sage150,             // #E7F0EA
    onPrimaryContainer = Forest900,         // #143D2F

    secondary = Forest600,                  // #2F6A52
    onSecondary = Color.White,
    secondaryContainer = Sage100,           // #EEF4EF
    onSecondaryContainer = Forest900,

    tertiary = CompasAccent,                // #CC9E50 (gold)
    onTertiary = Color.White,
    tertiaryContainer = CompasAccentLight,  // #F5E6C8
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
)

private val CompasDarkColorScheme = darkColorScheme(
    primary = Sage150,                      // Light green on dark
    onPrimary = Forest900,
    primaryContainer = Forest700,
    onPrimaryContainer = Sage50,

    secondary = Sage200,
    onSecondary = Forest900,
    secondaryContainer = Forest600,
    onSecondaryContainer = Sage50,

    tertiary = CompasAccent,
    onTertiary = Color(0xFF3D2E0F),
    tertiaryContainer = Color(0xFF5C4A1E),
    onTertiaryContainer = CompasAccentLight,

    background = DarkBackground,            // #0F1A14
    onBackground = Sage50,
    surface = DarkSurface,                  // #1A2920
    onSurface = Sage50,
    surfaceVariant = DarkSurfaceVariant,    // #243529
    onSurfaceVariant = Sage200,

    outline = Color(0xFF3A4F42),
    outlineVariant = Color(0xFF2D3F34),

    error = Color(0xFFFF8A80),
    onError = Color(0xFF5F1412),
    errorContainer = Color(0xFF5F1412),
    onErrorContainer = Color(0xFFFF8A80),
)

@Composable
fun CompasTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) CompasDarkColorScheme else CompasLightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            // Status bar color matches background
            window.statusBarColor = if (darkTheme) DarkBackground.toArgb() else CompasBackground.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = CompasTypography,
        shapes = CompasShapes,
        content = content,
    )
}
