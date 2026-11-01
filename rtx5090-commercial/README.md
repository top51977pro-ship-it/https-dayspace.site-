# GeForce RTX 5090 — "Sculpted by Light"

A 25-second, 1920×1080, 30 fps product film for the NVIDIA GeForce RTX 5090 Founders Edition,
built with **[HyperFrames](https://hyperframes.heygen.com)** (HTML rendered frame-by-frame to video)
with a real-time **Three.js** (WebGL, physically based) scene for the product.

| File | What it is |
| --- | --- |
| `RTX5090_Commercial.mp4` | The rendered film (H.264 + AAC) |
| `index.html` | Root composition: the 3D stage canvas, three typography scenes, the audio mix |
| `scene/gpu.js` | The procedural RTX 5090 FE model (geometry + PBR materials) |
| `scene/stage.js` | Studio lighting, environment, camera choreography, post-processing, `render(t)` |
| `compositions/engineered.html`, `name.html`, `tag.html` | Typography scenes (GSAP) |
| `assets/fonts/` | Inter variable font (OFL) |
| `assets/audio/` | Sound stems + `CREDITS.md` |
| `audio-src/make_audio.py` | Generates the original ambience bed and the SFX variants |
| `lib/` | Vendored Three.js r184 and GSAP 3.15 (so renders never hit the network) |
| `REFERENCES.md` | Research: product sources, film references, findings |
| `SPEC.md` | The director's spec: every look/motion decision as a number, plus the shot list |
| `REVIEW.md` | The review passes: what was inspected, what was fixed, known limits |

## Requirements

- Node.js 22+, FFmpeg, Chrome/Chromium (HyperFrames finds a system Chrome or downloads one:
  `npx hyperframes browser ensure`).
- Python 3 + NumPy only if you want to regenerate the audio stems.

## Preview

```bash
npx hyperframes preview            # opens the Studio preview (scrub, edit timing, variables)
npx hyperframes snapshot --at 3,8.8,18.5,22   # PNG frames to .hyperframes/artifacts/snapshots/
```

## Render

```bash
npx hyperframes check                                   # lint + runtime + layout gate
npx hyperframes render --quality delivery -o RTX5090_Commercial.mp4
# true 4K (the WebGL canvas follows devicePixelRatio, so this is not an upscale):
npx hyperframes render --quality delivery --resolution 4k -o RTX5090_Commercial_4K.mp4
```

The scripts in `package.json` pin `hyperframes@0.8.226` so the film re-renders identically.

On a machine without a GPU, Chrome falls back to SwiftShader (software WebGL). In this cloud
session the 1080p film took ~105 minutes, rendered as two halves to stay inside a 2-hour job
limit, then joined without re-encoding:

```bash
npx hyperframes render --quality delivery --start 0    --end 12.5 -o renders/part1.mp4
npx hyperframes render --quality delivery --start 12.5 --end 25   -o renders/part2.mp4
printf "file 'part1.mp4'\nfile 'part2.mp4'\n" > renders/list.txt
ffmpeg -f concat -safe 0 -i renders/list.txt -an -c:v copy renders/v.mp4
ffmpeg -i renders/v.mp4 -i renders/part1.mp4 -i renders/part2.mp4 -filter_complex \
  "[1:a]atrim=0:12.5,asetpts=N/SR/TB[a0];[2:a]atrim=0:12.5,asetpts=N/SR/TB[a1];[a0][a1]concat=n=2:v=0:a=1[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 256k -movflags +faststart RTX5090_Commercial.mp4
```

4K is roughly four times the 1080p cost; with a GPU it is far faster.

## How it works

- **Deterministic 3D.** `render(t)` in `scene/stage.js` is a pure function of the timeline time:
  camera, product pose, fan rotation, every light's intensity and position, environment rotation,
  depth-of-field focus, grain seed. HyperFrames seeks each frame independently and calls it from
  both the `hf-seek` event and the root GSAP timeline. The async build (font, PMREM environment)
  registers `window.__hf.buildReady.stage`, so the renderer waits for it.
- **Lighting.** A virtual studio: a prefiltered (PMREM) environment of softbox strips in a black
  room (overhead softbox, two vertical strips, a cool rear rim strip, and a wide gradient softbox
  placed exactly where the flat fan face reflects at the hero angle), rotated per shot so highlights
  travel. Rect-area lights add the key, the rim, the narrow "scanner" strip of shot 1 and the green
  light blade of the hero. ACES filmic tone mapping, restrained bloom (threshold 0.86), vignette,
  1080p-cell film grain, cool shadow split.
- **Camera.** Each shot is a spherical move (azimuth, elevation, radius, with a log-space
  dolly in the pull-back) around a moving target, on sine and cubic in-out curves; the hero's
  product yaw lands on an exponential ease-out.
- **Reflection.** The satin floor is a fading, semi-transparent black plane over a mirrored copy
  of the card.
- **Editable.** Copy lines and colours are HyperFrames variables (`data-composition-variables`);
  the type scenes can be retimed in Studio.

## Model accuracy and approximations

Verified from published reviews (see `REFERENCES.md`): 304 × 137 × 40 mm proportions; a two-slot
"Double Flow Through" design; two 115 mm, 7-blade, dark-grey fans on one face; a matte gunmetal
metal shroud wrapping the top, end and bottom; black fin stacks visible through both openings; an
unbranded front face; an X / infinity-loop frame motif.

Approximated (my best knowledge, not confirmed against photos, because photo galleries were not
reachable from this session):
- the exact curvature of the hourglass "X" centre panel and its two-tone finish;
- the illuminated **GEFORCE RTX** wordmark on the top edge (the font is Inter Bold, not NVIDIA's
  typeface);
- the 16-pin connector shown as a flat recess on the top edge (on the real card it is angled);
- the I/O bracket (3× DisplayPort + 1× HDMI shown as simple recessed ports) and its vent pattern;
- heat pipes, fin pitch, fan-blade curvature and hub profile;
- the backplate is not detailed (it is never on camera).

No NVIDIA logo artwork or performance claims are used. The film is an unofficial concept piece,
not NVIDIA material.

## Sound

An original ambience bed (seeded, filtered noise + a soft 55/82 Hz sub swell that resolves the
ending) generated by `audio-src/make_audio.py`, plus Pixabay-licensed effects bundled with
HyperFrames (cinematic whoosh on the pull-back, three different whoosh takes on the cuts, a riser
and a bass impact on the name reveal, a high-passed shimmer under the green light). Each hit is
placed so its measured peak lands one frame after its picture event. No copyrighted music. No
licensed music bed was available in this session (the HyperFrames music catalog needs a HeyGen
sign-in); to add one, drop a track into `assets/audio/` and add an `<audio>` tag to `index.html`.
