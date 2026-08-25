package site.dayspace.pulsecountdown.data.model

import kotlinx.serialization.Serializable

/**
 * A single countdown. Persisted as JSON, so every field must stay serializable and defaulted —
 * defaults are what let an older stored payload load into a newer app build without failing.
 */
@Serializable
data class Countdown(
    val id: String,
    val title: String,
    val targetEpochMillis: Long,
    val emoji: String = DEFAULT_EMOJI,
    val isFavorite: Boolean = false,
    val notifyOnZero: Boolean = false,
    val createdAtMillis: Long = 0L,
) {
    companion object {
        const val DEFAULT_EMOJI = "🎯"
    }
}

/** Root persisted document. Wrapping the list keeps room for future fields without a migration. */
@Serializable
data class CountdownStore(
    val countdowns: List<Countdown> = emptyList(),
)
