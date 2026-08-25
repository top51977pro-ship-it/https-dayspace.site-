package site.dayspace.pulsecountdown.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Soft "glass" surface: a subtle vertical sheen plus a hairline stroke.
 *
 * Compose has no cheap backdrop blur below API 31, so this fakes depth with a gradient rather
 * than paying for a real blur — the look holds up and the cost is a single draw.
 */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 28.dp,
    content: @Composable BoxScope.() -> Unit,
) {
    val scheme = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(cornerRadius)

    Box(
        modifier = modifier
            .clip(shape)
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        scheme.surfaceVariant.copy(alpha = 0.95f),
                        scheme.surface.copy(alpha = 0.92f),
                    )
                )
            )
            .border(BorderStroke(1.dp, scheme.outline), shape),
        content = content,
    )
}
