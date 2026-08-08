# Instructions for Claude

You are receiving an Android project called **NevoGPT Mobile**.

Your job is to finish it and compile a REAL installable APK.

Requirements:
1. Keep it 100% free to use after installation. Do NOT use OpenAI API, Anthropic API, Gemini API, or any paid/cloud inference API.
2. Replace `DemoLocalEngine` with real on-device LLM inference.
3. Preferred runtime: llama.cpp compiled for Android through JNI/CMake. If a maintained Android library is clearly more reliable, you may use it instead, but inference must remain local.
4. Use a small multilingual instruction-tuned GGUF model suitable for a modern Android phone. Prefer a Q4 quantization and good Hebrew + English support. Do not silently claim a model supports Hebrew: test it.
5. Do NOT commit a multi-GB model into the APK if that makes installation impractical. Preferred UX:
   - first launch explains model size;
   - user taps Download Model;
   - download from the model publisher's legitimate public source;
   - show progress;
   - verify size/checksum if available;
   - save in app-private storage;
   - after that, chat works offline.
6. Preserve the existing Compose UI and local conversation storage, improving it where useful.
7. Implement token streaming, Stop generation, Regenerate, Copy, New Chat, rename/delete conversations.
8. Keep generation off the main UI thread. Handle cancellation and low-memory errors.
9. Add sensible generation controls internally (context size, temperature, top-p, max tokens).
10. No fake responses once the real model is installed.
11. Build and test the project. Fix every compiler/build error.
12. Run at least one real prompt in Hebrew and one in English through the local model if emulator/device execution is available.
13. Produce:
   - `app-debug.apk` (and release APK if signing is feasible without private credentials)
   - full source ZIP
   - concise BUILD_REPORT.md stating exactly what was tested and any limitations.
14. Never claim an APK/model works unless you actually built/tested it.

Target: Android 10+ (API 29+), arm64-v8a first. Optimize for Samsung/modern ARM64 phones.
