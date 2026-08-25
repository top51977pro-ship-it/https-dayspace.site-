package site.dayspace.pulsecountdown.data.settings

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException

private val Context.settingsDataStore: DataStore<Preferences> by preferencesDataStore("pulse_settings")

enum class ThemeMode { SYSTEM, LIGHT, DARK }

data class AppSettings(
    val themeMode: ThemeMode = ThemeMode.DARK,
    val notificationsEnabled: Boolean = true,
)

class SettingsRepository(private val context: Context) {

    private val themeKey = stringPreferencesKey("theme_mode")
    private val notificationsKey = booleanPreferencesKey("notifications_enabled")

    val settings: Flow<AppSettings> = context.settingsDataStore.data
        .catch { cause -> if (cause is IOException) emit(emptyPreferences()) else throw cause }
        .map { prefs ->
            AppSettings(
                themeMode = prefs[themeKey]?.let { stored ->
                    // An unrecognised stored value falls back rather than throwing.
                    runCatching { ThemeMode.valueOf(stored) }.getOrDefault(ThemeMode.DARK)
                } ?: ThemeMode.DARK,
                notificationsEnabled = prefs[notificationsKey] ?: true,
            )
        }

    suspend fun setThemeMode(mode: ThemeMode) {
        context.settingsDataStore.edit { it[themeKey] = mode.name }
    }

    suspend fun setNotificationsEnabled(enabled: Boolean) {
        context.settingsDataStore.edit { it[notificationsKey] = enabled }
    }
}
