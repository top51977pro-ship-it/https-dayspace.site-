# GOLDEN XI — BUILD PROMPT (for the actual game)

Use this as the master build/implementation prompt for the game defined in `GDD.md`.
It describes the real game, how it works, and every feature/option to implement.
It is written so an engineering team **or** an AI code-generation agent can build directly from it.

> **IP rule (non-negotiable):** All players, teams, leagues, kits, and crests are **original and fictional**.
> Do **not** model, name, or recreate real, living footballers or real clubs. Players should look like
> believable, photoreal athletes generated from a parametric character system — not likenesses of specific
> real people. See "Character & Likeness System" below.

---

## 0. ONE-PARAGRAPH BUILD BRIEF

> Build *Golden XI: Ultimate Football*, a free-to-play, landscape, online real-time mobile football game
> for Android and iOS in which players collect original footballer **cards**, assemble an 11-a-side squad with
> a visual **chemistry** system, and compete in 3-minute server-authoritative PvP matches using a left virtual
> joystick and a right-side action cluster (PASS / THROUGH / SHOOT / SPRINT&SKILL), with an optional simplified
> tap-to-play mode. Card OVR (40–99), 6 sub-stats, 1★–5★ tiers and 5 rarities drive both the meta-game
> (collect → build → compete → earn → upgrade) and measurable on-pitch behavior. Ship Ranked Ladder, Cup Run
> brackets, a 6-week live Season with a Star Path pass, and daily quests/training, monetized fairly via Coins
> (soft) + Gems (hard) with disclosed pack odds and pity timers, matched to the art/economy/scope in `GDD.md`.

---

## 1. TECH STACK & ARCHITECTURE (recommended)

- **Engine:** Unity (LTS) with URP, or Unreal 5 (mobile scalability). Target 60 fps mid-tier, 30 fps floor.
- **Client:** landscape only; portrait locked out. Input abstraction layer supporting Advanced + Tap schemes.
- **Netcode:** dedicated **server-authoritative** match simulation; client-side prediction + rollback; tick 30 Hz sim, interpolated render. Target playable at 80–120 ms RTT.
- **Backend:** stateless game services (matchmaking, inventory, economy, live-ops) + authoritative match servers (regional). gRPC/WebSocket for match, REST/GraphQL for meta.
- **Data:** player accounts, card inventory, squads, currencies, ladder/MMR, event state — all server-owned; client is a view. Cloud save + device migration.
- **Live-ops:** remote config for events, drop rates, pity counters, Season content, feature flags, A/B tests.
- **Anti-cheat:** server validates all match outcomes; input-rate sanity checks; encrypted payloads; disconnect/rejoin with authoritative reconciliation.
- **Compliance:** published loot-box odds (store + in-app), pity guarantees, age gate, GDPR/CCPA data controls, spend limits/parental controls.
- **Build size:** < 250 MB initial; streamed asset bundles for stadiums/kits.

---

## 2. CHARACTER & LIKENESS SYSTEM (photoreal, original)

Goal: players that read as real athletes without being real people.

- **Parametric athlete generator:** face rig with sliders (skull, jaw, nose, brow, cheek, eyes, lips, ears),
  skin tone (full range, PBR skin shader with subsurface scattering), hairstyles (50+), facial hair, body
  types (ecto/meso/endo blends), height/weight, tattoos (original art), boots/accessories.
- **Motion:** mocap-quality locomotion — run/sprint, dribble touches, shielding, tackles, shots, headers,
  celebrations; blend trees + IK foot planting; ball physics with per-touch contact.
- **Kits & crests:** procedural kit system (base + pattern + trim + sponsor + number/name print); 6 crest
  shape families × color/emblem combos. All sponsors fictional (Voltaic, Meridian Air, NovaBank, Kestrel).
- **LOD:** hero detail for the ball carrier/close-ups; reduced LOD for distant players; readable silhouettes.
- **Do not:** ingest, reference, or reproduce photos/scans of specific real footballers; no real names/numbers/faces.

---

## 3. MATCH ENGINE (how the game actually plays)

### Match rules
- 11 v 11, one accelerated half; **3:00** default clock, **5:00** tournament finals. Golden-goal ET (1:30) → penalty shootout in knockouts.
- Broadcast dynamic camera behind attacking play; auto-zoom on shots/set-pieces; slow-mo goal replays. Optional fixed "tactical" high angle.

### Advanced controls (default)
- **Left joystick:** 360° movement of active player; directional guide ring; sprint shown when SPRINT held.
- **Right action cluster (contextual):**
  - **PASS** (blue): tap = context ground pass; hold = power; double-tap = give-and-go.
  - **THROUGH** (amber): threaded/lofted through ball into space; hold = weight.
  - **SHOOT** (red-orange): hold = power, joystick angle at release = placement; release inside green **timed-finish** window = accuracy bonus.
  - **SPRINT & SKILL** (green): hold = sprint; flick left stick while holding = skill move (step-over, drag-back, roulette) gated by DRI + traits.
- **Defensive remap:** PASS→Switch Player, THROUGH→Tackle, SHOOT→Slide, SPRINT→Contain/Jockey.
- **Assist settings (toggleable, on for new players):** pass assistance 0–100%, auto-switch nearest defender, shot aim assist. "Manual" input tier available for higher ranked rewards.

### Simplified tap-to-play (optional mode)
- Joystick hidden. Tap teammate = pass there; tap space = through ball into it; tap/swipe at goal = shoot (swipe angle = placement). Movement is AI auto-run-into-space; the human chooses when/where the ball goes. Fully cross-compatible with stick players.

### Simulation & balance
- Player card stats map to real behavior: PAC→top speed/accel, SHO→shot power/accuracy, PAS→pass weight/accuracy, DRI→touch/turn/skill success, DEF→tackle/intercept, PHY→strength/stamina/duels. GK: DIV/HAN/KIC/REF/SPD/POS.
- **Chemistry** applies in-match stat boosts (up to +5 to weakest two stats at 100% squad chem).
- **Difficulty (vs AI):** Amateur→Legendary via AI reaction latency (250→90 ms), press intensity, marking, line aggression — **never** stat cheating.
- **Skill vs squad balance:** matchmaking OVR bracket (§5) + **diminishing squad returns above ~85 OVR**; execution dominates at the top. Target: skilled-underdog win rate ≥ 45% within one OVR bracket.

---

## 4. CARD / COLLECTION SYSTEM

- **Card model:** OVR 40–99 (position-weighted formula), Position (+2 alt positions via training), Star tier 1★–5★, Rarity (Common/Rare/Epic/Legend/Icon), 6 sub-stats, chem tags (League/Club/Nation), 0–3 traits.
- **OVR formula:** per-position weight vectors (e.g. ST = 0.30·SHO+0.20·PAC+0.20·DRI+0.15·PHY+0.10·PAS+0.05·DEF; CB = 0.40·DEF+0.25·PHY+0.15·PAC+0.10·PAS+0.05·DRI+0.05·SHO).
- **Rarities & drop rates:** Common 74% / Rare 20% / Epic 5% / Legend 0.9% / Icon 0.1% (published on every pack).
- **Star-up:** fuse duplicates or Star Shards + Coins (1★→2★: 1 dupe+2k; …; 4★→5★: 6 dupes+60k+1 Elite Shard). ~+2 OVR ceiling/star; trait slots at 3★ & 5★.
- **Training:** spend Training XP to raise sub-stats toward tier ceiling; position retraining tokens unlock alt positions.
- **Traits:** e.g. Finesse Finisher, Engine, Wall, Long Passer, Poacher, Aerial, Playmaker, Speedster — each with a concrete gameplay modifier.
- **Manager cards (12):** formation-wide passives + own chem alignment.

---

## 5. GAME MODES (implement all four for v1)

1. **Ranked Ladder (core):** real-time 1v1; match by squad-OVR bracket (±3, widening after 20s) + hidden MMR. Divisions Wood→Legend (top-500). Win = 300–900 Coins (division-scaled) + ladder points; soft demotion protection. **Weekend Clash** Fri–Sun run with tiered rewards.
2. **Cup Run:** 8-player single-elim bracket (bot-fill), 4 rounds, entry = Cup Ticket; escalating rewards; champion gets Epic+ pick + kit + Gems. Monthly 64-slot **Golden XI Cup** with Icon chase.
3. **Live Season (6 weeks):** themed event track (2–4-day mini-events), live objectives board (Season Points), **Star Path** pass (free + premium, 40 tiers), featured limited player program (retires at Season end).
4. **Daily quests & training:** 3 daily + 5 weekly quests; single-player training drills (timed-finish, dribble gauntlet, pass accuracy) — no energy walls, daily reward caps; 28-day login calendar.

Shared **Club Level** account XP unlocks features (market Lvl 5, tournaments Lvl 8, Manual ranked Lvl 12) + milestone packs.

---

## 6. UI / UX (screens to build)

- **Persistent bottom nav:** `HOME · SQUAD · PLAY · STORE · CLUB`. Currencies top-right, profile/level top-left, mailbox + settings top-right.
- **Home hub:** animated hero tile (current Season event) + scrollable rail of tappable event tiles with live status badges (timers, claimable dots, progress rings) + big "Play Now" CTA.
- **Squad builder:** pitch with 11 slots + subs drawer; drag-drop cards; **chemistry links rendered as colored lines** (green/yellow/red); left panel = Squad OVR / Chem x/33 / formation / manager / tactic; right drawer = searchable filterable collection + "Auto-Fill best chem" & "Suggest upgrade"; card detail view with train/rank-up/sell.
- **In-match HUD (match reference layout):** top-left scoreboard (crests, score, clock, speed control); bottom-left joystick + guide ring; bottom-right 4 action buttons (color-coded, contextual labels); bottom-center radar/minimap (22 players + ball, active highlighted, pass-target chevron); floating name tags; shot-power arc; timed-finish bar.
- **Post-match:** MOTM, stat recap, reward reveal with rarity-tiered pack-open animation.
- **Onboarding:** scripted "score in 60s" tutorial with coach-marks → free Starter Pack (~75 OVR squad) → squad-builder walkthrough → first Ranked placement. Target: install→first PvP win < 8 min.

### Options / settings menu (implement)
- Controls: Advanced ↔ Tap mode; assist sliders (pass/aim); auto-switch on/off; button layout & size; left/right-hand mirror; haptics.
- Graphics: quality (Low/Med/High/Ultra), frame cap (30/60), dynamic resolution, battery saver.
- Audio: master/commentary/crowd/SFX/music sliders; commentary language.
- Camera: Broadcast / Tactical; zoom; replay auto-play on/off.
- Account: link (Apple/Google/email), cloud save, device migration, region, language.
- Notifications: quests, event timers, energy-free reminders, ladder resets.
- Accessibility: colorblind palettes, larger text, reduced motion, one-hand mode.
- Privacy/safety: spend limits, parental controls, data export/delete, published pack odds link.

---

## 7. ECONOMY & MONETIZATION (implement rules exactly)

- **Currencies:** Coins (soft, freely earned), Gems (hard, purchasable + trickle ~30–40/day free), Season Points (event-scoped, non-purchasable).
- **Earn sources (free/day target):** ~9,000–13,000 Coins + ~30–40 Gems from daily/weekly quests, PvP wins, login, events.
- **Packs (randomized, disclosed odds + pity):** Coin packs (Bronze 500 / Silver 2,500 / Gold 12,500); Gem packs (Prime 100 / Legend-boosted 300 / event); **hard pity** guarantees Legend+ by pack N (e.g. 30).
- **Products:** Season Pass "Star Path" (~$9.99, 40 tiers, guaranteed high-OVR non-Icon at 40); Gem bundles $0.99–$99.99 with first-purchase/weekly bonuses; premium/event packs; **cosmetics only** paid-power-free (kits/crests/celebrations/stadium themes/MOTM cards); Coin/XP boosters (time-savers only).
- **Player market:** list/buy specific cards, sell dupes for Coins (listing fee sink); converts time → targeted power without gambling.
- **Fairness guardrails:** OVR matchmaking bracket, diminishing returns >85 OVR, every featured card/kit free-earnable, published odds + pity on all randomized packs, no energy paywalls, no untrainable pay-to-win stat.

---

## 8. ART & AUDIO (direction to implement)

- **Style:** grounded stylized realism, readable at phone size; PBR materials; bold high-contrast fictional kits/crests.
- **Palette:** turf greens #3FA34D→#2E7D32; UI charcoal #141A1E; brand gold #F5C518; action colors Pass #2F80ED, Through #E0A400, Shoot #E4572E, Sprint/Skill #27AE60; rarity frames bronze/silver/gold/prismatic/animated-gold.
- **Stadiums (4 at launch, 6–8 later):** day/dusk/floodlit; animated crowds, tifos, pyro on goals, fictional ad boards.
- **Camera:** dynamic broadcast + optional tactical; punch-in on shots/set-pieces/goals; slow-mo replays.
- **Audio:** two-voice fictional commentary (event-driven, intensity layering), adaptive crowd bed, weighty ball/net/whistle SFX, rarity-tiered pack-open stingers, electronic-orchestral menu music that ducks under commentary.

---

## 9. FIRST RELEASE (v1 MVP) — BUILD THIS FIRST

Ship: landscape 11v11 3-min matches (server-authoritative), Advanced + Tap controls, timed finishing + core skills + contextual defending, 3 formations (4-3-3, 4-4-2, 4-2-3-1) + 3 tactics; ~300 original cards across 5 rarities / 8 leagues / ~48 clubs / ~24 nations; OVR + 6 stats + 1★–5★ + chemistry + ~8 traits + 12 managers; training/rank-up/retraining; Ranked Ladder + Weekend Clash; Cup Run; one 6-week Season + Star Path + featured program; daily/weekly quests + training drills + login calendar; Coins/Gems/Season Points + packs (odds+pity) + Season Pass + Gem bundles + cosmetic store + basic player market; Club Level + onboarding + Starter Pack; 4 stadiums (day/night) + broadcast camera + English commentary + full hub/squad/HUD UI + adaptive crowd; matchmaking (OVR bracket + MMR) + anti-cheat + disconnect handling + cloud save + published-odds compliance.

**Deferred (post-launch):** 2v2 co-op, friends/rivals + private matches, Guilds; more stadiums/kits/formations + 2nd commentary language; Draft mode, Squad Battles vs AI, Manual esports ladder + replays/spectate; manual set-piece mini-games, custom tournaments, clip tools, expanded Icon programs. New 6-week Season each cycle.

---

## 10. ACCEPTANCE CRITERIA (definition of done for v1)

- [ ] Install → first PvP win reachable in < 8 minutes via onboarding.
- [ ] 3-min match runs server-authoritative at 60 fps mid-tier, playable at 100 ms RTT.
- [ ] Both control schemes shippable and cross-compatible in one match.
- [ ] Card OVR/stat changes from training/rank-up/chem produce **measurable** in-match behavior changes.
- [ ] Matchmaking keeps 90%+ of ranked matches within a ±3 OVR bracket; skilled-underdog win rate ≥ 45% in-bracket.
- [ ] All randomized packs show correct published odds + honor pity guarantees server-side.
- [ ] Every featured card/kit has a verified free-earn path.
- [ ] No real player/club/league/kit likeness anywhere in content or assets.
- [ ] Full settings menu (§6) functional; cloud save + account migration verified.

---

*See `GDD.md` in this package for the full design rationale, example stat blocks, numbers, and content bible.*
*See `reference_images/` for the UX/HUD and gameplay framing this build targets (used as visual reference only).*
