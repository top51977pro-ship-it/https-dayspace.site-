package site.dayspace.pulsecountdown.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

/**
 * The app ground: a flat base colour with two very soft radial washes.
 *
 * Deliberately static — an animated background would repaint every frame behind a screen whose
 * only real motion is one digit per second, which is a poor trade on a mid-range device.
 */
@Composable
fun PulseBackground(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    val scheme = MaterialTheme.colorScheme

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(scheme.background)
            .background(
                Brush.radialGradient(
                    colors = listOf(scheme.primary.copy(alpha = 0.16f), Color.Transparent),
                    center = Offset(0f, 0f),
                    radius = 1100f,
                )
            )
            .background(
                Brush.radialGradient(
                    colors = listOf(scheme.secondary.copy(alpha = 0.10f), Color.Transparent),
                    center = Offset(Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY),
                    radius = 1000f,
                )
            ),
        content = content,
    )
}
