package site.dayspace.pulsecountdown.navigation

import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import site.dayspace.pulsecountdown.data.model.Countdown
import site.dayspace.pulsecountdown.data.settings.AppSettings
import site.dayspace.pulsecountdown.data.settings.ThemeMode
import site.dayspace.pulsecountdown.ui.screens.CountdownsScreen
import site.dayspace.pulsecountdown.ui.screens.HomeScreen
import site.dayspace.pulsecountdown.ui.screens.SettingsScreen

@Composable
fun PulseNavHost(
    navController: NavHostController,
    favorite: Countdown?,
    countdowns: List<Countdown>,
    settings: AppSettings,
    onCreate: () -> Unit,
    onEdit: (Countdown) -> Unit,
    onDelete: (Countdown) -> Unit,
    onToggleFavorite: (Countdown) -> Unit,
    onThemeChange: (ThemeMode) -> Unit,
    onNotificationsChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    NavHost(
        navController = navController,
        startDestination = PulseDestination.HOME.route,
        modifier = modifier,
        // A plain cross-fade: tab switches should feel instant, not choreographed.
        enterTransition = { fadeIn(tween(180)) },
        exitTransition = { fadeOut(tween(140)) },
        popEnterTransition = { fadeIn(tween(180)) },
        popExitTransition = { fadeOut(tween(140)) },
    ) {
        composable(PulseDestination.HOME.route) {
            HomeScreen(
                favorite = favorite,
                onCreate = onCreate,
                onEdit = onEdit,
            )
        }
        composable(PulseDestination.COUNTDOWNS.route) {
            CountdownsScreen(
                countdowns = countdowns,
                // Opening a countdown promotes it to Home, which is the only "detail" it needs.
                onOpen = { countdown ->
                    onToggleFavorite(countdown)
                    navController.navigate(PulseDestination.HOME.route) {
                        popUpTo(PulseDestination.HOME.route) { inclusive = true }
                        launchSingleTop = true
                    }
                },
                onEdit = onEdit,
                onDelete = onDelete,
                onToggleFavorite = onToggleFavorite,
            )
        }
        composable(PulseDestination.SETTINGS.route) {
            SettingsScreen(
                settings = settings,
                onThemeChange = onThemeChange,
                onNotificationsChange = onNotificationsChange,
            )
        }
    }
}
