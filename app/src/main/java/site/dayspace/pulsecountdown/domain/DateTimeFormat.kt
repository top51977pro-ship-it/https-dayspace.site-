package site.dayspace.pulsecountdown.domain

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Presentation formatting for target instants. minSdk 26 means java.time is available natively,
 * so no desugaring is required.
 */
object DateTimeFormat {

    private fun zoned(epochMillis: Long) =
        Instant.ofEpochMilli(epochMillis).atZone(ZoneId.systemDefault())

    /** e.g. `14 September 2026 • 18:30` */
    fun full(epochMillis: Long, locale: Locale = Locale.getDefault()): String {
        val z = zoned(epochMillis)
        val date = DateTimeFormatter.ofPattern("d MMMM yyyy", locale).format(z)
        val time = DateTimeFormatter.ofPattern("HH:mm", locale).format(z)
        return "$date • $time"
    }

    /** e.g. `14 Sep 2026` */
    fun short(epochMillis: Long, locale: Locale = Locale.getDefault()): String =
        DateTimeFormatter.ofPattern("d MMM yyyy", locale).format(zoned(epochMillis))

    /** e.g. `18:30` */
    fun timeOnly(epochMillis: Long, locale: Locale = Locale.getDefault()): String =
        DateTimeFormatter.ofPattern("HH:mm", locale).format(zoned(epochMillis))

    /** Combines a picked date and time into an epoch millis in the device's zone. */
    fun toEpochMillis(date: LocalDate, time: LocalTime): Long =
        LocalDateTime.of(date, time).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()

    fun toLocalDate(epochMillis: Long): LocalDate = zoned(epochMillis).toLocalDate()

    fun toLocalTime(epochMillis: Long): LocalTime = zoned(epochMillis).toLocalTime()

    /**
     * Converts the date-picker's UTC-midnight value into the matching local calendar day.
     * Reading it in the device zone directly would shift the day for anyone west of UTC.
     */
    fun utcMillisToLocalDate(utcMillis: Long): LocalDate =
        Instant.ofEpochMilli(utcMillis).atZone(ZoneId.of("UTC")).toLocalDate()
}
