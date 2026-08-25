package site.dayspace.pulsecountdown.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.content.getSystemService

object PulseNotifications {

    const val CHANNEL_ID = "pulse_countdown_finished"

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService<NotificationManager>() ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return

        val channel = NotificationChannel(
            CHANNEL_ID,
            context.getString(site.dayspace.pulsecountdown.R.string.channel_name),
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = context.getString(site.dayspace.pulsecountdown.R.string.channel_description)
        }
        manager.createNotificationChannel(channel)
    }
}
