package ru.cmpas.app.presentation.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

private val LightColorScheme = lightColorScheme(
    primary = ForestGreen800,
    onPrimary = androidx.compose.ui.graphics.Color.White,
    primaryContainer = Sage100,
    onPrimaryContainer = ForestGreen800,
    secondary = GoldAccent,
    onSecondary = OnSurface,
    secondaryContainer = GoldAccentLight,
    onSecondaryContainer = OnSurface,
    tertiary = ForestGreen600,
    onTertiary = androidx.compose.ui.graphics.Color.White,
    background = SurfaceLight,
    onBackground = OnSurface,
    surface = SurfaceLight,
    onSurface = OnSurface,
    surfaceVariant = SurfaceContainer,
    onSurfaceVariant = OnSurfaceVariant,
    outline = OutlineVariant,
    error = ErrorRed,
    onError = androidx.compose.ui.graphics.Color.White,
)

private val DarkColorScheme = darkColorScheme(
    primary = Sage200,
    onPrimary = ForestGreen800,
    primaryContainer = ForestGreen700,
    onPrimaryContainer = Sage100,
    secondary = GoldAccent,
    onSecondary = OnSurface,
    secondaryContainer = ForestGreen700,
    onSecondaryContainer = GoldAccentLight,
    tertiary = Sage200,
    onTertiary = ForestGreen800,
    background = SurfaceDark,
    onBackground = Sage50,
    surface = SurfaceDark,
    onSurface = Sage50,
    surfaceVariant = SurfaceDarkContainer,
    onSurfaceVariant = OnSurfaceMuted,
    outline = ForestGreen700,
    error = ErrorRed,
    onError = androidx.compose.ui.graphics.Color.White,
)

@Composable
fun CompasTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        // Dynamic color on Android 12+
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context)
            else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = CompasTypography,
        shapes = CompasShapes,
        content = content,
    )
}
