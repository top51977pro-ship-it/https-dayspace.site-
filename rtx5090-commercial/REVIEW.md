# REVIEW

## Creative calls

- **Direction "Sculpted by light"** (see `REFERENCES.md` §4): light discovers the object. A single
  scanner strip in black reveals one bevel, then a continuous pull-back and orbit, three macros,
  a hero pose with one thin green light pass, and a near-still end frame.
- Kept the storyboard's 5 beats and timings; refinements from research and review:
  - the name is written left→right **in the wake of the green light blade** (cause → effect)
    instead of fading in on its own;
  - "BEYOND ORDINARY." sits **under the name as a lockup** above the card rather than below the
    card, so the hero card stays large and the lockup stays still;
  - "ENGINEERED FOR POWER." is held over the first two macros (9.4–12.4 s) and clears before the
    third, so the type never sits on the product;
  - the third macro became a **low grazing shot along the fan face** (fan rings receding, bevel
    rim lit) after the first version, an I/O-bracket close-up, read as a flat plate.
- No exploded view, no particles, no neon; green is a single specular/rim pass.
- Storylines not built: (a) an exploded-view "engineering" film (more NVIDIA-like, less Apple);
  (b) a silhouette-only film lit entirely by moving rim light.

## Passes made (all from real rendered frames, via `hyperframes snapshot`)

| Pass | What the frames showed | Fix |
| --- | --- | --- |
| 1 | From 6 s onward everything blown out to white haze (spotlight intensity 1800 with no falloff + bloom); brushed texture read as wood grain; "RTX5090" missing its space | Replaced the spotlight with a self-lit radial floor pool; 3× finer, ⅓-strength brushing; non-breaking spaces in the name |
| 2 | Floor read as a grey tabletop with a hard horizon; **green light flooded the entire card** (banned); hero metal read as black plastic; text collided with the glowing wordmark; wordmark too hot | Floor became an unlit fading plane; green blade made narrow, distant and specular-only; text moved to the lower third; wordmark and bloom reduced |
| 3 | Hero still flat: the flat fan face reflected an empty part of the environment | Added a wide gradient softbox exactly where the face reflects at the hero angle; stronger key; nickel heat pipes toned down; I/O bracket rebuilt with lipped ports + a capsule vent field |
| 4 | Floor reflection fell below the frame; I/O macro dull; green barely read | Float gap 5 → 2.5 cm and reframed hero; new grazing third macro, relit by rotating the environment; added a green rim light that travels along the top edge in sync |
| 5 | Seams checked at ±0.05 s around every cut (4.2, 9.0, 10.8, 12.4, 14.0); **fan hubs showed the fins through them** (culled cap faces) | Hub material double-sided |

## Final file (`RTX5090_Commercial.mp4`): measured

- 25.000 s, 750 frames, 1920×1080, 30 fps, H.264 High / yuv420p, AAC-LC 256 kb/s, 24.8 MB.
- Full decode with `ffmpeg -v error`: no errors.
- `blackdetect`: the only black stretch is the intended fade-out at 24.53–24.97 s (the opening
  darkness is lit by the scanner strip from ~0.4 s, so it is below the black threshold only briefly).
- Loudness (EBU R128): integrated −17.8 LUFS, true peak −1.5 dBFS (no clipping). That's a little
  under the −16 to −14 LUFS social target, deliberately so for a quiet, restrained film; raise the
  bed and hits by ~3 dB for social platforms.
- Rendered in two halves with `hyperframes render --start/--end` (68 min + 36 min under software
  WebGL), joined by video stream copy (no re-encode) and sample-exact audio trims; frames
  373/376 across the 12.5 s join continue the same move.
- A decoded-frame sheet of the final MP4 (16 frames across 0–25 s) was inspected.

## Measured vs looked at

- **Measured:** `hyperframes lint` (0 errors, 0 warnings); file duration/resolution/codec with
  `ffprobe`; audio levels with `hyperframes audio`; SFX peak times (to place each hit one frame
  after its picture).
- **Looked at:** every snapshot listed above, at full resolution for the key frames.
- **Not checked by a human ear:** the sound was measured, not heard.
- `hyperframes check` (runtime/layout/contrast audit) was started but stopped after 25 minutes:
  under software WebGL each sampled frame of the 3D stage costs seconds, and the audit's
  sampling made it impractical here. Lint passes cleanly, and layout and contrast were reviewed
  by eye: white 34–112 px text on near-black, with no text over the product.

## Weakest shot and what I would do with more time

- **Shot 1 (0–4.2 s)** is beautiful but very dark for its first second. That's intentional
  (the brief asks for black), but on a phone it can read as nothing. With more time: a brighter,
  longer specular travel along the bevel.
- The model is procedural; with a licensed CAD/scan of the Founders Edition, the X-frame
  curvature, connector and bracket would be exact (see README "approximations").
- A licensed music bed: the HyperFrames music catalog needs a HeyGen sign-in, which this session
  did not have.

## 4K

Not rendered in this session: on a CPU-only container the 1080p film took ~105 minutes, and 4K
(4× the pixels) would take ~7 hours. The project is ready for it: the WebGL canvas follows
`devicePixelRatio`, so `npx hyperframes render --quality delivery --resolution 4k` produces a true
3840×2160 render (not an upscale) on any machine, and quickly with a GPU.

## Warnings kept on purpose

- The first ~0.4 s is black (the brief's "completely black screen"), so the thumbnail is dark.
