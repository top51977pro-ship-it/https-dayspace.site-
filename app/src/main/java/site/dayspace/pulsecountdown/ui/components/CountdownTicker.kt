package site.dayspace.pulsecountdown.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.produceState
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import site.dayspace.pulsecountdown.domain.CountdownMath
import site.dayspace.pulsecountdown.domain.RemainingTime

/**
 * Ticks once per wall-clock second for as long as the screen is actually visible.
 *
 * Keyed on the target, so recomposition reuses the running coroutine instead of spawning a new
 * timer; wrapped in [repeatOnLifecycle] so ticking stops when the app is backgrounded and resumes
 * on return. Because each tick recomputes from absolute timestamps, pausing costs no accuracy.
 */
@Composable
fun rememberRemainingTime(targetEpochMillis: Long): State<RemainingTime> {
    val lifecycleOwner = LocalLifecycleOwner.current

    return produceState(
        initialValue = CountdownMath.remaining(targetEpochMillis, System.currentTimeMillis()),
        key1 = targetEpochMillis,
        key2 = lifecycleOwner,
    ) {
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                val now = System.currentTimeMillis()
                val remaining = CountdownMath.remaining(targetEpochMillis, now)
                value = remaining
                if (remaining.isFinished) break
                delay(CountdownMath.millisUntilNextTick(now))
            }
        }
    }
}
