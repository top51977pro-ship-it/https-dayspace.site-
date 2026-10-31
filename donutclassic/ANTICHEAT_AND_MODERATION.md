# Anticheat, anti-xray and moderation

## Moderation (in DonutClassic)
`/ban <player> [30m|7d|perm] [reason]`, `/tempban`, `/ipban`, `/unban`, `/mute`, `/unmute`, `/kick`, `/warn`,
`/history <player>`, `/banlist`. Each also has a `dc` alias (`dcban`, `dcunban`, …), which the phone app uses.
Everything is stored in SQLite with who did it and when. Bans are checked on Paper's async login thread.
Permissions are `dc.mod.*` (OP by default).

## Anti-xray
Real anti-xray hides ores from the client. Paper has a built-in engine-mode anti-xray; DonutClassic switches it
on automatically (`anticheat.antixray.auto-configure`), or you can run `/dc antixray`. Restart once afterwards.
DonutClassic also flags x-ray **behaviour**: too many diamonds or ancient debris compared with stone mined in 20 minutes.

## Anticheat checks
Fly, Speed, Reach, KillAura (hit angle), AutoClicker (CPS), FastBreak/Nuker, and Xray ratio.
- Violations decay over time. Staff get alerts in chat and in the app, players get set back, and players are kicked at high VL.
- **Nothing is banned automatically.** Review alerts and ban yourself.
- Bedrock (Geyser) players get relaxed limits, because their movement is translated and not 1:1 with Java.
- Thresholds are in `config.yml → anticheat.checks`.

These checks are deliberately simple and conservative. They catch obvious cheats (fly, speed, long reach,
autoclickers, nukers, x-ray) with few false positives, but they are **not** a match for a dedicated anticheat
against advanced clients. For stronger protection, add a maintained anticheat (for example Grim, which supports
Geyser/Floodgate) alongside this. If both run, you can switch off DonutClassic's movement checks
(`fly`/`speed`).

Not tested with real cheat clients. Tune the thresholds on your own server.
