# Pulse Countdown — Android

A countdown app built with Kotlin, Jetpack Compose and Material 3. No backend, no network
calls; everything is stored on-device and works fully offline.

## Build

```bash
./gradlew assembleDebug
```

Output: `app/build/outputs/apk/debug/app-debug.apk`

Requires an Android SDK. Either set `ANDROID_HOME`, or create `local.properties`:

```properties
sdk.dir=/path/to/Android/sdk
```

Run the pure-JVM unit tests (countdown math + persistence codec) with:

```bash
./gradlew :app:testDebugUnitTest
```

## Stack

| | |
|---|---|
| Language | Kotlin 2.0.21 |
| UI | Jetpack Compose + Material 3 |
| Gradle / AGP | 8.9 / 8.7.3 |
| minSdk / target | 26 (Android 8.0) / 35 |
| Persistence | DataStore Preferences + kotlinx.serialization |
| Notifications | AlarmManager + BroadcastReceiver (local only) |

DataStore was chosen over Room deliberately: the dataset is a short, user-curated list, so a
single JSON document needs no schema, no annotation processor and no migrations. It also keeps
the model and its codec as plain Kotlin, which is what makes them unit-testable off-device.

## Structure

```
data/model        Countdown model + JSON codec        (pure Kotlin)
data/repository   DataStore-backed source of truth
data/settings     Theme + notification preferences
domain            Countdown math, date formatting     (pure Kotlin)
navigation        Destinations + NavHost
notifications     Channel, alarm scheduling, receivers
ui/screens        Home, Countdowns, Settings, editor sheet
ui/components     Countdown display, glass card, ticker, list item
ui/theme          Colour, typography, theme
```

## Countdown accuracy

Remaining time is always recomputed as `target - now` from two absolute timestamps, never by
decrementing a counter, so it cannot drift when ticks arrive late or the process is backgrounded.
Ticks are aligned to the wall-clock second, and every displayed value is a non-negative `Long` —
there is no floating-point arithmetic in the countdown path, so `NaN`/`Infinity` are unreachable
by construction. Ticking is wrapped in `repeatOnLifecycle(STARTED)`, so it stops when the screen
is not visible and resumes with no loss of accuracy.
