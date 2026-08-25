package site.dayspace.pulsecountdown.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.res.stringResource
import site.dayspace.pulsecountdown.R
import site.dayspace.pulsecountdown.data.model.Countdown
import site.dayspace.pulsecountdown.domain.CountdownMath
import site.dayspace.pulsecountdown.domain.DateTimeFormat

@Composable
fun CountdownListItem(
    countdown: Countdown,
    onOpen: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onToggleFavorite: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val remaining by rememberRemainingTime(countdown.targetEpochMillis)

    GlassCard(modifier = modifier.fillMaxWidth(), cornerRadius = 22.dp) {
        Row(
            modifier = Modifier
                .clickable(onClick = onOpen)
                .padding(start = 16.dp, top = 14.dp, bottom = 14.dp, end = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(text = countdown.emoji, fontSize = 26.sp)

            Spacer(Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = countdown.title,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = if (remaining.isFinished) {
                        stringResource(R.string.its_time)
                    } else {
                        CountdownMath.compact(remaining)
                    },
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.primary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = DateTimeFormat.short(countdown.targetEpochMillis),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            Row(horizontalArrangement = Arrangement.End) {
                IconButton(onClick = onToggleFavorite, modifier = Modifier.size(44.dp)) {
                    Icon(
                        imageVector = if (countdown.isFavorite) Icons.Filled.Star else Icons.Outlined.StarBorder,
                        contentDescription = stringResource(
                            if (countdown.isFavorite) R.string.cd_unset_favorite else R.string.cd_set_favorite,
                            countdown.title,
                        ),
                        tint = if (countdown.isFavorite) {
                            MaterialTheme.colorScheme.secondary
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                    )
                }
                IconButton(onClick = onEdit, modifier = Modifier.size(44.dp)) {
                    Icon(
                        Icons.Outlined.Edit,
                        contentDescription = stringResource(R.string.cd_edit, countdown.title),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(onClick = onDelete, modifier = Modifier.size(44.dp)) {
                    Icon(
                        Icons.Outlined.Delete,
                        contentDescription = stringResource(R.string.cd_delete, countdown.title),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
