# Milky 3D — HyperFrames ad

A 23 s, 1920×1080 Apple-style motion ad in which a real Milky cup moves by itself in 3D.

- **Render:** `renders/milky-3d.mp4`
- **Preview / edit:** `npm run dev` (HyperFrames Studio) · **Check:** `npm run check` · **Re-render:** `npm run render`

## How it's built
- `compositions/stage.html`: a Three.js scene. The cup is a tapered cylinder textured with the
  **real product photos**. `assets/img/milky-body.jpg` is the label unwrapped from the front photo,
  and `assets/img/milky-lid.jpg` is the lid from the pack shot. GSAP tweens a state object
  (position, rotation, squash & stretch, lid, camera, swarm), and every frame is drawn from it,
  so renders are deterministic.
- `compositions/intro|lines|slot|swarm|endcard.html`: Hebrew copy (Heebo) above the 3D world.
  The end card uses the real "בטעם שוקולד" badge cut from the pack shot.
- `assets/audio/`: synthesized 120 BPM track plus SFX timed to landings, hops, the lid pop and whooshes.

## Beats
0–2.6 black title → 2.6 the cup drops in spinning and squashes on impact → hops & a full turn →
dance on the beat → back-flip → the lid pops off and spins → camera dives into the badge →
purple world "מילקי של … תמיד." → a helix of cups rises and collapses into one → end card.
