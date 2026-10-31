# Historical accuracy

Target: classic (pre-2 June 2026) DonutSMP-style gameplay. This is a private, original re-implementation — no
DonutSMP code, files or branding. Labels used in configs and below:

- **DOCUMENTED** — stated by a community wiki listed below (not by the server owners themselves).
- **APPROX** — a configurable default chosen here because no reliable public value exists.
- **OPTIONAL** — an extra that's off by default.

Sources were not re-fetched while building this; the facts below come from the project brief that cites
them. Re-check them before treating anything as official.

| Feature | Value used | Status | Source |
|---|---|---|---|
| Spawners don't spawn mobs; drops build up virtually | Yes | DOCUMENTED | donutsmp.fandom.com/wiki/Spawner |
| Eight classic spawner types | Skeleton, Iron Golem, Creeper, Spider, Zombified Piglin, Blaze, Cow, Pig | DOCUMENTED | Fandom Spawner |
| Skeleton gives bones **and** arrows; Spider gives string **and** spider eyes | Yes | DOCUMENTED | Fandom Spawner |
| Blaze gives blaze **powder** (not rods); Cow gives beef (no leather) | Yes | DOCUMENTED | Fandom Spawner |
| Zombie spawner | Present but `enabled: false` | OPTIONAL | later third-party docs only |
| Stacking has diminishing returns | `stack^0.85` (or a table you edit) | Behaviour DOCUMENTED, formula APPROX | Fandom Spawner |
| Drop rates per minute, XP rates, storage size | see spawners.yml | APPROX | — |
| Spawner costs 1,500 Shards in the Shard Shop | 1,500 | DOCUMENTED (price as of 26 Feb 2026) | brief / donutsmp.wiki/spawners |
| Spawners kept off the Auction House | `auction.allow-spawners: false` | DOCUMENTED | Fandom |
| AFK zone pays 1 Shard per full minute | 60 s → 1 shard | DOCUMENTED | donutsmp.wiki/afk-zone |
| +10 Shards per player kill | 10 | DOCUMENTED | brief |
| Kill cooldown per victim, same-IP block | 600 s, on | APPROX (anti-exploit) | — |
| AFK booster ×4 | multiplier 4; duration per item | multiplier from brief, duration APPROX | — |
| Five crates: Common, Prime, Gold, Amethyst, Crimson | Yes | DOCUMENTED | donutsmp.wiki/crate-keys |
| Keys are virtual | Ledger balance, no items | DOCUMENTED | crate-keys |
| Opening shows 7 rewards; you pick 1 | 7 | DOCUMENTED | crate-keys |
| Reward themes (Common diamond, Prime netherite/mace/crossbow, Gold spawner, Amethyst unique items, Crimson netherite) | as themes | Themes DOCUMENTED; exact lists and weights APPROX | crate-keys |
| Hourly keyall (1 Common key to everyone online) | 60 min | DOCUMENTED | crate-keys |
| 26 Feb 2026: Prime 2,000, Crimson 2,500; Gold and Amethyst keys removed from the shop | `feb-2026` preset | DOCUMENTED | crate-keys |
| Key prices before Feb 2026, Common key price, booster price | see `classic-early` preset | APPROX | — |
| Teams: listed commands, max 50 members | 50 | DOCUMENTED | Fandom Teams |
| Duel queue matches on win rate + armour | weighted rating, widening gap | Idea DOCUMENTED, algorithm APPROX | Fandom Duels |
| 5-second warm-up for RTP and homes (instant only after late June 2026) | 5 s | DOCUMENTED | June 2nd update page |
| 2 homes by default | 2 | DOCUMENTED | brief |
| 25 AH listing slots (18 after June 2026) | 25 (post-2026 preset: 18) | DOCUMENTED | brief |
| Shard Pickaxe 3×3, Shard Axe tree-feller, Shard Shovel 3×3, Amethyst Bucket | Implemented | Items DOCUMENTED; radius, cooldown, enchants APPROX | brief |
| World border: overworld 225,000, nether 57,000, end 175,000 blocks wide | config `world-border` | UNVERIFIED (owner-supplied AI answer; no official source found; changes with expansions) | — |
| Shop and sell prices, sell-multiplier tiers, AH duration and tax, RTP radius | config | APPROX | — |
| Spawn and AFK map | community 1:1 schematic by eliterorr (not included) | Fan recreation, not official | PlanetMinecraft |

## Known gaps and disagreements
- Later docs (donutsmp.wiki/spawners) describe other drops and ways to get spawners. The classic Fandom list was
  used, and nothing was silently swapped in.
- There's no public source for exact drop rates, the stacking formula, reward weights or the old key prices.
  They're all editable.
- Remake plugins made by other people were **not** treated as evidence of original behaviour.
