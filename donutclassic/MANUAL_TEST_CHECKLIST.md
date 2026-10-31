# Manual test checklist (one Java client + one Bedrock client)

Use OP accounts J (Java) and B (Bedrock via Geyser). Tick each item.

## Boot
- [ ] Console: `DonutClassic enabled (preset classic-early, 15 modules)`, with no stack traces. `/dc status` shows Floodgate detected.
- [ ] J and B both join and see the same spawn build.

## Spawners (top priority)
- [ ] `/dc spawner give J SKELETON 3`. Place 2 separate blocks. Each opens its own GUI (right-click / tap).
- [ ] J: sneak + right-click a spawner with the 3rd in hand → "Stack is now 2". B: tap **Add Stack** in the GUI → works.
- [ ] Stand nearby for 1+ minute → the GUI shows Bones **and** Arrows. Walk >64 blocks away → **PAUSED**.
- [ ] **Sell All** → money goes up; storage empties; `/sellhistory` shows it.
- [ ] Mining without Silk Touch is refused. With Silk Touch → you get 2 spawner items plus the stored items, and nothing duplicates.
- [ ] Sneak-mining a stack of 2 removes exactly 1.
- [ ] Restart → `/dc spawner inspect` shows the same stack, storage and audit log.
- [ ] J and B click **Collect All** on the same spawner at the same moment → the total collected equals what was stored (no duplication).
- [ ] `/dc spawner benchmark` lists outputs for stacks of 1, 10, 64, 100 and 1000.

## Shards / AFK
- [ ] `/afk` (5 s warm-up). Inside the AFK region, +1 Shard after each full minute. Leaving at 0:59 gives nothing.
- [ ] Kill the other player outside spawn → +10 Shards. A second kill within 10 min gives none.
- [ ] `/shardshop` → buy a Skeleton Spawner for 1,500 Shards.

## Crates
- [ ] `/dc key give J gold 1` → `/crates` → Gold → 7 spawner choices → pick one → you receive it.
- [ ] Open a crate and close it without picking → the key is refunded. Disconnect mid-choice → refunded on rejoin.
- [ ] Wait for keyall (or `/dc keyall`) → both J and B get 1 Common key. Restarting doesn't fire it again early.

## Economy
- [ ] `/pay`, `/bal`, `/baltop` between J and B. `/pay` with a negative amount or `1e99` is rejected.
- [ ] `/shop` buy buttons (B uses touch). `/sell` menu: put in a renamed item plus cobblestone → the cobblestone sells and the renamed item comes back.
- [ ] `/ah sell 100` → B buys it. J and B buying the same listing at once → only one succeeds. Expiry/cancel → `/ah claim`.
- [ ] Listing a spawner on the AH is refused.
- [ ] `/orders create diamond 10 100` → B fills it partially → J claims → J cancels → escrow refunded.
- [ ] Buying with a full inventory → the overflow goes to `/claim`.

## Teams / teleport / duels / tools / UI
- [ ] `/team create`, invite, join, sethome, home (warm-up), chat, friendly fire off, transfer, disband.
- [ ] `/sethome` ×2, a 3rd is refused. `/home` moving during the warm-up → cancelled. `/tpa` + `/tpaccept`.
- [ ] `/rtp` overworld, nether and end → you land on safe ground, in the nether below the roof.
- [ ] `/duel B` → accept → fight → loser respawns with all items restored. Logging out mid-duel restores items on rejoin.
- [ ] Hitting a player outside spawn tags you in combat. `/spawn` is blocked while tagged. Logging out while tagged → you die.
- [ ] Shard Pickaxe mines 3×3, but not inside spawn. Shard Axe fells a tree. Amethyst Bucket drains water.
- [ ] The scoreboard shows on Java and Bedrock. `/settings` toggles it. `/stats`, `/top kills`.
