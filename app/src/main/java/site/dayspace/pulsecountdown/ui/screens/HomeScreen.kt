package site.dayspace.pulsecountdown.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import site.dayspace.pulsecountdown.R
import site.dayspace.pulsecountdown.data.model.Countdown
import site.dayspace.pulsecountdown.domain.DateTimeFormat
import site.dayspace.pulsecountdown.ui.components.Celebration
import site.dayspace.pulsecountdown.ui.components.CountdownDisplay
import site.dayspace.pulsecountdown.ui.components.EmptyState
import site.dayspace.pulsecountdown.ui.components.GlassCard
import site.dayspace.pulsecountdown.ui.components.rememberRemainingTime

@Composable
fun HomeScreen(
    favorite: Countdown?,
    onCreate: () -> Unit,
    onEdit: (Countdown) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 22.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(28.dp))

        Text(
            text = stringResource(R.string.app_name),
            style = MaterialTheme.typography.headlineLarge,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
        )
        Text(
            text = stringResource(R.string.tagline),
            modifier = Modifier.padding(top = 6.dp),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(36.dp))

        if (favorite == null) {
            GlassCard(modifier = Modifier.fillMaxWidth()) {
                EmptyState(
                    emoji = "⏳",
                    title = stringResource(R.string.empty_title),
                    subtitle = stringResource(R.string.empty_subtitle),
                )
            }
        } else {
            FeaturedCountdownCard(countdown = favorite)
        }

        Spacer(Modifier.height(28.dp))

        Button(
            onClick = onCreate,
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp),
        ) {
            Icon(Icons.Outlined.Add, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text(
                text = stringResource(R.string.new_countdown),
                style = MaterialTheme.typography.labelLarge,
            )
        }

        AnimatedVisibility(visible = favorite != null) {
            OutlinedButton(
                onClick = { favorite?.let(onEdit) },
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 52.dp)
                    .padding(top = 12.dp),
            ) {
                Icon(Icons.Outlined.Edit, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text(
                    text = stringResource(R.string.action_edit),
                    style = MaterialTheme.typography.labelLarge,
                )
            }
        }

        Spacer(Modifier.height(32.dp))
    }
}

@Composable
private fun FeaturedCountdownCard(countdown: Countdown) {
    val remaining by rememberRemainingTime(countdown.targetEpochMillis)

    GlassCard(modifier = Modifier.fillMaxWidth(), cornerRadius = 32.dp) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 30.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (remaining.isFinished) {
                Celebration()
            } else {
                CountdownDisplay(time = remaining)
            }

            Spacer(Modifier.height(30.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                Text(text = countdown.emoji, fontSize = 20.sp)
                Spacer(Modifier.width(8.dp))
                Text(
                    text = countdown.title,
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center,
                )
            }

            Text(
                text = DateTimeFormat.full(countdown.targetEpochMillis),
                modifier = Modifier.padding(top = 6.dp),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
    }
}
