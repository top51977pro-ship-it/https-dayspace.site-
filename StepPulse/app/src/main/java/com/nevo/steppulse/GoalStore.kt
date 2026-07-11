package com.nevo.steppulse

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.stepPulseDataStore by preferencesDataStore(name = "step_pulse_settings")

class GoalStore(private val context: Context) {
    private val goalKey = intPreferencesKey("daily_step_goal")

    val goal: Flow<Int> = context.stepPulseDataStore.data.map { preferences ->
        preferences[goalKey] ?: 10_000
    }

    suspend fun setGoal(value: Int) {
        context.stepPulseDataStore.edit { preferences ->
            preferences[goalKey] = value.coerceIn(2_000, 30_000)
        }
    }
}
