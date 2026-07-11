package com.nevo.steppulse.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val StepPulseColors = darkColorScheme(
    primary = Purple,
    secondary = Cyan,
    tertiary = Mint,
    background = Night,
    surface = Card,
    surfaceVariant = CardLight,
    onPrimary = TextPrimary,
    onSecondary = Night,
    onBackground = TextPrimary,
    onSurface = TextPrimary,
    onSurfaceVariant = TextSecondary,
    error = Coral
)

@Composable
fun StepPulseTheme(content: @Composable () -> Unit) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = Night.toArgb()
            window.navigationBarColor = Night.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
            WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = false
        }
    }

    MaterialTheme(
        colorScheme = StepPulseColors,
        typography = StepPulseTypography,
        content = content
    )
}
