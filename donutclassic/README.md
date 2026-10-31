# DonutClassic

A private, original Paper plugin that recreates classic (pre-June-2026) DonutSMP-style survival for **Java and Bedrock players
on the same server** (through Geyser + Floodgate). It's one modular jar with no required dependencies.

**Status and honesty notes**
- The jar is compiled against the real Paper API in GitHub Actions and smoke-tested on real Paper servers there.
  The PaperMC repository is blocked in the development sandbox, so the jar in `dist/` is the one CI produced and verified.
- No map is included. The spawn and AFK area are community schematics by eliterorr (see MAP_SETUP.md).
- Values that aren't documented are marked **APPROX** (see HISTORICAL_ACCURACY.md).
- Nothing can be bought with real money. Keys, ranks and spawners are earned in-game or given by admins.

## Features
| Module | What it covers |
|---|---|
| Virtual stacked spawners | 8 classic types (Zombie optional). No mobs spawn. Storage with a GUI: withdraw, collect all, sell all, XP, Add Stack button for Bedrock. Diminishing-returns curve, `/dc spawner benchmark`. Only produces near players. Silk Touch mining with sneak-to-take-one. Explosion and piston proof. Audit log, batched SQLite saves. |
| Shards / AFK | Separate Shards balance. AFK region pays 1 shard per complete minute. +10 per player kill with anti-farm checks. ×4 booster. `/shardshop` driven by presets. |
| Crates | 5 crates with virtual keys. 7 candidates, pick 1. Refund on close or crash. Hourly keyall that survives restarts. World crate blocks. |
| Economy | `/bal /baltop /pay /shop /sell /sellall /sellhistory /worth`, sell multipliers, mailbox `/claim`. |
| Auction House | `/ah`: escrow, search, sort, 25 slots (preset), expiry → mailbox, tax, spawners blocked. |
| Orders | `/orders`: escrowed buy orders, partial fills, cancel refunds. |
| Teams | create/invite/join/leave/kick/disband/home/sethome/chat/transfer/promote/ff, max 50. |
| Teleport | `/spawn /afk /warp /rtp` (3 dimensions, safe spots), homes (2 by default), `/tpa…`, `/back`, 5 s warm-up. |
| Duels / PvP | Requests + queue (win rate + armour), arenas, inventory snapshots with crash recovery, combat tag, combat logging. |
| Tools | Shard Pickaxe/Shovel 3×3, Shard Axe tree-feller, Amethyst Bucket. All respect protections. |
| Presentation | Vanilla sidebar (works through Geyser), `/stats /playtime /top /settings`, free ranks with prefixes, chat anti-spam, `/rules /help /report`, announcements, NPCs, hologram leaderboards. |
| Admin | `/dc help`: bindings, give/take, presets, reload, backup, setup wizard, status. |

## Build
```
./gradlew :core:test :plugin:dist     # needs repo.papermc.io; output: dist/DonutClassic.jar
scripts/smoke-test.sh paper.jar dist/DonutClassic.jar
```

## Compatibility
| Component | Version |
|---|---|
| Paper | 1.20.1 up to 26.3 (CI smoke-tests 1.20.1, 1.20.4, 1.20.6, 1.21.1, 1.21.4 and the newest) |
| Java | 17 for 1.20.1-1.20.4, 21 for 1.20.5-1.21.x, 25 for Paper 26.x |
| Geyser / Floodgate | latest from exaroton or geysermc.org, matched to your Paper version |
| Optional | FastAsyncWorldEdit/WorldEdit (map import), WorldGuard |

Docs: EXAROTON_INSTALL.md · MAP_SETUP.md · HISTORICAL_ACCURACY.md · AUTOMATED_TESTS.md · MANUAL_TEST_CHECKLIST.md
