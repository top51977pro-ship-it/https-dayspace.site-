# References & Research

Research was done before any code was written. **A limitation to know up front:** this cloud
session's network policy blocks direct page fetches to most review sites (for example
`lanoc.org` and `techpowerup.com` failed DNS resolution), so I could not open review photo
galleries or watch reference films frame by frame. What follows comes from web-search result
text (reviewers' written descriptions and captions) plus my own knowledge of these well-known
films and of the product. Anything I could not verify is marked as an approximation.

## 1. The product: NVIDIA GeForce RTX 5090 Founders Edition

| Source | What it gave us |
| --- | --- |
| [Tom's Hardware – RTX 5090 FE review](https://tomshardware.com/pc-components/gpus/nvidia-geforce-rtx-5090-review/2) | Two custom **115 mm fans**; **Double Flow Through** cooler; 2-slot thickness (~40 mm) |
| [LanOC – Card layout & photos](https://lanoc.org/review/video-cards/nvidia-rtx-5090-founders-edition?start=2) | Both fans on the **same face**; **all-metal shroud wrapping top, end and bottom**; **7-blade fans**, fans and hubs **very dark grey**; an **X-shaped motif** forming an "infinity loop" pattern; 304 mm × 137 mm, the same length/height as the 4090 FE |
| [Noobfeed – thermals & design](https://www.noobfeed.com/hardware/geforce-rtx-5090-founders-edition-review) | **Matte gunmetal-grey finish, black fans, black heatsink**; the front face is **clean and unbranded** |
| [Overclock3D – FE review](https://overclock3d.net/reviews/gpu_displays/nvidia-rtx-5090-founders-edition-review/3/) | The front is "a very dark silver rather than the near-chrome of the first cards" |
| [Wccftech – Double Flow Through teardown](https://wccftech.com/nvidia-rtx-50-double-flow-through-founders-edition-thermal-solution-teardown-dual-fans-dual-slot-600w-cooling/) | A compact PCB sits **between** the fans, so air flows straight through both fin stacks |
| [Tom's Hardware – SFF-Ready](https://www.tomshardware.com/pc-components/gpus/rtx-5090-founders-edition-is-the-only-sku-that-meets-nvidia-sff-ready-requirements) / [Jawa spec](https://www.jawa.gg/product/135197/nvidia-geforce-rtx-5090-founders-edition) | **304 × 137 × 40 mm**, 2-slot |
| [PC Gamer – design opinion](https://www.pcgamer.com/hardware/graphics-cards/i-reckon-the-nvidia-rtx-5090-founders-edition-is-the-best-looking-graphics-card-ive-seen-in-well-ever-actually/), [Gizmodo hands-on](https://gizmodo.com/the-nvidia-rtx-5090-is-a-thick-slab-of-graphics-processing-promise-2000552978) | Read as "a slab of dark grey metal" with a subtle shroud: restraint is the design language |

**What the 3D model uses (verified):** 304 : 137 : 40 proportions; two 115 mm, 7-blade, dark-grey
fans on one face, one at each end; a matte gunmetal metal frame wrapping the top, end and bottom; black fin
stacks visible through the fan openings (flow-through); an unbranded front face; an X/infinity-loop
frame motif.

**Approximations (from memory, not confirmed by a source I could open):** the exact curve of
the X/infinity frame; the illuminated white **"GEFORCE RTX"** wordmark on the top edge (present
on recent Founders Editions); the angled 16-pin power connector recessed in the top edge;
the I/O bracket with 3× DisplayPort + 1× HDMI; the X motif on the backplate. These are modelled to the
best of my knowledge and are listed again in `README.md`.

No performance specifications appear in the film, so none were fabricated.

## 2. Film and cinematography references

| # | Reference | What I took from it (grammar, never content) |
| --- | --- | --- |
| R1 | **Apple – MacBook Pro product films** (M1 Pro/Max 2021 reveal, M3 "Scary Fast" 2023; [MacRumors BTS](https://www.macrumors.com/2023/10/31/apple-video-scary-fast-event-shot-iphone-15-pro/), [Newsshooter BTS](https://www.newsshooter.com/2023/10/31/apple-event-shot-on-iphone-15-pro-max-behind-the-scenes/)) | The product is shown as **pure form on black**: long, slow moves (4–6 s per move), one move per shot, almost no on-screen text. Edges are **defined by light, not fill**: a thin specular line traces a chamfer before the body is ever seen. Lighting is controlled: subjects are never in true low light, and the darkness is made by flagging, not underexposure |
| R2 | **Apple – iPhone Pro "titanium" product films** (iPhone 15 Pro, 2023) | **Macro passes** over material: the camera nearly grazes the surface, depth of field is shallow, and a **soft highlight band travels along brushed metal**. The type is one short line in a light-weight sans, centred low or beside the object, landing still |
| R3 | **Apple – iMac Pro "artist series"** ([Sarofsky / Cannes Lions](https://www.lovethework.com/work-awards/campaigns/sarofskys-artist-series-for-apples-imac-pro-446970), [WPP case study](https://sites.wpp.com/wppedcream/2018/design-and-branding/broadcast_design-animation/imac-pro)) | Space-grey hardware on near-black: a **dark material needs a large soft source** to show its form, otherwise it disappears. Cool-neutral grade |
| R4 | **NVIDIA – GeForce RTX 50 Series / RTX 5090 CES 2025 reveal** and Founders Edition product renders | **Floating card, three-quarter hero angle, fans facing camera**; **green appears only as a thin accent** (an edge light or an underlight), never as a wash; the metal is dark gunmetal and catches cool white highlights |
| R5 | **NVIDIA – RTX 4090 / 3090 Founders Edition launch films** | **Exploded/turntable reveals and fin macros**; the X motif is the hero graphic. I deliberately did *not* use an exploded view, so the film keeps the Apple-style restraint asked for |
| R6 | DIY Photography – [How to light Apple-like product commercials](https://www.diyphotography.net/?p=139467) | Practical recipe: **one large overhead/side softbox + two thin strip lights for rim edges + black flags**; the reflections of the strips **are** the design on metallic surfaces; move the light (or the object relative to it) so a highlight **travels** across the surface |
| R7 | Apple "Dark Universe" BTS ([PetaPixel](https://petapixel.com/2020/10/26/behind-the-scenes-of-apples-dark-universe-video-shot-on-iphone-12-pro)) | The opening can **start in true black** and reveal through light alone: anticipation through restraint |

## 3. Findings by category

- **Lighting.** A dark gunmetal object only reads through reflections. Use 2–3 long rectangular
  softbox "strips" in an otherwise black environment, plus a big soft top key, and **rotate the
  environment** (not the product) so highlights sweep across the frame. A rim light from behind
  separates the silhouette from black. Green is one thin, low-intensity accent.
- **Composition.** The product fills 50–90% of the frame width. Macro shots crop hard (only
  an edge or a fan hub fills the frame). Hero shot: a three-quarter angle, the card slightly
  below centre, the type above it or on the third.
- **Typography.** One short line per beat, light weight (200–300) for statements and a single
  semibold product name, tight negative tracking on the name, wide tracking on small caps-style
  lines. It lands still and leaves with a blur.
- **Camera.** Slow dolly-ins and pull-backs; orbits under 60° per shot; `power2.inOut`-style
  sine curves for camera moves; long ease-outs on arrivals. **Match cuts** on similar circular
  forms (a fan hub to a fan hub) or a **light-sweep wipe** through black.
- **Transitions.** Cut on a move; dip through black where the light passes; never crossfade between
  worlds.
- **Material realism.** Anodised/bead-blasted aluminium: metalness 1, roughness ~0.35–0.5, a
  slight anisotropic feel faked with a brushed normal-roughness texture; black fins as a dark
  metal with low roughness so the edges catch light; satin-black plastic fan blades
  (metalness 0, roughness ~0.45, clearcoat).
- **Colour grading.** Neutral-cool whites, crushed but not clipped blacks (#000 ground, the darkest
  product value ~#0b0c0e), a filmic tone curve (ACES), 1.5–2% grain, a light vignette.
- **Pacing.** 5 beats in 25 s, 1 move per shot, average shot 2.5–5 s, a 0.5 s hold before the
  payoff, and a final 2–3 s hold on the end frame.

## 4. The original direction this produced

**"Sculpted by light."** The film never shows the whole card until it has earned it. Light is
the protagonist that discovers the object: first a single specular line, then strips that sweep
the frame, then the full studio, then one thin NVIDIA-green blade of light that passes once
across the card at the hero moment. The darkness is a stage, not a void: the card is always
large in frame, and in the hero shot it sits above a black reflective floor that grounds it.
