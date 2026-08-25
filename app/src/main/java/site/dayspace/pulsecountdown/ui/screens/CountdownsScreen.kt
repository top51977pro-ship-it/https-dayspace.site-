package site.dayspace.pulsecountdown.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import site.dayspace.pulsecountdown.R
import site.dayspace.pulsecountdown.data.model.Countdown
import site.dayspace.pulsecountdown.ui.components.CountdownListItem
import site.dayspace.pulsecountdown.ui.components.EmptyState
import site.dayspace.pulsecountdown.ui.components.GlassCard

@Composable
fun CountdownsScreen(
    countdowns: List<Countdown>,
    onOpen: (Countdown) -> Unit,
    onEdit: (Countdown) -> Unit,
    onDelete: (Countdown) -> Unit,
    onToggleFavorite: (Countdown) -> Unit,
    modifier: Modifier = Modifier,
) {
    // Deleting is destructive and the row's icons sit close together, so confirm first.
    var pendingDelete by remember { mutableStateOf<Countdown?>(null) }

    Column(modifier = modifier.fillMaxSize()) {
        Text(
            text = stringResource(R.string.my_countdowns),
            modifier = Modifier.padding(start = 22.dp, end = 22.dp, top = 28.dp, bottom = 16.dp),
            style = MaterialTheme.typography.headlineLarge,
            color = MaterialTheme.colorScheme.onSurface,
        )

        if (countdowns.isEmpty()) {
            GlassCard(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 22.dp),
            ) {
                EmptyState(
                    emoji = "⏳",
                    title = stringResource(R.string.empty_title),
                    subtitle = stringResource(R.string.empty_subtitle),
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 22.dp, vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(items = countdowns, key = { it.id }) { countdown ->
                    CountdownListItem(
                        countdown = countdown,
                        onOpen = { onOpen(countdown) },
                        onEdit = { onEdit(countdown) },
                        onDelete = { pendingDelete = countdown },
                        onToggleFavorite = { onToggleFavorite(countdown) },
                        modifier = Modifier.animateItem(),
                    )
                }
            }
        }
    }

    pendingDelete?.let { target ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text(stringResource(R.string.delete_title)) },
            text = { Text(stringResource(R.string.delete_message, target.title)) },
            confirmButton = {
                TextButton(onClick = {
                    onDelete(target)
                    pendingDelete = null
                }) { Text(stringResource(R.string.action_delete)) }
            },
            dismissButton = {
                TextButton(onClick = { pendingDelete = null }) {
                    Text(stringResource(R.string.action_cancel))
                }
            },
        )
    }
}
