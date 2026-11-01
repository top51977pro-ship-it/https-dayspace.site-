# SPEC — "Sculpted by Light" (RTX 5090 product film)

GOAL:    The viewer feels the RTX 5090 is a precision object worth wanting; they remember its
         silhouette and its name.
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps.
TIME:    25.0 s x 30 = 750 frames. No music bed (no licensed source in this session); a
         designed sound layer instead (see SOUND).

LOOK:
- Ground: #000000 seamless; from 4 s a black satin floor (#0a0a0b, roughness 0.55) 5 cm under
  the card shows a reflection at ~25%; a soft light pool ~60 cm wide on it.
- Ink: #F2F3F5 (text), secondary #8B8F96.
- Accent: NVIDIA green #76B900, ONLY (a) one thin moving light blade at 15.4–17.0 s,
  (b) "RTX 5090" never in green, (c) nothing else. Max 1 green element on screen.
- Display face: Inter variable (OFL; the closest open face to the SF Pro / NVIDIA Sans
  family). Name: 300 + 600 weights, 112 px, tracking -0.035em. Statements: weight 300,
  56–60 px, ALL CAPS, tracking 0.30em → 0.26em on entrance.
- Medium: a 3D studio. Gunmetal anodised aluminium (metalness 1, roughness 0.36–0.42, base
  #5d6066, brushed roughness streaks ±0.06); black fins (#16171a, metal, roughness 0.3);
  satin-black fan blades (#141517, metalness 0.15, roughness 0.45, clearcoat 0.4).
- Light: environment = black + top softbox 60x30 + 2 vertical strips 4x40 + a rear rim strip;
  the environment rotates ≤25° over a shot so highlights travel. Rect-area key 40x12 from the
  upper left, warm-neutral 6200 K; rim from behind, cool 7500 K.
- Grade: ACES filmic, exposure 0.9–1.15, vignette 22%, grain 1.6%, bloom strength ≤0.28 with
  threshold 0.85 (only the GEFORCE RTX wordmark and specular peaks).

OBJECTS: RTX 5090 Founders Edition at true proportions 304 x 137 x 40 mm (scene units = cm):
         two 115 mm 7-blade fans on the front at both ends, flow-through fin stacks visible
         through both openings, gunmetal frame wrapping top/end/bottom, an hourglass "X" centre
         panel joining the two fan rings (the infinity-loop motif), a lit GEFORCE RTX wordmark on
         the top edge, a 16-pin connector recess, an I/O bracket with 3 DP + 1 HDMI, gold PCIe
         fingers. Fans turn slowly (0.9 rad/s).

MOTION:
- Camera: one continuous eased move per shot; position = spherical (azimuth, elevation, radius)
  around a moving target; eases are `sine.inOut` / `power2.inOut` for travel and `power3.out`
  for arrivals. Orbits ≤ 35° per shot. No roll except ≤4° in the fan macro.
- Product rotation (hero only): yaw -34° → 0° over 4.2 s, `expo.out`-style long tail.
- Text: arrives over 0.5–0.7 s (blur 12 px → 0, opacity 0 → 1, per word 0.12 s apart, no
  translate); the name per letter 0.035 s apart; holds dead still; exits as a 0.35 s blur-out.

SHOTS:
1. 0.0–4.2  DARKNESS. Macro (r 7 cm) grazing the bevel where the left fan ring meets the top
   rail. Black until 0.5 s; one thin strip light slides left→right, its highlight travelling
   along the circular chamfer. Camera drifts 2 cm, az -60° → -50°. Sound: low room tone in.
2. 4.2–9.0  REVEAL. Continuous pull-back + orbit: r 7 → 60, az -50° → -24°, target eases to the
   card centre; the environment and key fade up 4.4–7.6 s; fans and fins resolve. Sound: long
   cinematic whoosh on the pull-back.
3. 9.0–14.0 ENGINEERED FOR POWER. Hard cut on motion to three macros: (a) fan hub + blades,
   push-in with 4° roll, shallow DOF; (b) lateral track along the top edge past the lit
   GEFORCE RTX wordmark and the power connector; (c) low grazing track past the I/O bracket and
   gold fingers. Text "ENGINEERED FOR POWER." lands 10.0 s, left third, holds until 13.5 s.
   Short whooshes on cuts 9.0 / 10.8 / 12.4 (two different takes).
4. 14.0–20.0 HERO. The card floats over the satin floor; it yaws into the hero pose while the
   camera arcs (az -4° → -20°, el 3° → 8°). 15.4–17.0 s: one thin green light blade passes
   across the card. 17.2 s: "GeForce RTX 5090" lands above the card; bass impact.
5. 20.0–25.0 FINAL. Near-still (camera travels <1.5 cm). 20.5 s "BEYOND ORDINARY." under the
   card. 23.4–24.8 s fade to black; the sound resolves and fades.

BANNED: neon, lens flares, particles, glowing orbs, green washes over the card, purple/blue
gradients, glass cards, corner labels/HUD, a logo docked in a corner, text sliding up, text
moving after it lands, breathing/pulsing loops, bounce, a linear camera, a crossfade between
worlds, a small product in the middle of empty black (the card is ≥45% of the frame width in
every wide shot).

QA frames: 0.6 (first light), 3.0 (macro bevel highlight), 6.5 (mid pull-back), 8.8 (full
card), 9.5 / 11.5 / 13.0 (macros + text), 16.2 (green blade mid-pass), 18.5 (name landed),
22.0 (end frame), 24.95 (black).
