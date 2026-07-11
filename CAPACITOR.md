# Android (Capacitor) wrapper

This TanStack Start app is wrapped with [Capacitor](https://capacitorjs.com/) so
it can ship as a native Android app. All data stays local (Dexie/IndexedDB), so
the app runs entirely client-side inside the WebView.

- **App id:** `site.dayspace.closetbuddy`
- **App name:** `הארון שלי`
- **Launcher icon:** generated from `public/icon-512.png`

## Prerequisites

- Node 20+ and [Bun](https://bun.sh/)
- Android Studio + Android SDK (Platform 34+), JDK 17

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

## Build & run on Android

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

Capacitor loads static assets from `dist/` (`webDir` in `capacitor.config.ts`).
`scripts/prepare-mobile.mjs` copies the TanStack Start / Nitro client output
(`.output/public`, falling back to `dist`) into `dist/` and verifies an
`index.html` entry exists. If your build target does not emit a static SPA
shell, enable SPA output for the mobile build in `vite.config.ts`, e.g.:

```ts
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    spa: { enabled: true }, // prerender a static shell for the native WebView
  },
});
```

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
