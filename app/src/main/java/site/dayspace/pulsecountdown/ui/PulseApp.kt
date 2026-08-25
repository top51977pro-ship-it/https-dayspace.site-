package site.dayspace.pulsecountdown.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import site.dayspace.pulsecountdown.navigation.PulseDestination
import site.dayspace.pulsecountdown.navigation.PulseNavHost
import site.dayspace.pulsecountdown.ui.components.PulseBackground
import site.dayspace.pulsecountdown.ui.screens.CountdownEditorSheet

@Composable
fun PulseApp(
    viewModel: PulseViewModel,
    onEnsureNotificationPermission: ((Boolean) -> Unit) -> Unit,
) {
    val navController = rememberNavController()
    val countdowns by viewModel.countdowns.collectAsStateWithLifecycle()
    val favorite by viewModel.favorite.collectAsStateWithLifecycle()
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val editor by viewModel.editor.collectAsStateWithLifecycle()
    val message by viewModel.message.collectAsStateWithLifecycle()

    val snackbarHostState = remember { SnackbarHostState() }
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = backStackEntry?.destination

    // Messages are string resources, so resolve them here where a Context is available.
    val messageText = message?.let { stringResource(it) }
    LaunchedEffect(messageText) {
        if (messageText != null) {
            snackbarHostState.showSnackbar(messageText)
            viewModel.consumeMessage()
        }
    }

    PulseBackground {
        Scaffold(
            containerColor = Color.Transparent,
            snackbarHost = { SnackbarHost(snackbarHostState) },
            bottomBar = {
                NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                    PulseDestination.entries.forEach { destination ->
                        val selected = currentDestination?.hierarchy?.any {
                            it.route == destination.route
                        } == true

                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(destination.route) {
                                    // Keep a single instance per tab and preserve each tab's state.
                                    popUpTo(navController.graph.startDestinationId) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = {
                                Icon(
                                    imageVector = destination.icon,
                                    contentDescription = null,
                                )
                            },
                            label = { Text(stringResource(destination.labelRes)) },
                        )
                    }
                }
            },
        ) { innerPadding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                PulseNavHost(
                    navController = navController,
                    favorite = favorite,
                    countdowns = countdowns,
                    settings = settings,
                    onCreate = viewModel::openCreate,
                    onEdit = viewModel::openEdit,
                    onDelete = viewModel::delete,
                    onToggleFavorite = viewModel::setFavorite,
                    onThemeChange = viewModel::setThemeMode,
                    onNotificationsChange = viewModel::setNotificationsEnabled,
                )
            }
        }
    }

    CountdownEditorSheet(
        state = editor,
        onTitleChange = viewModel::onTitleChange,
        onEmojiChange = viewModel::onEmojiChange,
        onDateChange = viewModel::onDateChange,
        onTimeChange = viewModel::onTimeChange,
        onNotifyChange = { wantsNotify ->
            if (wantsNotify) {
                // Ask at the moment of opt-in; a denial flips the switch back rather than
                // leaving the user believing a notification is armed.
                onEnsureNotificationPermission { granted ->
                    viewModel.onNotifyChange(granted)
                    if (!granted) viewModel.notifyPermissionDenied()
                }
            } else {
                viewModel.onNotifyChange(false)
            }
        },
        onSave = { viewModel.save() },
        onDismiss = viewModel::dismissEditor,
    )
}
