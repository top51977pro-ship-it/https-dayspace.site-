package site.dayspace.pulsecountdown.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import site.dayspace.pulsecountdown.R
import site.dayspace.pulsecountdown.domain.CountdownMath
import site.dayspace.pulsecountdown.domain.RemainingTime
import androidx.compose.ui.res.stringResource

/**
 * The four big numbers. Each unit animates independently, so only the digit that actually changed
 * moves — a full-row transition every second would read as noise.
 */
@Composable
fun CountdownDisplay(
    time: RemainingTime,
    modifier: Modifier = Modifier,
) {
    BoxWithConstraints(modifier = modifier.fillMaxWidth()) {
        // Size the numerals to the space we actually have, and shrink again once the day count
        // grows a third or fourth digit, so nothing is ever clipped on a narrow screen.
        val base = when {
            maxWidth < 300.dp -> 34.sp
            maxWidth < 340.dp -> 38.sp
            maxWidth < 400.dp -> 44.sp
            else -> 50.sp
        }
        val numberSize = when {
            time.days >= 1000 -> base * 0.68f
            time.days >= 100 -> base * 0.82f
            else -> base
        }

        val spoken = stringResource(
            R.string.countdown_spoken,
            time.days, time.hours, time.minutes, time.seconds,
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                // One combined announcement; four separately-focusable numbers that change every
                // second would make TalkBack unusable.
                .clearAndSetSemantics { contentDescription = spoken },
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.Top,
        ) {
            TimeUnit(time.days.toString(), stringResource(R.string.unit_days), numberSize, Modifier.weight(1f))
            TimeUnit(CountdownMath.twoDigits(time.hours), stringResource(R.string.unit_hours), numberSize, Modifier.weight(1f))
            TimeUnit(CountdownMath.twoDigits(time.minutes), stringResource(R.string.unit_minutes), numberSize, Modifier.weight(1f))
            TimeUnit(CountdownMath.twoDigits(time.seconds), stringResource(R.string.unit_seconds), numberSize, Modifier.weight(1f))
        }
    }
}

@Composable
private fun TimeUnit(
    value: String,
    label: String,
    fontSize: TextUnit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        AnimatedContent(
            targetState = value,
            transitionSpec = {
                // New value rises into place as the old one falls away.
                (slideInVertically(tween(320)) { it / 3 } + fadeIn(tween(220)))
                    .togetherWith(slideOutVertically(tween(320)) { -it / 3 } + fadeOut(tween(160)))
            },
            label = "unit",
        ) { shown ->
            Text(
                text = shown,
                style = MaterialTheme.typography.displayLarge.copy(
                    fontSize = fontSize,
                    lineHeight = fontSize * 1.1f,
                ),
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                textAlign = TextAlign.Center,
            )
        }

        Text(
            text = label,
            modifier = Modifier.padding(top = 6.dp),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            textAlign = TextAlign.Center,
        )
    }
}
