package site.dayspace.pulsecountdown.domain

/**
 * A countdown broken into display units.
 *
 * Every field is a non-negative [Long], which is what structurally guarantees the UI can never
 * render NaN / Infinity: there is no floating-point arithmetic anywhere in the countdown path.
 */
data class RemainingTime(
    val days: Long,
    val hours: Long,
    val minutes: Long,
    val seconds: Long,
    val totalMillis: Long,
) {
    val isFinished: Boolean get() = totalMillis <= 0L

    companion object {
        val ZERO = RemainingTime(0L, 0L, 0L, 0L, 0L)
    }
}

object CountdownMath {

    private const val MILLIS_PER_SECOND = 1_000L
    private const val SECONDS_PER_MINUTE = 60L
    private const val SECONDS_PER_HOUR = 3_600L
    private const val SECONDS_PER_DAY = 86_400L

    /**
     * Remaining time as `target - now`.
     *
     * This is always derived from two absolute timestamps rather than by decrementing a counter,
     * so the countdown cannot drift no matter how irregular the tick interval is (missed frames,
     * a backgrounded process, or the device sleeping between ticks).
     *
     * A target at or in the past clamps to [RemainingTime.ZERO]; it never goes negative.
     */
    fun remaining(targetEpochMillis: Long, nowEpochMillis: Long): RemainingTime {
        val diff = targetEpochMillis - nowEpochMillis
        if (diff <= 0L) return RemainingTime.ZERO

        val totalSeconds = diff / MILLIS_PER_SECOND
        return RemainingTime(
            days = totalSeconds / SECONDS_PER_DAY,
            hours = (totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR,
            minutes = (totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE,
            seconds = totalSeconds % SECONDS_PER_MINUTE,
            totalMillis = diff,
        )
    }

    /**
     * Millis to wait so the next tick lands on a whole-second boundary.
     *
     * Sleeping a flat 1000ms accumulates the cost of each tick's own work; aligning to the wall
     * clock instead keeps the displayed seconds changing exactly when the second changes.
     */
    fun millisUntilNextTick(nowEpochMillis: Long): Long {
        val intoSecond = Math.floorMod(nowEpochMillis, MILLIS_PER_SECOND)
        return MILLIS_PER_SECOND - intoSecond
    }

    /** Zero-padded two-digit rendering; days can exceed two digits and are left unpadded. */
    fun twoDigits(value: Long): String {
        val safe = if (value < 0L) 0L else value
        return if (safe < 10L) "0$safe" else safe.toString()
    }

    /** Compact one-line form used on list cards, e.g. `12d 08h 43m 27s`. */
    fun compact(time: RemainingTime): String =
        "${time.days}d ${twoDigits(time.hours)}h ${twoDigits(time.minutes)}m ${twoDigits(time.seconds)}s"
}
