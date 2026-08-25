package site.dayspace.pulsecountdown.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import site.dayspace.pulsecountdown.data.repository.CountdownRepository

/**
 * Alarms do not survive a reboot, so re-arm every pending countdown once the device is back up.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        val pending = goAsync()
        val appContext = context.applicationContext

        CoroutineScope(Dispatchers.IO).launch {
            try {
                CountdownRepository(appContext).countdowns.first()
                    .filter { it.notifyOnZero && it.targetEpochMillis > System.currentTimeMillis() }
                    .forEach { CountdownAlarmScheduler.schedule(appContext, it) }
            } catch (e: Exception) {
                // Never let a boot broadcast crash the app.
            } finally {
                pending.finish()
            }
        }
    }
}
