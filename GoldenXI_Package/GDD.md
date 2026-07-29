# GOLDEN XI — Game Design Document

**Working title:** *Golden XI: Ultimate Football*
**Genre:** Free-to-play mobile football (soccer) — squad-collection / Ultimate Team style
**Document version:** 1.0 (v1 MVP scope)
**Owner:** Game Design
**Status:** Pre-production baseline

> All teams, players, leagues, kits, crests, and competitions in this document are original and fictional. No real or licensed IP is used.

---

## 1. CONCEPT & PILLARS

### Vision statement
*Golden XI* is a real-time competitive football game for mobile where players collect a deck of footballer cards, assemble an eleven, and take that squad into fast three-to-five-minute PvP matches controlled with an intuitive touch scheme. The fantasy is **"my club, my legends, my way to win"** — every card you pull, train, and slot into your formation visibly changes how your team plays on the pitch, and every match is short enough to fit a bus ride but skill-expressive enough to reward mastery. We blend the dopamine of card collection with the moment-to-moment tension of live matches, so the meta-game (building the best XI) and the micro-game (winning the match in your hands) constantly feed each other.

### Design pillars
1. **Readable in 3 minutes, deep for 300 hours.** Anyone can pick up the joystick-and-buttons scheme and score in their first match; the ceiling — skill moves, timed finishing, formation counters, chemistry building — takes months to master. Depth is opt-in, never a wall.
2. **Your squad is felt, not just displayed.** A higher-rated card, a trained trait, a chemistry link — each produces a measurable, visible change in on-pitch behavior (pass weight, sprint speed, shot power). Collection progress is never cosmetic-only.
3. **Fair by default, generous to the patient.** A free player who plays daily can reach competitive squad strength through play alone. Spending accelerates and personalizes; it never buys a wall that a skilled free player cannot climb. Matchmaking and a squad-rating cap keep contests honest.

### Target audience
- **Primary:** 16–34, mobile-first sports and card-collector fans; existing players of Ultimate Team–style modes and gacha collectors who want short competitive sessions.
- **Secondary:** Lapsed console football fans who want a pocket version; hyper-competitive esports-adjacent players chasing leaderboards.
- **Session profile:** 6–12 minute sessions, 3–5 sessions/day; one "collection check-in" morning session, one or two "competitive" evening sessions.

### Platform & presentation
- **Platforms:** Android (API 26+/Android 8.0+) and iOS (iOS 15+). Target 60 fps on mid-tier hardware (e.g. Snapdragon 7-series / A13-class), 30 fps floor on low-end.
- **Orientation:** **Landscape**, held horizontally (matches the reference framing) for both menus and matches — maximizes pitch visibility and gives room for the twin-stick-style HUD.
- **Connectivity:** Online-first. PvP is server-authoritative real-time; menus and squad-building work offline and sync on reconnect.
- **Build budget target:** < 250 MB initial download, streamed asset packs for stadiums/kits thereafter.

---

## 2. CORE META-LOOP

### The cycle
```
   COLLECT ──▶ BUILD SQUAD ──▶ COMPETE ──▶ EARN ──▶ UPGRADE ──▶ (COLLECT)
   packs,      formation,       PvP,        coins,   train cards,
   rewards,    chemistry,       events,     gems,    rank up,
   market      tactics          tourneys    packs    boost OVR
```

1. **Collect** — Acquire player cards from packs, event rewards, quest payouts, and the player market.
2. **Build squad** — Slot 11 starters + 7 subs into a formation, optimize **chemistry links**, set tactics.
3. **Compete** — Take the squad into real-time PvP, tournaments, and seasonal events.
4. **Earn** — Wins and objectives pay out **Coins** (soft currency), occasional **Gems** (hard currency), pack tokens, and training materials.
5. **Upgrade** — Spend earnings to train cards (raise stats), rank cards up (tier promotion), and improve overall squad OVR.
6. Loop back to Collect with a stronger, deeper squad and higher ambitions.

Each loop iteration should take a lapsed-casual ~1 day and a grinder ~1–2 hours to feel a meaningful squad improvement.

### Player cards — the core collectible

Every footballer is a **card** defined by:

| Attribute | Definition |
|---|---|
| **OVR** | Overall rating, 40–99. Weighted blend of the six sub-stats, weighted by position. The headline number. |
| **Position** | Primary position (e.g. ST, CM, CB, GK) + up to 2 alternate positions unlocked via training. |
| **Star tier** | 1★–5★ upgrade tier of *this copy* of the card (see Progression). Raises stat ceiling. |
| **Rarity** | Card class / print run — determines base stat range, art frame, and drop rate. |
| **Six sub-stats** | PAC (Pace), SHO (Shooting), PAS (Passing), DRI (Dribbling), DEF (Defending), PHY (Physical). GKs use DIV, HAN, KIC, REF, SPD, POS. |
| **Chemistry tags** | League, Club, and Nation (all fictional) used for chemistry links. |
| **Traits** | 0–3 special traits (e.g. *Finesse Finisher*, *Wall*, *Engine*) that alter behavior. |

**OVR formula (example, per-position weights).** For an ST:
`OVR = round(0.30·SHO + 0.20·PAC + 0.20·DRI + 0.15·PHY + 0.10·PAS + 0.05·DEF)`
For a CB:
`OVR = round(0.40·DEF + 0.25·PHY + 0.15·PAC + 0.10·PAS + 0.05·DRI + 0.05·SHO)`
Each position ships with its own weight vector; the same raw stats yield a different OVR by role, so a card's headline number reflects its fit.

**Rarities & drop rates** (from a standard pack):

| Rarity | Frame color | Base OVR range | Base drop rate | Notes |
|---|---|---|---|---|
| Common (Bronze) | Bronze | 40–64 | 74% | Squad filler, fodder for training |
| Rare (Silver) | Silver | 65–74 | 20% | Early-game starters |
| Epic (Gold) | Gold | 75–84 | 5% | Mid-game core |
| Legend (Prismatic) | Purple-teal shift | 85–92 | 0.9% | Meta anchors |
| Icon (Signature) | Animated gold | 90–99 | 0.1% | Chase cards, event-gated |

**Star tiers** raise a card's usable stat ceiling by roughly +2 OVR per star (1★ base → 5★ +8 OVR max), gated by training materials and duplicate fodder. A 5★ Rare can rival a 1★ Epic — copies matter, not just pulls.

#### Example card stat blocks (all fictional)

**Card A — chase forward**
```
┌─────────────────────────────────────────┐
│  ICON ✦  "MARCELO VIEIRA-STYLE?" — NO.   │
│  DIEGO "EL COMETA" SALAZAR                │
│  Position: ST  (alt: LW)     Tier: 3★    │
│  Rarity: Legend              OVR: 89      │
│  League: Estrella Prime  Club: Rayo Azul  │
│  Nation: Costa Verde                      │
│                                           │
│  PAC 94   SHO 90   PAS 78                 │
│  DRI 88   DEF 34   PHY 79                 │
│  Traits: Finesse Finisher · Engine        │
└─────────────────────────────────────────┘
```

**Card B — mid-game midfield engine**
```
┌─────────────────────────────────────────┐
│  EPIC ★  KWAME OSEI                       │
│  Position: CM (alt: CDM, CAM) Tier: 2★   │
│  Rarity: Epic                OVR: 81      │
│  League: Northern Union  Club: Ironside FC│
│  Nation: Ashanti Republic                 │
│                                           │
│  PAC 72   SHO 70   PAS 84                 │
│  DRI 80   DEF 78   PHY 83                 │
│  Traits: Long Passer                      │
└─────────────────────────────────────────┘
```

**Card C — starter goalkeeper**
```
┌─────────────────────────────────────────┐
│  RARE  LUKA HORVAT                        │
│  Position: GK                Tier: 1★     │
│  Rarity: Rare                OVR: 71      │
│  League: Adriatic Cup  Club: Sokol Split  │
│  Nation: Dalmatia                         │
│                                           │
│  DIV 70   HAN 72   KIC 68                 │
│  REF 73   SPD 55   POS 71                 │
│  Traits: —                                │
└─────────────────────────────────────────┘
```

**Chemistry (squad-build multiplier).** Each starter earns 0–3 **chem points** from links to adjacent players sharing a League / Club / Nation, plus manager alignment. Squad chem (0–33) unlocks stat boosts applied in-match: at 100% chem, linked players get up to **+5 to their weakest two stats**. Chem makes a well-built cheaper squad outperform a random-expensive one — a core fairness and depth lever.

---

## 3. MATCH GAMEPLAY

### Format
- **11 v 11**, single-half **3-minute** default match (accelerated match clock), **5-minute** for tournament finals. Golden-goal extra time (90s) then penalty shootout if drawn in knockout modes.
- **Camera:** broadcast-style dynamic follow, angled behind the attacking team's play (as in the reference), auto-zooming on shots and set pieces.
- **Server-authoritative** simulation with client prediction + rollback for responsiveness at ~80–120 ms RTT.

### Advanced controls (default scheme — matches reference art)
- **Left virtual joystick** (bottom-left): 360° movement of the active player. A radial guide ring shows sprint direction.
- **Right action cluster** (bottom-right), four contextual buttons:
  - **PASS** (blue) — tap = ground pass to context-selected teammate; hold = drives pass power. Double-tap = give-and-go.
  - **THROUGH** (yellow) — threaded/lofted through ball into space; power by hold duration.
  - **SHOOT** (red-orange) — tap-and-release shot; **hold time = power**, joystick angle at release = placement; late-release near the "green timing window" = *timed finish* accuracy bonus.
  - **SPRINT & SKILL** (green) — hold = sprint; flick the left stick while holding = context skill move (roc/step-over/drag-back), gated by the card's DRI and traits.
- **On defense** the same cluster remaps: PASS→**Switch Player**, THROUGH→**Tackle**, SHOOT→**Slide**, SPRINT→**Contain/Jockey**.
- **Passive assists** (toggleable in settings, on by default for new players): pass assistance (0–100%), auto-switch to nearest defender, shot aim assist. Competitive/ranked ladders offer a **"Manual"** input tier for higher rewards.

### Simplified tap-to-play mode (optional)
For accessibility, one-handed play, and lapsed casuals:
- Hide the joystick. The player **taps a teammate** to pass there, **taps space** to send a through ball into it, **taps the goal / swipes at goal** to shoot (swipe angle = placement).
- Movement is AI-driven "auto-run into space"; the human decides *when and where* the ball goes, not fine positioning.
- Fully cross-compatible: a tap-player can matchmake against a stick-player. Tap mode trades ceiling for approachability; ranked play nudges (but never forces) users toward Advanced controls.

### Match length, pacing & difficulty
- **Pacing target:** a shot attempt roughly every 30–40s; a "danger moment" every ~20s. Kickoff → first meaningful chance under 25s. No dead time.
- **Difficulty scaling (vs AI / co-op events):** five tiers (Amateur → Semi-Pro → Pro → World Class → Legendary). Scaling levers: AI reaction latency (250 ms → 90 ms), pressing intensity, marking tightness, and a defensive-line aggression value — **not** cheat-boosted stats. Player card stats are always honest.
- **Skill vs squad-strength balance.** Two dials keep both mattering:
  1. **Squad rating gate in matchmaking** (see PvP) narrows opponent OVR spread, so mismatches are rare.
  2. **Diminishing squad returns.** Above ~85 team OVR, additional OVR yields sub-linear on-pitch benefit; execution (timed finishing, skill moves, positioning) becomes the dominant win factor. A skilled player on an 82-OVR squad can beat a mediocre player on an 88-OVR squad — by design, this is a headline balance goal validated in playtests (target: skilled-underdog win rate ≥ 45% within one OVR bracket).

---

## 4. GAME MODES

### 4.1 Online PvP — "Ranked Ladder" (core mode)
- Real-time 1v1, server-matched by **squad OVR bracket** (±3 OVR window, widening after 20s of search) and **hidden MMR**.
- **Seasonal divisions:** Wood → Bronze → Silver → Gold → Emerald → Ruby → **Vanguard (top-10k)** → **Legend leaderboard (top-500)**. Win to earn ladder points; promotions at thresholds, soft demotion protection (1 free loss per rank).
- **Rewards per win:** 300–900 Coins scaled by division, ladder points, weekly milestone pack tokens.
- **Weekly reset** of a *competitive sub-track* ("Weekend Clash", Fri–Sun): a fixed run of matches (e.g. best-of-20-results) whose final win count grants ranked reward tiers (kits, high-OVR player picks, Gems).

### 4.2 Bracket tournament — "Cup Run"
- Single-elimination **8-player** live bracket (or async bots to fill), 4 rounds to a trophy. Entry costs a **Cup Ticket** (earned daily or bought).
- Escalating rewards per round survived; **champion** earns a guaranteed Epic+ player pick, a themed kit, and Gems.
- Seasonal **"Golden XI Cup"** monthly major: 64-slot gauntlet with a chase Icon card for the winner and a cosmetic trophy shown on the player's profile/home hub.

### 4.3 Rotating live seasonal events
- A **6-week "Season"** frames all content (e.g. *"Winter Surge"*, *"Continental Nights"*). Each Season ships:
  - **Event track:** a rotating series of 2–4-day mini-events with themed challenge squads and boosted-drop packs.
  - **Live objectives board:** e.g. "Score 3 finesse goals," "Win 5 matches with a full-chem squad" → pays event currency (**Season Points**).
  - **Season Pass / Star Path** (free + premium lanes; see Economy) of 40 tiers unlocked with Season Points.
  - **Featured player program:** limited-time boosted cards (e.g. "Winter Surge" special editions with +OVR) available via event packs and objective grinds only — they retire when the Season ends, keeping the meta fresh.

### 4.4 Daily quests & training
- **Daily quests (3/day):** e.g. "Play 2 PvP matches," "Train any card once," "Score with a header." Reward: 500–1,500 Coins + training materials + quest XP.
- **Weekly quests (5/week):** larger objectives → pack tokens + Gems.
- **Training drills (single-player):** short skill mini-games (timed-finish range, dribble gauntlet, pass-accuracy) that both teach mechanics and pay training materials. Gated by a **Stamina/Energy**-free design — drills are always available (no energy walls), but daily reward caps prevent infinite farming.
- **Daily login calendar:** 28-day cycle, escalating rewards, day-7/14/21/28 grant packs and Gems.

**Progression per mode** feeds a shared **Club Level** (account XP) that unlocks features (market access at Lvl 5, tournaments at Lvl 8, Manual ranked at Lvl 12) and pays milestone packs.

---

## 5. PROGRESSION SYSTEMS

### Training cards (stat growth)
- Each card has a **training track** consuming **Training XP** (from drills, duplicate fodder, and quest payouts). Spending XP raises individual sub-stats toward the card's tier ceiling.
- **Example:** Kwame Osei (Epic, 2★, 81 OVR) — spend 4,200 Training XP to raise PAS 84→86 and DRI 80→82, nudging OVR 81→82.
- Position **retraining tokens** unlock alternate positions (e.g. train a CM to also play CDM), improving formation/chem flexibility.

### Ranking up cards (star-tier promotion)
- Promote 1★→5★ by fusing **duplicate copies** (or universal **Star Shards**) + Coins.
- **Costs (example):** 1★→2★: 1 dupe + 2,000 Coins. 2★→3★: 2 dupes + 6,000. 3★→4★: 4 dupes + 20,000. 4★→5★: 6 dupes + 60,000 + 1 Elite Shard.
- Each star raises the stat ceiling (~+2 OVR realized after training) and can unlock a trait slot at 3★ and 5★. This gives low-rarity cards a long-tail upgrade path — a beloved Silver can be maxed to remain viable.

### Raising overall squad rating across a Season
- **Squad OVR** = weighted average of the starting XI's OVRs, nudged by chemistry and manager bonuses.
- Season-long progression targets (example new-player arc):
  - Week 1: ~72 squad OVR (Silver/Gold cards, learning controls).
  - Week 3: ~78 (first Epics trained, chem optimized).
  - Week 6: ~83–85 (a Legend or two, 5★ maxed cores, full chem).
- **Manager cards** (collectible) grant formation-wide passives (e.g. +3 PAC to wingers, +2 DEF to the back line) and their own chem alignment.
- **Season carryover:** cards persist between Seasons; only the *featured limited editions* retire, and squad OVR is never reset — progress compounds. A **"Season Prestige"** cosmetic badge rewards players who hit target OVR each Season.

---

## 6. UI / UX

### Navigation model
Landscape, **hub-and-spoke**. Persistent bottom nav bar across all menus:
`[ HOME ] [ SQUAD ] [ PLAY ] [ STORE ] [ CLUB ]`
Currencies (Coins, Gems, event currency) always visible top-right; profile/level top-left; mailbox + settings top-right corner.

### Home-screen hub
- Central **hero tile** = the current Season's featured event (animated, tappable → event flow).
- Below: a **scrollable rail of tappable event tiles** — Ranked, Cup Run, Daily Quests, Season Pass, Live Event — each showing a live status badge (timer, claimable-reward dot, progress ring).
- A **"Play Now"** primary CTA (bottom-center) drops straight into last-played mode with current squad — one tap from open to matchmaking.
- Claimable rewards surface as glowing badges so the daily check-in loop is frictionless.

### Squad-builder screen
- **Pitch view:** formation with 11 slots (+ subs bench drawer). Drag-drop cards into slots; **chemistry links render as colored lines** between players (green = strong, yellow = partial, red = none) so optimization is visual and immediate.
- **Left panel:** live squad summary — Squad OVR, total Chem (x/33), formation dropdown, active manager, active tactic preset.
- **Right panel / collection drawer:** searchable, filterable card list (by position, rarity, OVR, league, chem fit). "Auto-Fill best chem" and "Suggest upgrade" helper buttons for new players.
- Tap a card → detail card view (stat block, traits, train/rank-up actions, sell/quick-sell).

### In-match HUD (matches reference layout)
- **Top-left:** scoreboard — both crests, score, match clock (e.g. `CHE 0–0 LIV · 05:05`), plus a speed control (pause/normal/fast) where allowed.
- **Bottom-left:** movement joystick with directional guide ring.
- **Bottom-right:** the four action buttons (PASS / THROUGH / SHOOT / SPRINT & SKILL), color-coded, contextual labels swapping on attack/defense.
- **Bottom-center:** **radar/minimap** showing all 22 players + ball, with the active player highlighted and the selected pass target chevroned (matching reference).
- **Over-pitch:** floating name tags on the ball carrier and nearest opponent; a shot-power meter arcs from the SHOOT button on hold; a timing bar for timed finishing.
- **Post-match:** MOTM, stat recap, reward reveal (Coins/XP/pack drops) with a satisfying "pack open" animation for any card rewards.

### Onboarding flow
Guided first-time experience: (1) a scripted "score in 60 seconds" tutorial match with control coach-marks, (2) a free **Starter Pack** granting a playable ~75-OVR squad, (3) a squad-builder walkthrough (drag one card, see chem link light up), (4) first Ranked placement. Target: from install to first PvP win under 8 minutes.

---

## 7. ECONOMY & MONETIZATION

### Currencies
- **Coins (soft):** freely earned from matches, quests, selling cards. Spent on packs (Coin-priced), card training/rank-up, market purchases, cup tickets.
- **Gems (hard):** bought with money or earned in trickle amounts (login, high milestones, event finales, ~40–80/week free). Spent on premium packs, the Season Pass, cosmetics, and time-savers.
- **Season Points / event currency:** soft, event-scoped, non-purchasable, spent only on that Season's track — resets each Season.

### Earn sources (free player, per active day, realistic)
| Source | Coins/day | Gems/day (avg) |
|---|---|---|
| Daily quests (3) | 2,500–4,000 | — |
| PvP wins (5–8) | 2,000–5,000 | — |
| Weekly quests (amortized) | ~1,500 | ~10 |
| Login calendar (amortized) | ~800 | ~8 |
| Events / Weekend Clash (amortized) | ~2,000 | ~15 |
| **Daily total (approx.)** | **~9,000–13,000** | **~30–40** |

### Spend sinks
- **Packs (randomized):** Coin packs (Bronze 500 / Silver 2,500 / Gold 12,500) and Gem/premium packs (Prime 100 Gems, Legend-boosted 300 Gems, event packs). **Odds are fully disclosed** on every pack (rates published per §2). No paid-only card can be *impossible* to get free: featured cards are also earnable via objective grinds and the market.
- Training/rank-up (Coin + Shard sinks), Cup tickets, market listing fees.

### Monetization products
1. **Season Pass ("Star Path"):** ~$9.99 premium lane, 40 tiers over 6 weeks, granting Gems, packs, an exclusive kit, and a guaranteed high-OVR (non-Icon) card at tier 40. Free lane always pays meaningful rewards. Best value/hour; the anchor purchase.
2. **Gem bundles:** $0.99–$99.99 tiers with first-purchase and weekly-refresh bonus multipliers.
3. **Premium & event packs:** Gem-priced randomized packs with disclosed odds and (for chase events) a **hard pity counter** — guaranteed Legend+ within N packs (e.g. by the 30th pack) so spend can't infinitely miss.
4. **Cosmetics (non-P2W):** kits, crests, celebration animations, stadium themes, MOTM cards — purely visual, tradeable subset only via Gems.
5. **Convenience:** Coin/XP boosters (time-savers, never power an unfair advantage).

### Fairness guardrails (non-paying player protection)
- **Squad-OVR matchmaking bracket** means a whale's 92-OVR squad rarely faces a free player's 80-OVR squad; contests stay within-tier.
- **Diminishing squad returns above 85 OVR** (§3) cap the ceiling money can buy; execution decides top-tier matches.
- **Free-earnable everything:** every featured card, kit, and pass reward has a play-only path (objectives, market, ladder rewards).
- **Player market** lets free players sell dupes for Coins and buy specific cards, converting time into targeted power without gambling.
- **Published odds + pity timers** on all randomized packs; no loot box without disclosed rates. No pay-to-win stat that can't be trained by a free player over a Season.
- **No energy paywalls** — you can always play; monetization sells *speed and personalization*, not *access*.

---

## 8. ART & AUDIO DIRECTION

### Visual style
- **Grounded stylized realism** — believable athletic proportions and motion, but slightly heightened color, cleaner materials, and readable silhouettes for small screens (not photoreal, not cartoon). Reads clearly at phone size and in bright outdoor light.
- **Kits & crests (all fictional):** bold, high-contrast, recognizable-at-a-glance designs so the minimap and small player models stay legible. Home/away/third kits per club; crest system with 6 shape families × color/emblem combos.

### Color palette
- **Pitch & world:** saturated turf greens (#3FA34D → #2E7D32 stripes), warm floodlit whites.
- **UI system:** dark charcoal panels (#141A1E) with a vibrant accent — **electric gold (#F5C518)** as the brand hero, plus role-coded action colors: Pass **blue #2F80ED**, Through **amber #E0A400**, Shoot **red-orange #E4572E**, Sprint/Skill **green #27AE60** (matching reference cluster).
- **Rarity language:** bronze/silver/gold/prismatic-purple/animated-gold frames, consistent across cards, packs, and rewards.

### Stadium presentation
- **6–8 fictional stadiums** at launch, ranging from a compact urban ground to a grand national arena, each with distinct crowd colors, banners, and lighting (day / dusk / floodlit night). Animated crowds, tifos, pyro on goals, dynamic advertising boards (fictional in-game sponsors).
- **Broadcast dressing:** lower-third scoreboard, replay wipes, kickoff and goal cinematics, MOTM podium.

### Camera
- Default **dynamic broadcast** angle behind the play (per reference), auto-framing to keep ball + relevant players on screen; punch-in on shots, set pieces, and goals. Optional fixed "tactical" higher angle for competitive players who want more field vision. Slow-mo goal replays.

### Audio
- **Commentary:** two-voice fictional commentary team, event-driven lines (build-up, near-miss, goal, final whistle) with dynamic intensity layering; localized VO packs post-launch.
- **Crowd:** adaptive stadium bed reacting to momentum — swelling on chances, roaring on goals, groaning on misses, chants tied to home club.
- **SFX:** weighty ball strikes, boot-on-turf, net ripple, whistle; distinct UI audio for pack opens (rarity-tiered stingers — the higher the pull, the bigger the payoff sound).
- **Music:** energetic electronic-orchestral menu themes, Season-themed remixes; ducks under commentary in-match.

---

## 9. FIRST RELEASE SCOPE

### v1 (MVP) — ships at launch
**Gameplay**
- Landscape 11v11 real-time matches, 3-min default, server-authoritative.
- Advanced control scheme (joystick + PASS/THROUGH/SHOOT/SPRINT&SKILL) **and** simplified tap-to-play mode.
- Timed finishing, core skill moves, contextual defending, assist toggles.
- 3 formations (4-3-3, 4-4-2, 4-2-3-1), 3 tactic presets.

**Cards & progression**
- ~300 launch player cards across 5 rarities, 8 fictional leagues / ~48 clubs / ~24 nations.
- OVR system, 6 sub-stats, star tiers (1★–5★), chemistry, ~8 traits, 12 manager cards.
- Card training, rank-up, retraining tokens.

**Modes**
- Ranked Ladder (full division ladder + Weekend Clash).
- Cup Run (8-player bracket).
- One launch **Season** (6 weeks) with event track + Season Pass (free + premium) + one featured player program.
- Daily/weekly quests, training drills, login calendar.

**Meta / economy**
- Coins + Gems + Season Points; packs with published odds + pity; Season Pass; Gem bundles; cosmetic store (kits/crests/celebrations); basic **player market**.
- Club Level account progression + onboarding tutorial + Starter Pack.

**Presentation**
- 4 stadiums (day/night variants), broadcast camera, two-voice commentary (English), full UI hub + squad builder + in-match HUD, adaptive crowd audio.

**Tech/live-ops**
- Matchmaking (OVR bracket + MMR), anti-cheat baseline, disconnect/rejoin handling, remote-config live-ops for events, published-odds compliance, account + cloud save.

### Deferred to post-launch updates
- **v1.1–1.2:** 2v2 co-op PvP; friend/rival system + private matches; Guilds/Clubs (social groups, guild leaderboards, co-op objectives).
- **v1.x:** additional stadiums (to 8+), 3rd kits, more formations/tactics, second commentary language pack.
- **v2:** Draft mode (pick-a-squad tournaments); Squad Battles vs curated AI teams; ranked "Manual" esports ladder + spectate/replay sharing; seasonal cross-region championships.
- **Later:** deeper set-piece control (manual free kicks/penalties skill mini-game), player-created custom tournaments, in-game creator/clip tools, live event partnerships, expanded Icon programs.
- **Content cadence:** a new 6-week Season every cycle with fresh featured programs, retiring limited cards to keep the meta rotating.

---

### Appendix — sample fictional content bible (seed set)

**Leagues (8):** Estrella Prime · Northern Union · Adriatic Cup · Sahel Elite · Rising Sun League · Pampas Division · Nordic Premier · Gulf Championship.
**Sample clubs:** Rayo Azul · Ironside FC · Sokol Split · Dune Lions · Kaminari United · Río Plata · Fjord City · Falcon Bay.
**Sample players:** Diego "El Cometa" Salazar (ST) · Kwame Osei (CM) · Luka Horvat (GK) · Mateo Rivas (CB) · Jun Takeda (RW) · Anders Vik (CDM) · Omar Haddad (LB) · Théo Blanc (CAM).
**Fictional in-game sponsors (ad boards):** Voltaic · Meridian Air · NovaBank · Kestrel Sportswear.

*End of document.*
