package site.dayspace.pulsecountdown.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.Button
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import site.dayspace.pulsecountdown.R
import site.dayspace.pulsecountdown.domain.CountdownMath
import site.dayspace.pulsecountdown.domain.DateTimeFormat
import site.dayspace.pulsecountdown.ui.EditorState
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

private val EMOJI_CHOICES = listOf("🎯", "🎂", "🎉", "✈️", "💍", "🎓", "🏖️", "🚀", "❤️", "🎄")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CountdownEditorSheet(
    state: EditorState,
    onTitleChange: (String) -> Unit,
    onEmojiChange: (String) -> Unit,
    onDateChange: (LocalDate) -> Unit,
    onTimeChange: (LocalTime) -> Unit,
    onNotifyChange: (Boolean) -> Unit,
    onSave: () -> Unit,
    onDismiss: () -> Unit,
) {
    if (!state.visible) return

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.surface,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 22.dp)
                .padding(bottom = 22.dp)
                .navigationBarsPadding(),
        ) {
            Text(
                text = stringResource(
                    if (state.isEditing) R.string.edit_countdown else R.string.new_countdown
                ),
                style = MaterialTheme.typography.headlineLarge,
                color = MaterialTheme.colorScheme.onSurface,
            )

            OutlinedTextField(
                value = state.title,
                onValueChange = onTitleChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 18.dp),
                label = { Text(stringResource(R.string.field_name)) },
                placeholder = { Text(stringResource(R.string.field_name_placeholder)) },
                singleLine = true,
                isError = state.titleError != null,
                supportingText = state.titleError?.let { { Text(stringResource(it)) } },
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            )

            Text(
                text = stringResource(R.string.field_icon),
                modifier = Modifier.padding(top = 18.dp, bottom = 8.dp),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScrollCompat(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                EMOJI_CHOICES.forEach { emoji ->
                    EmojiChip(
                        emoji = emoji,
                        selected = state.emoji == emoji,
                        onClick = { onEmojiChange(emoji) },
                    )
                }
            }

            // Date
            PickerRow(
                icon = { Icon(Icons.Outlined.CalendarMonth, contentDescription = null) },
                label = stringResource(R.string.field_date),
                value = state.date?.let {
                    DateTimeFormat.short(
                        it.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
                    )
                } ?: stringResource(R.string.pick_date),
                error = state.dateError?.let { stringResource(it) },
                onClick = { showDatePicker = true },
                modifier = Modifier.padding(top = 18.dp),
            )

            // Time
            PickerRow(
                icon = { Icon(Icons.Outlined.Schedule, contentDescription = null) },
                label = stringResource(R.string.field_time),
                value = state.time?.let {
                    "${CountdownMath.twoDigits(it.hour.toLong())}:${CountdownMath.twoDigits(it.minute.toLong())}"
                }
                    ?: stringResource(R.string.pick_time),
                error = state.timeError?.let { stringResource(it) },
                onClick = { showTimePicker = true },
                modifier = Modifier.padding(top = 12.dp),
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 20.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(R.string.notify_me),
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Switch(checked = state.notify, onCheckedChange = onNotifyChange)
            }

            Button(
                onClick = onSave,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 54.dp)
                    .padding(top = 24.dp),
            ) {
                Text(
                    text = stringResource(
                        if (state.isEditing) R.string.save_changes else R.string.create_countdown
                    ),
                    style = MaterialTheme.typography.labelLarge,
                )
            }
        }
    }

    if (showDatePicker) {
        val today = LocalDate.now()
        val pickerState = rememberDatePickerState(
            initialSelectedDateMillis = (state.date ?: today)
                .atStartOfDay(ZoneId.of("UTC")).toInstant().toEpochMilli(),
            selectableDates = object : SelectableDates {
                // Grey out past days outright, so an invalid date is hard to pick in the first place.
                override fun isSelectableYear(year: Int) = year >= today.year
                override fun isSelectableDate(utcTimeMillis: Long): Boolean =
                    !DateTimeFormat.utcMillisToLocalDate(utcTimeMillis).isBefore(today)
            },
        )

        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    pickerState.selectedDateMillis?.let {
                        onDateChange(DateTimeFormat.utcMillisToLocalDate(it))
                    }
                    showDatePicker = false
                }) { Text(stringResource(R.string.action_ok)) }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) {
                    Text(stringResource(R.string.action_cancel))
                }
            },
        ) {
            DatePicker(state = pickerState)
        }
    }

    if (showTimePicker) {
        val now = LocalTime.now()
        val timeState = rememberTimePickerState(
            initialHour = state.time?.hour ?: now.hour,
            initialMinute = state.time?.minute ?: now.minute,
            is24Hour = true,
        )

        Dialog(onDismissRequest = { showTimePicker = false }) {
            androidx.compose.material3.Surface(
                shape = MaterialTheme.shapes.extraLarge,
                color = MaterialTheme.colorScheme.surface,
            ) {
                Column(
                    modifier = Modifier.padding(22.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = stringResource(R.string.pick_time),
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(bottom = 16.dp),
                    )
                    TimePicker(state = timeState)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp),
                        horizontalArrangement = Arrangement.End,
                    ) {
                        TextButton(onClick = { showTimePicker = false }) {
                            Text(stringResource(R.string.action_cancel))
                        }
                        TextButton(onClick = {
                            onTimeChange(LocalTime.of(timeState.hour, timeState.minute))
                            showTimePicker = false
                        }) { Text(stringResource(R.string.action_ok)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmojiChip(emoji: String, selected: Boolean, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        modifier = Modifier.heightIn(min = 48.dp),
        colors = androidx.compose.material3.ButtonDefaults.outlinedButtonColors(
            containerColor = if (selected) {
                MaterialTheme.colorScheme.primary.copy(alpha = 0.18f)
            } else {
                androidx.compose.ui.graphics.Color.Transparent
            }
        ),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp),
    ) {
        Text(text = emoji, style = MaterialTheme.typography.titleLarge)
    }
}

@Composable
private fun PickerRow(
    icon: @Composable () -> Unit,
    label: String,
    value: String,
    error: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        OutlinedButton(
            onClick = onClick,
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp),
        ) {
            icon()
            Spacer(Modifier.width(12.dp))
            Text(
                text = label,
                modifier = Modifier.weight(1f),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = value,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
        if (error != null) {
            Text(
                text = error,
                modifier = Modifier.padding(start = 16.dp, top = 6.dp),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error,
            )
        }
    }
}

/** Horizontal scroll for the emoji row, kept local so the import list stays readable. */
@Composable
private fun Modifier.horizontalScrollCompat(): Modifier =
    this.then(androidx.compose.foundation.horizontalScroll(rememberScrollState()))
