package site.dayspace.pulsecountdown.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import site.dayspace.pulsecountdown.BuildConfig
import site.dayspace.pulsecountdown.R
import site.dayspace.pulsecountdown.data.settings.AppSettings
import site.dayspace.pulsecountdown.data.settings.ThemeMode
import site.dayspace.pulsecountdown.ui.components.GlassCard

@Composable
fun SettingsScreen(
    settings: AppSettings,
    onThemeChange: (ThemeMode) -> Unit,
    onNotificationsChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 22.dp),
    ) {
        Text(
            text = stringResource(R.string.settings),
            modifier = Modifier.padding(top = 28.dp, bottom = 20.dp),
            style = MaterialTheme.typography.headlineLarge,
            color = MaterialTheme.colorScheme.onSurface,
        )

        SectionCard(title = stringResource(R.string.appearance)) {
            Column(modifier = Modifier.selectableGroup()) {
                ThemeMode.entries.forEach { mode ->
                    val label = when (mode) {
                        ThemeMode.SYSTEM -> stringResource(R.string.theme_system)
                        ThemeMode.LIGHT -> stringResource(R.string.theme_light)
                        ThemeMode.DARK -> stringResource(R.string.theme_dark)
                    }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 52.dp)
                            // Selectable on the whole row, so the tap target is the row, not the dot.
                            .selectable(
                                selected = settings.themeMode == mode,
                                onClick = { onThemeChange(mode) },
                                role = Role.RadioButton,
                            )
                            .padding(horizontal = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(selected = settings.themeMode == mode, onClick = null)
                        Text(
                            text = label,
                            modifier = Modifier.padding(start = 12.dp),
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        SectionCard(title = stringResource(R.string.notifications)) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 52.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(R.string.notifications_enabled),
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Switch(
                    checked = settings.notificationsEnabled,
                    onCheckedChange = onNotificationsChange,
                )
            }
        }

        Spacer(Modifier.height(16.dp))

        SectionCard(title = stringResource(R.string.about)) {
            Text(
                text = stringResource(R.string.about_body),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = stringResource(R.string.version),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = BuildConfig.VERSION_NAME,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        Spacer(Modifier.height(32.dp))
    }
}

@Composable
private fun SectionCard(title: String, content: @Composable () -> Unit) {
    GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 22.dp) {
        Column(modifier = Modifier.padding(18.dp)) {
            Text(
                text = title,
                modifier = Modifier.padding(bottom = 10.dp),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
            )
            content()
        }
    }
}
