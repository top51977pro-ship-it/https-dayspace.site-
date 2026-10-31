# DonutClassic Panel (Android)

A phone app to manage the server: see who is online, ban, unban, mute and kick, view the ban history, AH prices,
buy orders and anticheat alerts, and send console commands.

**How it connects (no extra ports):** exaroton doesn't let plugins open web ports, so the app uses
**exaroton's official API** with your API key:
- It reads `plugins/DonutClassic/panel/*.json` (written by the plugin every 30 s, and immediately after actions).
- It sends commands such as `dcban Steve 7d reason` or `dcunban Steve` to the console.

**Install**
1. Download `DonutClassicPanel.apk` from the GitHub release **"DonutClassic Panel - latest APK"**
   (tag `donutclassic-panel-latest`) and install it. Android will ask you to allow "unknown apps".
2. In exaroton → Account → **API**, create an API key.
3. Open the app, paste the key, tap **Load my servers**, and pick your server.

Your key is stored only on your phone. It can control your whole exaroton account, so keep it private.

Built with GitHub Actions (`.github/workflows/donutclassic-panel.yml`). The UI is `android/app/src/main/assets/www/`.
