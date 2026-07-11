# Android (Capacitor) wrapper

This TanStack Start app is wrapped with [Capacitor](https://capacitorjs.com/) so
it can ship as a native Android app. All data stays local (Dexie/IndexedDB), so
the app runs entirely client-side inside the WebView.

- **App id:** `site.dayspace.closetbuddy`
- **App name:** `הארון שלי`
- **Launcher icon:** generated from `public/icon-512.png`

## Prerequisites

- Node 20+ and [Bun](https://bun.sh/)
- Android Studio + Android SDK (Platform 34+), JDK 21

## Install

```bash
bun install
```

This pulls in the Capacitor packages:

| Package | Purpose |
| --- | --- |
| `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` | native shell |
| `@capacitor/local-notifications` | scheduled wash reminders (fire when closed) |
| `@capacitor/filesystem` | JSON backup export/import to `Directory.Documents` |
| `@capacitor/device` | detect Samsung devices |
| `@capacitor/app` | app lifecycle |

## Get the APK without a computer (GitHub Actions)

A workflow at `.github/workflows/android-apk.yml` builds a debug APK in the
cloud and publishes it to a GitHub Release, so you can install it straight from
your phone:

1. On GitHub, open **Actions → Build Android APK → Run workflow** (or just push
   to the feature branch — it runs automatically).
2. When it finishes, open the **`android-latest`** release
   (`.../releases/tag/android-latest`) on your phone and download
   `closet-buddy-debug.apk`.
3. Allow "install unknown apps" for your browser if prompted, then open the APK.

The APK is a debug build (signed with the standard Android debug key) — fine for
installing and testing. For a Play Store / release build, sign it with your own
keystore.

## Build & run on Android (local)

```bash
# 1. Build the web bundle and copy it into dist/, then sync into the native project
bun run cap:sync

# 2. Open Android Studio and run on a device/emulator
bun run cap:open
```

`cap:sync` runs `build:mobile` (`vite build` + `scripts/prepare-mobile.mjs`) and
then `cap sync android`, which also wires the installed Capacitor plugins into
Gradle and copies the web assets into `android/app/src/main/assets/public`.

### webDir / static build

Capacitor loads static assets from `www/` (`webDir` in `capacitor.config.ts`).

`bun run build:mobile` sets `CAP_BUILD=1`, which switches `vite.config.ts` into
**SPA mode** (`tanstackStart.spa.enabled` + `nitro: false`). TanStack Start then
prerenders a client-rendered shell to `dist/client/` (as `_shell.html`).
`scripts/prepare-mobile.mjs` copies `dist/client/` into `www/` and materialises
`www/index.html` from `_shell.html`.

The default (web/Lovable) build is untouched — without `CAP_BUILD` it still
targets Nitro/Cloudflare SSR.

## What was changed in the app

### Notifications — `src/lib/notifications.ts`

The web `Notification` API was replaced with
`@capacitor/local-notifications`. Reminders are now **scheduled** (handed to the
OS `AlarmManager` with `allowWhileIdle`) instead of shown via an in-page API, so
they fire even when the app is backgrounded or fully closed. A dedicated
`wash-reminders` notification channel is created on Android. Permission checks
are async (`getNotificationPermission()` / `requestNotificationPermission()`),
returning `granted | denied | prompt | unsupported`.

### Backups — `src/routes/backup.tsx`

When running natively, exports are written with `@capacitor/filesystem` to
`Directory.Documents` (`src/lib/backup-native.ts`). The import card lists the
`closet-backup-*.json` files found in Documents and restores the selected one.
The browser paths (File System Access API / anchor download / file picker) are
unchanged for the PWA.

### First-launch native init — `src/lib/native-init.ts`

Called from the root route on the client (no-op on web):

1. Requests the **POST_NOTIFICATIONS** runtime permission on first launch
   (Android 13+), via `LocalNotifications.requestPermissions()`.
2. On **Samsung** devices (detected with `@capacitor/device`), asks the user to
   exempt the app from **battery optimization** so background alarms aren't
   killed by "Deep sleep". Backed by the custom native `BatteryOptimization`
   plugin (`src/lib/battery-optimization.ts` +
   `android/app/src/main/java/site/dayspace/closetbuddy/BatteryOptimizationPlugin.java`).
   The prompt is shown at most once.

### Android manifest — `android/app/src/main/AndroidManifest.xml`

Adds `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`,
`RECEIVE_BOOT_COMPLETED`, and `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.

## Regenerating the launcher icon

The launcher icons in `android/app/src/main/res/mipmap-*` are derived from
`public/icon-512.png`. To regenerate them properly sized, use
[`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets) in an
environment with network access to its native image deps:

```bash
mkdir -p resources && cp public/icon-512.png resources/icon.png
npx @capacitor/assets generate --android
```
