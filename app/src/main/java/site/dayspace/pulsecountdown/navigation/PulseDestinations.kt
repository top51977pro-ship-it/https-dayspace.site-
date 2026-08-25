package site.dayspace.pulsecountdown.navigation

import androidx.annotation.StringRes
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.HourglassEmpty
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.ui.graphics.vector.ImageVector
import site.dayspace.pulsecountdown.R

enum class PulseDestination(
    val route: String,
    @StringRes val labelRes: Int,
    val icon: ImageVector,
) {
    HOME("home", R.string.nav_home, Icons.Outlined.Home),
    COUNTDOWNS("countdowns", R.string.nav_countdowns, Icons.Outlined.HourglassEmpty),
    SETTINGS("settings", R.string.nav_settings, Icons.Outlined.Settings),
}
