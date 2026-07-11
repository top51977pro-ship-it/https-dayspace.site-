package com.nevo.steppulse

import android.app.Application
import androidx.health.connect.client.HealthConnectClient
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

data class DailySteps(val date: LocalDate, val steps: Int)

enum class StepSource {
    HEALTH_CONNECT,
    PHONE_SENSOR,
    NONE
}

data class StepUiState(
    val steps: Int = 0,
    val goal: Int = 10_000,
    val weekly: List<DailySteps> = emptyList(),
    val permissionGranted: Boolean = false,
    val healthConnectAvailable: Boolean = true,
    val healthConnectNeedsUpdate: Boolean = false,
    val sensorAvailable: Boolean = false,
    val source: StepSource = StepSource.NONE,
    val isLoading: Boolean = true,
    val lastUpdated: String = "",
    val error: String? = null
) {
    val progress: Float get() = (steps.toFloat() / goal.coerceAtLeast(1)).coerceIn(0f, 1f)
    val distanceKm: Double get() = steps * 0.00072
    val calories: Int get() = (steps * 0.04).roundToInt()
    val activeMinutes: Int get() = (steps / 100.0).roundToInt()
    val goalReached: Boolean get() = steps >= goal
    val streak: Int
        get() {
            var count = 0
            for (day in weekly.asReversed()) {
                if (day.steps >= goal) count++ else break
            }
            return count
        }
}

class StepViewModel(application: Application) : AndroidViewModel(application) {
    private val healthRepository = HealthConnectRepository(application)
    private val sensorTracker = SensorStepTracker(application)
    private val goalStore = GoalStore(application)

    private val _uiState = MutableStateFlow(
        StepUiState(sensorAvailable = sensorTracker.isAvailable)
    )
    val uiState: StateFlow<StepUiState> = _uiState.asStateFlow()

    private var autoRefreshJob: Job? = null
    private var sensorCollectionJob: Job? = null

    init {
        viewModelScope.launch {
            goalStore.goal.collectLatest { goal ->
                _uiState.update { it.copy(goal = goal) }
            }
        }
        startAutoRefresh()
    }

    fun onActivityPermissionAvailable(granted: Boolean) {
        if (!granted || !sensorTracker.isAvailable) return

        sensorTracker.start()
        if (sensorCollectionJob != null) return

        sensorCollectionJob = viewModelScope.launch {
            sensorTracker.todaySteps.collectLatest { steps ->
                if (_uiState.value.source != StepSource.HEALTH_CONNECT) {
                    val today = LocalDate.now()
                    _uiState.update { current ->
                        val week = ensureSevenDays(current.weekly, today, steps)
                        current.copy(
                            steps = steps,
                            weekly = week,
                            source = StepSource.PHONE_SENSOR,
                            isLoading = false,
                            lastUpdated = nowLabel()
                        )
                    }
                }
            }
        }
    }

    fun refresh() {
        viewModelScope.launch { refreshInternal() }
    }

    fun setGoal(goal: Int) {
        viewModelScope.launch { goalStore.setGoal(goal) }
    }

    private fun startAutoRefresh() {
        autoRefreshJob?.cancel()
        autoRefreshJob = viewModelScope.launch {
            while (isActive) {
                refreshInternal()
                delay(30_000)
            }
        }
    }

    private suspend fun refreshInternal() {
        _uiState.update { it.copy(isLoading = true, error = null) }

        val status = healthRepository.sdkStatus
        val available = status == HealthConnectClient.SDK_AVAILABLE
        val needsUpdate = status == HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED

        if (available) {
            try {
                val granted = healthRepository.hasPermissions()
                if (granted) {
                    val week = healthRepository.readLastSevenDays()
                    val todaySteps = week.lastOrNull()?.steps ?: 0
                    _uiState.update {
                        it.copy(
                            steps = todaySteps,
                            weekly = week,
                            permissionGranted = true,
                            healthConnectAvailable = true,
                            healthConnectNeedsUpdate = false,
                            source = StepSource.HEALTH_CONNECT,
                            isLoading = false,
                            lastUpdated = nowLabel()
                        )
                    }
                    return
                }
                _uiState.update {
                    it.copy(
                        permissionGranted = false,
                        healthConnectAvailable = true,
                        healthConnectNeedsUpdate = false,
                        isLoading = false,
                        source = if (it.source == StepSource.PHONE_SENSOR) it.source else StepSource.NONE
                    )
                }
                return
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        permissionGranted = false,
                        healthConnectAvailable = true,
                        isLoading = false,
                        error = "לא הצלחתי לקרוא את נתוני הצעדים. נסה לרענן."
                    )
                }
                return
            }
        }

        _uiState.update {
            it.copy(
                healthConnectAvailable = false,
                healthConnectNeedsUpdate = needsUpdate,
                isLoading = false,
                source = if (it.source == StepSource.PHONE_SENSOR) it.source else StepSource.NONE,
                error = if (!sensorTracker.isAvailable) "אין במכשיר חיישן צעדים זמין." else null
            )
        }
    }

    private fun ensureSevenDays(existing: List<DailySteps>, today: LocalDate, todaySteps: Int): List<DailySteps> {
        val byDate = existing.associateBy { it.date }
        return (6 downTo 0).map { offset ->
            val date = today.minusDays(offset.toLong())
            if (date == today) DailySteps(date, todaySteps) else byDate[date] ?: DailySteps(date, 0)
        }
    }

    private fun nowLabel(): String = LocalTime.now().format(
        DateTimeFormatter.ofPattern("HH:mm", Locale("he", "IL"))
    )

    override fun onCleared() {
        sensorTracker.stop()
        super.onCleared()
    }
}
