package site.dayspace.pulsecountdown

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import site.dayspace.pulsecountdown.notifications.PulseNotifications
import site.dayspace.pulsecountdown.ui.PulseApp
import site.dayspace.pulsecountdown.ui.PulseViewModel
import site.dayspace.pulsecountdown.ui.theme.PulseCountdownTheme

class MainActivity : ComponentActivity() {

    private var onPermissionResult: ((Boolean) -> Unit)? = null

    private val requestNotificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            onPermissionResult?.invoke(granted)
            onPermissionResult = null
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        PulseNotifications.ensureChannel(this)

        setContent {
            val viewModel: PulseViewModel = viewModel()
            val settings by viewModel.settings.collectAsStateWithLifecycle()

            PulseCountdownTheme(themeMode = settings.themeMode) {
                PulseApp(
                    viewModel = viewModel,
                    onEnsureNotificationPermission = ::ensureNotificationPermission,
                )
            }
        }
    }

    /**
     * Asks for POST_NOTIFICATIONS only where it exists (API 33+) and only when it is actually
     * needed — i.e. the moment the user opts a countdown into notifying.
     */
    private fun ensureNotificationPermission(onResult: (Boolean) -> Unit) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            onResult(true)
            return
        }

        val granted = ContextCompat.checkSelfPermission(
            this, Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED

        if (granted) {
            onResult(true)
            return
        }

        onPermissionResult = onResult
        requestNotificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
}
