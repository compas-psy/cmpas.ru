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
    primary = Forest700,                    // #1A4D3A
    onPrimary = Color.White,
    primaryContainer = Sage100,             // #E9EFE6
    onPrimaryContainer = Forest900,         // #123829

    secondary = Forest600,                  // #2D7A5E
    onSecondary = Color.White,
    secondaryContainer = Sage100,
    onSecondaryContainer = Forest900,

    tertiary = CompasAccent,                // #C9A961
    onTertiary = Color.White,
    tertiaryContainer = CompasAccentLight,
    onTertiaryContainer = Color(0xFF3D2E0F),

    background = CompasBg,                   // #FAF8F5
    onBackground = CompasFg,                 // #16271D
    surface = CompasCard,                    // #FFFFFF
    onSurface = CompasFg,
    surfaceVariant = Sage50,                 // #F2F5EE
    onSurfaceVariant = CompasMutedFg,        // #5B6B61

    outline = CompasBorder,                  // #E7E3D9
    outlineVariant = CompasBorder,

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
