package site.dayspace.pulsecountdown.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import site.dayspace.pulsecountdown.R
import site.dayspace.pulsecountdown.data.model.Countdown
import site.dayspace.pulsecountdown.data.repository.CountdownRepository
import site.dayspace.pulsecountdown.data.settings.AppSettings
import site.dayspace.pulsecountdown.data.settings.SettingsRepository
import site.dayspace.pulsecountdown.data.settings.ThemeMode
import site.dayspace.pulsecountdown.domain.DateTimeFormat
import site.dayspace.pulsecountdown.notifications.CountdownAlarmScheduler
import java.time.LocalDate
import java.time.LocalTime

/** Editor form state. Errors are string resource ids so the VM stays free of Context. */
data class EditorState(
    val visible: Boolean = false,
    val editingId: String? = null,
    val title: String = "",
    val emoji: String = Countdown.DEFAULT_EMOJI,
    val date: LocalDate? = null,
    val time: LocalTime? = null,
    val notify: Boolean = false,
    val titleError: Int? = null,
    val dateError: Int? = null,
    val timeError: Int? = null,
) {
    val isEditing: Boolean get() = editingId != null
}

class PulseViewModel(application: Application) : AndroidViewModel(application) {

    private val countdownRepository = CountdownRepository(application)
    private val settingsRepository = SettingsRepository(application)

    private val _editor = MutableStateFlow(EditorState())
    val editor: StateFlow<EditorState> = _editor.asStateFlow()

    private val _message = MutableStateFlow<Int?>(null)
    val message: StateFlow<Int?> = _message.asStateFlow()

    val countdowns: StateFlow<List<Countdown>> = countdownRepository.countdowns
        .catch { _message.value = R.string.error_storage; emit(emptyList()) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val favorite: StateFlow<Countdown?> = countdownRepository.favorite
        .catch { emit(null) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    val settings: StateFlow<AppSettings> = settingsRepository.settings
        .catch { emit(AppSettings()) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AppSettings())

    // ---- Editor -------------------------------------------------------------------------------

    fun openCreate() {
        _editor.value = EditorState(visible = true)
    }

    fun openEdit(countdown: Countdown) {
        _editor.value = EditorState(
            visible = true,
            editingId = countdown.id,
            title = countdown.title,
            emoji = countdown.emoji,
            date = DateTimeFormat.toLocalDate(countdown.targetEpochMillis),
            time = DateTimeFormat.toLocalTime(countdown.targetEpochMillis),
            notify = countdown.notifyOnZero,
        )
    }

    fun dismissEditor() {
        _editor.value = EditorState()
    }

    // Editing any field clears that field's error, so the form stops scolding as soon as it's fixed.
    fun onTitleChange(value: String) {
        _editor.value = _editor.value.copy(title = value, titleError = null)
    }

    fun onEmojiChange(value: String) {
        _editor.value = _editor.value.copy(emoji = value)
    }

    fun onDateChange(value: LocalDate) {
        _editor.value = _editor.value.copy(date = value, dateError = null)
    }

    fun onTimeChange(value: LocalTime) {
        _editor.value = _editor.value.copy(time = value, timeError = null)
    }

    fun onNotifyChange(value: Boolean) {
        _editor.value = _editor.value.copy(notify = value)
    }

    /** @return true when the countdown was valid and saved. */
    fun save(): Boolean {
        val state = _editor.value

        val titleError = if (state.title.isBlank()) R.string.error_title_required else null
        val dateError = if (state.date == null) R.string.error_date_required else null
        val timeError = if (state.time == null) R.string.error_time_required else null

        if (titleError != null || dateError != null || timeError != null) {
            _editor.value = state.copy(
                titleError = titleError,
                dateError = dateError,
                timeError = timeError,
            )
            return false
        }

        val target = DateTimeFormat.toEpochMillis(state.date!!, state.time!!)
        if (target <= System.currentTimeMillis()) {
            _editor.value = state.copy(timeError = R.string.error_past)
            return false
        }

        val countdown = Countdown(
            id = state.editingId ?: CountdownRepository.newId(),
            title = state.title.trim(),
            targetEpochMillis = target,
            emoji = state.emoji.ifBlank { Countdown.DEFAULT_EMOJI },
            // A brand-new first countdown becomes the favorite so Home is never empty after
            // the user has just created something.
            isFavorite = countdowns.value.firstOrNull { it.id == state.editingId }?.isFavorite
                ?: countdowns.value.isEmpty(),
            notifyOnZero = state.notify,
            createdAtMillis = System.currentTimeMillis(),
        )

        viewModelScope.launch {
            try {
                countdownRepository.upsert(countdown)
                applyAlarm(countdown)
                _message.value =
                    if (state.isEditing) R.string.msg_updated else R.string.msg_created
            } catch (e: Exception) {
                _message.value = R.string.error_storage
            }
        }

        _editor.value = EditorState()
        return true
    }

    // ---- List actions -------------------------------------------------------------------------

    fun delete(countdown: Countdown) = viewModelScope.launch {
        try {
            CountdownAlarmScheduler.cancel(getApplication(), countdown)
            countdownRepository.delete(countdown.id)
            _message.value = R.string.msg_deleted
        } catch (e: Exception) {
            _message.value = R.string.error_storage
        }
    }

    fun setFavorite(countdown: Countdown) = viewModelScope.launch {
        try {
            countdownRepository.setFavorite(countdown.id)
        } catch (e: Exception) {
            _message.value = R.string.error_storage
        }
    }

    fun setNotify(countdown: Countdown, enabled: Boolean) = viewModelScope.launch {
        try {
            countdownRepository.setNotify(countdown.id, enabled)
            applyAlarm(countdown.copy(notifyOnZero = enabled))
        } catch (e: Exception) {
            _message.value = R.string.error_storage
        }
    }

    // ---- Settings -----------------------------------------------------------------------------

    fun setThemeMode(mode: ThemeMode) = viewModelScope.launch {
        runCatching { settingsRepository.setThemeMode(mode) }
    }

    fun setNotificationsEnabled(enabled: Boolean) = viewModelScope.launch {
        runCatching { settingsRepository.setNotificationsEnabled(enabled) }
        if (!enabled) {
            countdowns.value.forEach { CountdownAlarmScheduler.cancel(getApplication(), it) }
        } else {
            countdowns.value.filter { it.notifyOnZero }.forEach { applyAlarm(it) }
        }
    }

    fun notifyPermissionDenied() {
        _message.value = R.string.error_notification_permission
    }

    fun consumeMessage() {
        _message.value = null
    }

    private fun applyAlarm(countdown: Countdown) {
        val context = getApplication<Application>()
        val allowed = settings.value.notificationsEnabled && countdown.notifyOnZero
        if (allowed) {
            CountdownAlarmScheduler.schedule(context, countdown)
        } else {
            CountdownAlarmScheduler.cancel(context, countdown)
        }
    }
}
