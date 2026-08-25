package site.dayspace.pulsecountdown.data.model

import kotlinx.serialization.json.Json

/**
 * JSON codec for the persisted store.
 *
 * Decoding never throws to callers: a corrupt or truncated payload yields an empty store rather
 * than crashing the app on launch, which is the only sane behaviour for a local cache.
 */
object CountdownSerializer {

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    fun encode(store: CountdownStore): String = json.encodeToString(CountdownStore.serializer(), store)

    fun decode(raw: String?): CountdownStore {
        if (raw.isNullOrBlank()) return CountdownStore()
        return try {
            json.decodeFromString(CountdownStore.serializer(), raw)
        } catch (e: Exception) {
            CountdownStore()
        }
    }
}
