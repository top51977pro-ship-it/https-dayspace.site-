# NevoGPT Mobile

Android chat app prepared for a fully local/offline LLM. No paid API key is required.

## What is included
- Native Kotlin + Jetpack Compose UI
- Dark GPT-style chat screen
- Hebrew/English UI support
- Conversation history stored locally
- New chat, rename, delete, copy response
- Streaming-ready inference abstraction
- Local demo engine so the app builds/runs before a model runtime is wired
- `LocalLlmEngine.kt` is the single integration point for llama.cpp / MLC / another on-device runtime

## Build

### On CI (no local Android SDK needed)
The `Build NevoGPT APK` GitHub Actions workflow builds both APKs and uploads them as
run artifacts. It runs on every push touching `NevoGPT-Mobile/**`, or on demand from the
Actions tab.

### Locally
Requires a machine that can reach `dl.google.com` (Android SDK + Google Maven).
Open the folder in Android Studio, let Gradle sync, then:

```bash
./gradlew assembleDebug     # app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease   # app/build/outputs/apk/release/app-release.apk
```

`assembleRelease` is signed with the debug key so it installs without any private
credentials in the repo. Swap in a real signing config before publishing anywhere.

See `BUILD_REPORT.md` for exactly what has and has not been verified.

## Important
This source deliberately does NOT pretend that a language model is embedded when it is not.
The included `DemoLocalEngine` proves the UI and storage path. Claude should replace it with a real
on-device GGUF runtime (recommended: llama.cpp Android/JNI), bundle or download a small quantized
multilingual instruct model, and keep all inference on-device.

See `CLAUDE_BUILD_PROMPT.md`.
