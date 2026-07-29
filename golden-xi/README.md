# Golden XI — Ultimate Football 🥇⚽

A playable, landscape arcade football game built from the *Golden XI* design package.
The whole match engine is a **self-contained HTML5 app** (no server, no network), wrapped
in a **native Android WebView project** so it ships as an installable **`.apk`**.

> **IP note (from the design package):** every team, player, crest, kit and sponsor here is
> **original and fictional** — Golden XI (GXI) vs Kestrel United (KES), players named from a
> generated pool. No real people, clubs, leagues or likenesses are used anywhere.

---

## What you get

| Feature | Status |
| --- | --- |
| **12 difficulty levels** (Rookie → IMPOSSIBLE), saved between sessions, beat one to unlock the next | ✅ |
| Landscape 11-v-11 match, 3:00 clock | ✅ |
| Virtual **joystick** + action cluster **PASS / THROUGH / SHOOT / SPRINT & SKILL** | ✅ |
| Offense→defense button remap (SWITCH / TACKLE / SLIDE / CONTAIN) | ✅ |
| Timed-finish shooting window, shot power bar, placement from the stick | ✅ |
| Ball physics, dribbling, passing, through balls, tackles, goalkeepers | ✅ |
| Camera that follows play + **radar/minimap** (dots = GXI, triangles = KES) | ✅ |
| Auto-switch to the nearest player, active-player chevron + name tag | ✅ |
| Scoreboard, goals, throw-ins/goal-kicks, full-time + MOTM screen | ✅ |
| Keyboard controls for desktop testing | ✅ |

This is a focused, genuinely playable **v1 match** — not the full live-service game described in
`GDD.md` (online PvP, card collection, seasons, economy). It implements the on-pitch core and the
exact HUD from the reference image.

---

## Controls

**Touch (phone):**
- **Left stick** — move your active player (the one nearest the ball auto-switches to you).
- **PASS** (blue) — ground pass toward your run. On defense → **SWITCH** player.
- **THROUGH** (amber) — threaded ball into space. On defense → **TACKLE**.
- **SHOOT** (red) — *hold* to charge power, release inside the green window for a **timed-finish** bonus. On defense → **SLIDE**.
- **SPRINT & SKILL** (green) — hold to sprint; flick the stick while holding for a skill burst. On defense → **CONTAIN**.

**Desktop:** `WASD`/arrows move · `J` pass · `K` through · `L` (hold) shoot · `Shift` sprint.

---

## Play it in a browser (instant)

```bash
cd golden-xi
npm install          # optional, only needed for the smoke test
npm run dev          # → http://localhost:5173  (use a landscape / mobile viewport)
```

Or just open `golden-xi/www/index.html` directly in a browser.

---

## Play on a phone

- **iPhone / any browser → the website.** A GitHub Pages deploy
  ([`.github/workflows/pages.yml`](../.github/workflows/pages.yml)) publishes `golden-xi/www`
  to a public URL. Open it in Safari/Chrome, rotate to landscape, play. iPhone **cannot** install
  APKs, so this is the way for iOS. (Pages must be enabled once: repo **Settings → Pages →
  Source: GitHub Actions**.)
- **Android → the APK** (below), for an installed, full-screen app.

## Get the APK

Building an APK requires the **Android SDK + Android Gradle Plugin**, which live on Google's
servers (`dl.google.com` / `maven.google.com`). Pick whichever path fits you:

### ① GitHub Actions — recommended, zero local setup
A workflow is included at [`.github/workflows/android.yml`](../.github/workflows/android.yml).
On every push that touches `golden-xi/**`, GitHub's runners (which have the Android SDK and full
internet) build the app and upload **`golden-xi-debug-apk`** as a downloadable artifact.

1. Push this branch to GitHub (already done if you're reading this in the repo).
2. Open the repo's **Actions** tab → **Build Golden XI APK** → latest run (or **Run workflow**).
3. Download the **`golden-xi-debug-apk`** artifact → unzip → `app-debug.apk`.
4. Copy it to an Android phone and install (enable *Install unknown apps* for your file manager).

### ② Build locally (if you have the Android SDK)
```bash
cd golden-xi/android
# point at your SDK, e.g.:  echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
```
Requirements: JDK 17, Android SDK with platform **android-34** and build-tools (Android Studio
installs these automatically, or `sdkmanager "platforms;android-34" "build-tools;34.0.0"`).

> **Why not built in this cloud session?** This environment's egress policy blocks
> `dl.google.com`, so the Android SDK and Android Gradle Plugin can't be fetched here. The game
> code and the Gradle project are complete — only the final compile step needs that host, which
> is exactly what path ① (GitHub Actions) provides.

---

## Project layout

```
golden-xi/
├── www/                         # the game (open index.html to play)
│   ├── index.html               #   HUD markup: scoreboard, joystick, action cluster, radar
│   ├── style.css                #   GDD palette + responsive landscape HUD
│   └── game.js                  #   match engine: sim, AI, ball physics, rendering
├── android/                     # native WebView APK project
│   ├── app/src/main/
│   │   ├── assets/www/          #   ← copy of www/ bundled into the APK
│   │   ├── java/site/goldenxi/app/MainActivity.java
│   │   ├── res/…                #   theme, colors, launcher icon (original vector art)
│   │   └── AndroidManifest.xml  #   landscape, fullscreen, immersive
│   ├── build.gradle, app/build.gradle, settings.gradle
│   └── gradlew, gradle/wrapper  #   Gradle 8.9 wrapper
├── serve.mjs                    # local dev server (npm run dev)
├── smoke.mjs                    # headless Playwright smoke test (npm run smoke)
└── package.json
```

If you edit anything in `www/`, re-bundle it into the APK assets with:
```bash
npm run sync-assets
```

---

*Built from `GDD.md` / `BUILD_PROMPT.md`. Reference images used for HUD/gameplay framing only.*
