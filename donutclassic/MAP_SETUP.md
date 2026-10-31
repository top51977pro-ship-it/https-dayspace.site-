# Map setup: normal (non-winter) spawn and AFK area

The plugin jar **does not contain any map**. The spawn and AFK buildings are a separate asset that you import.

## Credits (required)
- **DonutSMP Spawn 1:1** by **eliterorr**, 17 Jan 2026, normal spawn (not the December 2025 Christmas one):
  https://www.planetminecraft.com/project/donutsmp-spawn-1-1-made-by-eliterorr-free-schematic-download/
- **DonutSMP AFK Area 1:1 (remade)** by **eliterorr**:
  https://www.planetminecraft.com/project/donutsmp-afk-area-1-1-remade-made-by-eliterorr-free-schematic-download/

Download them yourself from PlanetMinecraft and follow the creator's reuse terms on those pages. You get schematic files, not a world.

## Recommended: paste the .litematic files with DonutClassic (no WorldEdit needed)
The community files are **Litematica** schematics (`.litematic`, Minecraft 1.21.5 data). DonutClassic reads them directly:

1. Upload both files to `plugins/DonutClassic/maps/` on the server (exaroton → Files).
   They are **not** included in this repository, which is public, out of respect for the creator's work.
2. With nobody else online, run from the console or as OP:
   ```
   /dc map paste DonutSMP_spawn_by-eliterorr spawn
   /dc map paste donutsmp_afk_area spawn 1000 0 0
   ```
   - This creates an empty **void world called `spawn`**, which loads automatically on every restart. Your
     survival world and RTP stay untouched.
   - The spawn is about 19.8 million blocks and pastes in batches (`worlds.paste-ms-per-tick`), so the server
     stays responsive. Check progress with `/dc map status`.
   - Signs, player heads, chest contents, the armour-stand holograms and the text displays are all restored.
3. `/dc map tp DonutSMP_spawn_by-eliterorr` → stand where players should appear → `/dc setspawn`.
4. `/dc map region DonutSMP_spawn_by-eliterorr spawn` (protection) and `/dc map region donutsmp_afk_area afk`
   (AFK rewards). `/dc map tp donutsmp_afk_area` → `/dc setafk`.
5. The pasted holograms are **static text** copied from the original (for example "4843 Players"). Remove them with
   `/dc map clearholograms <name>` if you like, and add live ones with `/dc leaderboard money` etc.

Tested: the reader is unit-tested against both real files (sizes, 19,760,080 / 55,803 non-air blocks, signs,
heads, entities). Pasting runs on a real Paper server in CI using a small generated test map. The full-size
paste of your files hasn't been run on a live server yet.

## Alternative: WorldEdit / FAWE or an offline world
Convert the `.litematic` to `.schem` (for example with Litematica in single-player, or an online converter), then
`//schem load` + `//paste -a` with FastAsyncWorldEdit. Or build the world locally and upload a ZIP containing
`level.dat` + `region/` under exaroton → Worlds.

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
