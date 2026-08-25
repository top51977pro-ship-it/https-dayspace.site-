package site.dayspace.pulsecountdown.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import android.app.Activity
import site.dayspace.pulsecountdown.data.settings.ThemeMode

private val DarkColors = darkColorScheme(
    primary = PulseViolet,
    onPrimary = PulseTextPrimary,
    primaryContainer = PulseVioletSoft,
    onPrimaryContainer = PulseVoid,
    secondary = PulseCyan,
    onSecondary = PulseVoid,
    tertiary = PulseRose,
    background = PulseVoid,
    onBackground = PulseTextPrimary,
    surface = PulseSurface,
    onSurface = PulseTextPrimary,
    surfaceVariant = PulseCard,
    onSurfaceVariant = PulseTextMuted,
    outline = PulseStroke,
)

private val LightColors = lightColorScheme(
    primary = PulseVioletDeep,
    onPrimary = PulseLightSurface,
    primaryContainer = PulseVioletSoft,
    onPrimaryContainer = PulseLightText,
    secondary = PulseCyanDeep,
    onSecondary = PulseLightSurface,
    tertiary = PulseRose,
    background = PulseLightBg,
    onBackground = PulseLightText,
    surface = PulseLightSurface,
    onSurface = PulseLightText,
    surfaceVariant = PulseLightCard,
    onSurfaceVariant = PulseLightMuted,
    outline = PulseLightStroke,
)

@Composable
fun PulseCountdownTheme(
    themeMode: ThemeMode,
    content: @Composable () -> Unit,
) {
    val dark = when (themeMode) {
        ThemeMode.DARK -> true
        ThemeMode.LIGHT -> false
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
    }
    val colors = if (dark) DarkColors else LightColors

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window ?: return@SideEffect
            // Draw behind the system bars and match icon tint to the active theme.
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !dark
            WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = !dark
        }
    }

    MaterialTheme(
        colorScheme = colors,
        typography = PulseTypography,
        content = content,
    )
}

/** True when the active scheme is the dark one; gradients key off this. */
@Composable
fun isDarkTheme(): Boolean = MaterialTheme.colorScheme.background == PulseVoid
