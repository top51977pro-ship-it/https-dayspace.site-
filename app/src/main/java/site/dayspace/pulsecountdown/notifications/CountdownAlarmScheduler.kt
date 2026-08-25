package site.dayspace.pulsecountdown.notifications

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.content.getSystemService
import site.dayspace.pulsecountdown.data.model.Countdown

/**
 * Schedules the local "it's time" alarm. Entirely on-device: no server, no network.
 */
object CountdownAlarmScheduler {

    fun schedule(context: Context, countdown: Countdown) {
        val manager = context.getSystemService<AlarmManager>() ?: return
        val triggerAt = countdown.targetEpochMillis

        // Nothing to schedule for a target that has already passed.
        if (triggerAt <= System.currentTimeMillis()) return

        val pending = pendingIntent(context, countdown, mutable = false) ?: return

        try {
            // setAlarmClock is exact and survives Doze without needing SCHEDULE_EXACT_ALARM,
            // which makes it the right primitive for a countdown hitting zero.
            val showIntent = pendingIntent(context, countdown, mutable = true) ?: pending
            manager.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAt, showIntent), pending)
        } catch (e: SecurityException) {
            // Some OEM builds restrict alarm APIs; degrade to an inexact alarm rather than crash.
            fallback(manager, triggerAt, pending)
        }
    }

    fun cancel(context: Context, countdown: Countdown) {
        val manager = context.getSystemService<AlarmManager>() ?: return
        pendingIntent(context, countdown, mutable = false)?.let(manager::cancel)
    }

    private fun fallback(manager: AlarmManager, triggerAt: Long, pending: PendingIntent) {
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
            } else {
                manager.set(AlarmManager.RTC_WAKEUP, triggerAt, pending)
            }
        }
    }

    private fun pendingIntent(context: Context, countdown: Countdown, mutable: Boolean): PendingIntent? {
        val intent = Intent(context, CountdownAlarmReceiver::class.java).apply {
            action = CountdownAlarmReceiver.ACTION_COUNTDOWN_FINISHED
            putExtra(CountdownAlarmReceiver.EXTRA_ID, countdown.id)
            putExtra(CountdownAlarmReceiver.EXTRA_TITLE, countdown.title)
        }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (mutable) PendingIntent.FLAG_MUTABLE else PendingIntent.FLAG_IMMUTABLE

        return PendingIntent.getBroadcast(context, countdown.id.hashCode(), intent, flags)
    }
}
