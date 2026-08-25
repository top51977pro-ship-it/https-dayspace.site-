package site.dayspace.pulsecountdown

import android.app.Application
import site.dayspace.pulsecountdown.notifications.PulseNotifications

class PulseApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Creating the channel here means it exists before any alarm can fire.
        PulseNotifications.ensureChannel(this)
    }
}
