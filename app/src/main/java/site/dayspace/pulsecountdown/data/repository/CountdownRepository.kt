package site.dayspace.pulsecountdown.data.repository

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import site.dayspace.pulsecountdown.data.model.Countdown
import site.dayspace.pulsecountdown.data.model.CountdownSerializer
import site.dayspace.pulsecountdown.data.model.CountdownStore
import java.io.IOException
import java.util.UUID

private val Context.countdownDataStore: DataStore<Preferences> by preferencesDataStore("pulse_countdowns")

/**
 * Single source of truth for countdowns, backed by DataStore.
 *
 * The whole store is kept as one JSON blob. The dataset is a short user-curated list, so the cost
 * of rewriting it wholesale is irrelevant next to the benefit of having no schema, no codegen and
 * no migrations to get wrong.
 */
class CountdownRepository(private val context: Context) {

    private val key = stringPreferencesKey("store_json")

    /** Ordered soonest-first, with finished countdowns sinking to the bottom. */
    val countdowns: Flow<List<Countdown>> = context.countdownDataStore.data
        .catch { cause ->
            // A read failure must not take the app down; surface an empty list instead.
            if (cause is IOException) emit(emptyPreferences()) else throw cause
        }
        .map { prefs -> sort(CountdownSerializer.decode(prefs[key]).countdowns) }

    val favorite: Flow<Countdown?> = countdowns.map { list ->
        list.firstOrNull { it.isFavorite } ?: list.firstOrNull()
    }

    suspend fun upsert(countdown: Countdown) = mutate { current ->
        val index = current.indexOfFirst { it.id == countdown.id }
        if (index >= 0) current.toMutableList().apply { this[index] = countdown }
        else current + countdown
    }

    suspend fun delete(id: String) = mutate { current -> current.filterNot { it.id == id } }

    /** Favorite is exclusive: promoting one demotes the rest in the same atomic write. */
    suspend fun setFavorite(id: String) = mutate { current ->
        current.map { it.copy(isFavorite = it.id == id) }
    }

    suspend fun setNotify(id: String, enabled: Boolean) = mutate { current ->
        current.map { if (it.id == id) it.copy(notifyOnZero = enabled) else it }
    }

    private suspend fun mutate(transform: (List<Countdown>) -> List<Countdown>) {
        context.countdownDataStore.edit { prefs ->
            val current = CountdownSerializer.decode(prefs[key]).countdowns
            prefs[key] = CountdownSerializer.encode(CountdownStore(transform(current)))
        }
    }

    private fun sort(list: List<Countdown>): List<Countdown> {
        val now = System.currentTimeMillis()
        return list.sortedWith(
            compareBy<Countdown> { it.targetEpochMillis <= now }
                .thenBy { it.targetEpochMillis }
        )
    }

    companion object {
        fun newId(): String = UUID.randomUUID().toString()
    }
}
