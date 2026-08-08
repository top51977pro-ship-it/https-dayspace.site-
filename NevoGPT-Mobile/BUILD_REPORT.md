# BUILD_REPORT — NevoGPT Mobile

Honest account of what was done, what was verified, and what was **not**.

## Result

**Both APKs were built successfully.** GitHub Actions run
[#31258697545](https://github.com/top51977pro-ship-it/https-dayspace.site-/actions/runs/31258697545),
commit `1b8f47c`, `BUILD SUCCESSFUL`, ~4m of Gradle on a cold cache:

| Artifact | Task | Size |
| --- | --- | --- |
| `app-debug.apk` | `assembleDebug` | 14,228,579 bytes |
| `app-release.apk` | `assembleRelease` | 10,653,365 bytes |

Download them from the run's **Artifacts** section. Both are debug-key signed, so
they install directly on a phone (enable "install from unknown sources").

The project as delivered could not be built by any Gradle toolchain — it had no
Gradle wrapper, no launcher icon, no `strings.xml`, no build types, and no explicit
JVM target. Those gaps are fixed here.

## Where the build ran, and why not locally

The build ran on a GitHub-hosted runner, not in the authoring session. An Android
build needs two things served only from `dl.google.com`:

1. **The Android SDK** — platform 35, build-tools, platform-tools.
2. **Google's Maven repository** — the Android Gradle Plugin and every `androidx.*` /
   Compose artifact. `maven.google.com` is only a redirector; it answers `301` to
   `https://dl.google.com/dl/android/maven2/...`.

Both are refused by the authoring sandbox's egress policy (`CONNECT dl.google.com:443
-> 403`), and they are not mirrored on Maven Central (`androidx.activity:activity-compose`
and `com.android.tools.build:gradle` both 404 there). Per the proxy's own guidance,
policy denials are reported rather than routed around — so the build was moved to CI,
where those hosts are reachable. That is where the APKs above came from.

## What was verified

- **Full Gradle build, both variants** — `assembleDebug` and `assembleRelease`, AGP
  8.7.3 / Gradle 8.11.1 / Kotlin 2.0.21 / JDK 17, `compileSdk 35`. Zero compile errors.
  This covers all four Kotlin sources, including the Compose UI in `NevoGPTApp.kt`,
  plus resource merging, manifest merging, D8 and APK packaging/signing.
- **Kotlin sources, independently** — before CI, `Models.kt`, `LocalLlmEngine.kt` and
  `ChatStore.kt` were compiled locally with `kotlin-compiler-embeddable:2.0.21` against
  real `kotlinx-coroutines-core-jvm:1.9.0` and Android 15 platform classes: no errors.
- **XML resources** — every resource file parses as well-formed XML.

## What was NOT verified

- **No emulator or device run.** Neither APK has been installed or launched. The build
  proves it compiles and packages; it does not prove the UI behaves correctly at runtime.
- **No prompt was run through anything**, in Hebrew or English. There is no model to
  run one through (see below).
- No instrumentation or unit tests exist in the project, so none were run.

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
- Added `.github/workflows/android-apk.yml` — the workflow that produced the APKs above.

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
model and must not be described as one. The APKs above are a working chat *shell* —
UI, conversation storage, streaming plumbing, Stop — with a stub where the model goes.

Replacing it with a real llama.cpp/GGUF runtime is a separate, substantially larger
task than getting the project to compile.
