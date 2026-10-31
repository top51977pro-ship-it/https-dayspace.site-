# Map setup: normal (non-winter) spawn and AFK area

The plugin jar **does not contain any map**. The spawn and AFK buildings are a separate asset that you import.

## Credits (required)
- **DonutSMP Spawn 1:1** by **eliterorr**, 17 Jan 2026, normal spawn (not the December 2025 Christmas one):
  https://www.planetminecraft.com/project/donutsmp-spawn-1-1-made-by-eliterorr-free-schematic-download/
- **DonutSMP AFK Area 1:1 (remade)** by **eliterorr**:
  https://www.planetminecraft.com/project/donutsmp-afk-area-1-1-remade-made-by-eliterorr-free-schematic-download/

Download them yourself from PlanetMinecraft and follow the creator's reuse terms on those pages. The listing
says "No Map, Just Schematic", so you get `.schem` files, not a world. They were not downloaded or redistributed here.

## Option A: paste on the server (WorldEdit or FastAsyncWorldEdit)
1. Install **FastAsyncWorldEdit** (recommended for large pastes, it doesn't freeze the main thread) or WorldEdit.
2. Upload the `.schem` files to `plugins/FastAsyncWorldEdit/schematics/` (or `plugins/WorldEdit/schematics/`).
3. Go to an empty, flat area (for example a void or flat world) **while no other players are online**.
4. Run `//schem load <file>`, then `//paste -a` (`-a` skips air). Wait for FAWE to finish.
5. Paste the AFK area somewhere separate the same way.

## Option B: build the world offline, then upload it
1. On your PC, run a local Paper server (or single-player with WorldEdit) and paste the schematics.
2. Stop it and zip the world folder. The ZIP must contain `level.dat` and `region/`.
3. Upload it to exaroton under **Worlds** (see EXAROTON_INSTALL.md).

## Bind positions in-game (as OP)
Stand where it applies, then run:
| What | Command |
|---|---|
| Spawn point | `/dc setspawn` |
| Spawn protection corners (stand at 2 opposite corners) | `/dc setspawncorner1`, `/dc setspawncorner2` |
| AFK teleport point | `/dc setafk` |
| AFK reward region corners | `/dc setafkcorner1`, `/dc setafkcorner2` |
| Crates (look at each crate block) | `/dc setcrate common` … `prime`, `gold`, `amethyst`, `crimson` |
| Warps | `/dc setwarp crates`, `/dc setwarp shop`, … |
| NPCs (spawns a villager where you stand) | `/dc setnpc shop`, `shardshop`, `crates`, `rtp`, `duels`, `afk`, `ah`, `orders` |
| Leaderboard holograms | `/dc leaderboard money` (or `shards`, `kills`, `playtime`) |
| Duel arena spawns | `/dc duel setarena arena1 1` and `/dc duel setarena arena1 2` |

Run `/dc setupwizard` to see what's still missing. Positions are saved in `warps.yml` by world UUID. If a
world is deleted, spawn falls back to the main world's spawn.

Java and Bedrock players see the same blocks. Holograms are armour-stand name tags, which Geyser shows. Signs work as a fallback.
