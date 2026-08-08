# BUILD_REPORT — NevoGPT Mobile

Honest account of what was done, what was verified, and what was **not**.

## Summary

The project as delivered could not be built by any Gradle-based toolchain: it had no
Gradle wrapper, no launcher icon, no `strings.xml`, no build types, and no explicit
JVM target. Those gaps are fixed here, and a GitHub Actions workflow now performs the
actual APK build.

**No APK was produced inside this session.** The reason is environmental, not a code
problem — see "Blocked" below.

## Blocked: `dl.google.com` is denied by the session egress policy

An Android build needs two things that are only served from `dl.google.com`:

1. **The Android SDK** — platform 35, build-tools, platform-tools
   (`dl.google.com/android/repository/...`).
2. **Google's Maven repository** — the Android Gradle Plugin and every `androidx.*` /
   Compose artifact. `maven.google.com` is only a redirector; it answers `301` to
   `https://dl.google.com/dl/android/maven2/...`.

Both are refused by this environment's outbound proxy:

```
CONNECT dl.google.com:443 -> 403   (policy denial)
```

Reachability actually observed from this session:

| Host | Result |
| --- | --- |
| `repo1.maven.org` (Maven Central) | 200 |
| `services.gradle.org` | 200 |
| `developer.android.com` | 200 |
| `maven.google.com` | 301 → `dl.google.com` |
| `dl.google.com` | **403 (blocked)** |

Those artifacts are not mirrored on Maven Central (`androidx.activity:activity-compose`
and `com.android.tools.build:gradle` both return 404 there), so there is no compliant
substitute. Per the proxy's own guidance, policy denials are reported rather than
routed around.

## What WAS verified in this session

Kotlin **2.0.21** compiler (`kotlin-compiler-embeddable`, from Maven Central), JVM
target 17, compiled against real `kotlinx-coroutines-core-jvm:1.9.0` and the Android 15
platform classes (`org.robolectric:android-all:15-robolectric-13954326`):

| File | Result |
| --- | --- |
| `Models.kt` | compiles, no errors |
| `LocalLlmEngine.kt` | compiles, no errors |
| `ChatStore.kt` | compiles, no errors |
| `NevoGPTApp.kt` | **not compiled** — needs Jetpack Compose (Google Maven) |

Also verified: every XML resource parses as well-formed XML; the Gradle wrapper
(8.11.1) is present and executable.

## What was NOT verified

- No Gradle build was run. `assembleDebug` / `assembleRelease` have never executed here.
- `NevoGPTApp.kt` was never compiled — the Compose UI is unverified against the compiler.
- No emulator or device run. The app has not been launched.
- No prompt, Hebrew or English, was run through anything.

## Changes made

- Added the Gradle wrapper (8.11.1) — `gradlew`, `gradlew.bat`, `gradle/wrapper/`.
- `app/build.gradle.kts`: explicit `debug`/`release` build types; `release` signed with
  the debug key so `assembleRelease` yields an installable APK without private
  credentials; Java 17 `compileOptions`; Kotlin `jvmTarget = 17`.
- `gradle.properties`: `android.nonTransitiveRClass`, parallel + build cache.
- Added `strings.xml`, `colors.xml`, an adaptive launcher icon
  (`mipmap-anydpi-v26/ic_launcher.xml` + a vector foreground; safe at `minSdk 29`).
- `AndroidManifest.xml`: `android:icon`, `roundIcon`, `supportsRtl="true"` (the UI is
  Hebrew/English), `windowSoftInputMode="adjustResize"` so the composer isn't hidden by
  the keyboard, and `label="@string/app_name"`.
- Added `.gitignore` for Gradle/Android build output.
- Added `.github/workflows/android-apk.yml`, which runs the real build on a GitHub
  runner (JDK 17 + Android SDK 35) and uploads `app-debug.apk` and `app-release.apk`.

## How to get the APK

**Via CI (no local setup):** the workflow runs on every push touching
`NevoGPT-Mobile/**`, and can be started by hand from the Actions tab
("Build NevoGPT APK" → Run workflow). The APKs land in the run's Artifacts section.

**Locally**, on a machine that can reach `dl.google.com`:

```bash
cd NevoGPT-Mobile
./gradlew assembleDebug
# app/build/outputs/apk/debug/app-debug.apk
```

Android Studio (or a standalone SDK with `ANDROID_HOME` set) is required.

## Still open — the AI engine

`CLAUDE_BUILD_PROMPT.md` asks for real on-device inference. That is **not done**.
`DemoLocalEngine` is still a scripted placeholder: it echoes a fixed sentence, choosing
Hebrew or English by scanning the input for Hebrew codepoints. It is not a language
model and must not be described as one. Replacing it with a real llama.cpp/GGUF runtime
is a separate, substantially larger task than getting the project to compile, and it
cannot be validated in an environment that can neither build the app nor download a
model.
