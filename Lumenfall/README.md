# Lumenfall Shaders

A cinematic, fully deferred shader pack for **Minecraft Java Edition + Iris**, built for
high-end GPUs that want image quality first.

> Lumenfall is an original pack. See [CREDITS.md](CREDITS.md) for the technical reference
> that inspired its feature set and for the published techniques it implements.

## Features

| Area | What you get |
|---|---|
| **Lighting** | Fully deferred PBR (GGX specular, Burley diffuse), physically based sun & moon light through the atmosphere, sky ambient from a per-frame hemisphere integral, blackbody block light, handheld light, lightning flashes |
| **Shadows** | PCSS (blocker search + variable penumbra) up to 16384² shadow maps, coloured shadows through stained glass, screen-space contact shadows, foliage-aware biasing, cloud shadows |
| **Subsurface scattering** | Leaves, grass, snow and ice transmit light using shadow-map thickness |
| **Ambient occlusion** | Ground-truth AO (horizon based, cosine weighted) with multi-bounce colour |
| **Water** | Choppy dispersive waves + parallax, vertex waves, rain ripples, refraction, depth absorption & in-scattering tinted by the biome water colour, physically derived caustics (also underwater and in god rays), shoreline foam, Fresnel SSR/sky/cloud reflections, sun glitter, Snell's window from below |
| **Sky** | Rayleigh + Mie + ozone single scattering with multiple-scattering approximation, limb-darkened sun, procedural moon with phases and craters, twinkling coloured stars, Milky Way, shooting stars, aurora (cold biomes or always), rainbows after rain |
| **Clouds** | Ray-marched volumetric cumulus on a curved shell (cellular-eroded billows, multi-octave multiple scattering, powder effect, dual-lobe phase), cirrus layer, temporal reprojection, clouds in reflections |
| **Volumetrics** | God rays through the shadow map and cloud shadows, ground mist and morning fog, rain haze, cave air, underwater light shafts, Nether smoke with lava glow, End dust |
| **Fog & atmosphere** | Aerial perspective & border fog coloured by the real sky in each direction |
| **Materials** | Internal PBR for vanilla textures (metals, gems, ores, ice, polished stone, emissive light sources, sculk…), LabPBR 1.3 resource pack support, normal maps, generated normals, parallax occlusion mapping with self-shadowing, rain wetness and puddles |
| **Camera** | TAA (Catmull-Rom history, variance clipping), contrast adaptive sharpening, bokeh depth of field (auto/manual focus, aperture blades, chromatic bokeh, near/far field), frame-rate independent motion blur (24 fps / 180° shutter equivalent, strength slider), bloom (7 levels, Karis average), anamorphic streaks, lens flare, auto exposure, Purkinje night vision |
| **Colour** | Lumenfall Cinematic / ACES / AgX / Reinhard tone mappers, white balance, contrast, saturation, vibrance, split toning, vignette, film grain, chromatic aberration, cinematic letterbox |
| **Dimensions** | Nether biome palettes with volumetric smoke and lava glow, End nebula sky with volumetric dust and light shafts |

## Presets

`PERFORMANCE`, `HIGH`, `ULTRA` (default), `INSANE`, `CINEMATIC` (adds DOF, motion blur,
letterbox, grain, anamorphic streaks). Every heavy effect also has its own sub-menu:
Shadows, Lighting, Water, Reflections, Volumetrics, Clouds, Sky, Materials, Bloom,
Depth of Field, Motion Blur, Anti-Aliasing, Colour & Exposure, Dimensions.

`INSANE` and `CINEMATIC` are meant for top-end GPUs (RTX 4090 / 5090 class). Start with
`ULTRA` and move up.

## Installation

1. Install **Fabric** and **Iris** (with Sodium) for your Minecraft version.
2. Download `release/Lumenfall_v1.1.zip` and put the zip (do not extract it) into
   `.minecraft/shaderpacks`.
3. In game: *Options → Video Settings → Shader Packs → Lumenfall*.
4. Optional: a LabPBR resource pack and *Materials → PBR Mode = LabPBR* for parallax and
   authored materials.

## Compatibility

- Loader: **Iris** (recommended 1.8+, Iris 1.11.x on Minecraft 26.x). OptiFine is not a
  target.
- Shaders are written as `#version 330 compatibility`, the most widely supported form
  Iris accepts, and use only stable Iris features (custom uniforms, per-buffer blending,
  `prepare`/`deferred`/`composite` passes, `RENDERTARGETS`, `dimension.properties` plus
  classic `world0/world-1/world1` folders).
- `block.properties` lists block names from 1.13 through 26.x. Names a version doesn't know
  are ignored, so the same zip works across versions.
- Distant Horizons / Voxy LODs are not shaded by Lumenfall.

## Development

```
python3 tools/make_noise.py        # regenerate textures/noise.png
python3 tools/gen_stubs.py         # regenerate the world0/world-1/world1 entry files
xvfb-run -a python3 tools/compile_test.py --profile all   # compile+link every program, every preset, every dimension
xvfb-run -a python3 tools/render_test.py --out shot.png --time 0.25   # offline render via an Iris pipeline emulator
python3 tools/build_pack.py 1.1    # package release/Lumenfall_v1.1.zip
```

`compile_test.py` runs Iris-style preprocessing (includes, option overrides for each
preset, Iris defines) and compiles on a real OpenGL 4.5 compatibility driver.
`render_test.py` renders a procedural voxel scene through the full pipeline (shadow,
prepare, G-buffer, deferred, translucents, composites, final) with Iris' buffer-flip
semantics, so lighting changes can be reviewed without launching the game.

### Pipeline

| Pass | Program | Job |
|---|---|---|
| shadow | `shadow.glsl` | distorted shadow map, translucent tint, water flag |
| prepare | `prepare.glsl` | per-frame sun/moon/ambient colours into `colortex9` |
| gbuffers | `gbuffers_solid.glsl` | G-buffer: albedo, normals, PBR data, lightmaps |
| deferred | `deferred_clouds.glsl` | volumetric clouds with temporal reprojection |
| deferred1 | `deferred_lighting.glsl` | sky + full PBR lighting, shadows, SSS, GTAO |
| gbuffers (translucent) | `gbuffers_translucent.glsl` | water surface data, forward-lit glass/particles |
| composite | `composite_water.glsl` | water, glass & PBR reflections, underwater media |
| composite1 | `composite_volumetrics.glsl` | god rays, fog, aerial perspective |
| composite2 | `composite_taa.glsl` | temporal anti-aliasing |
| composite3 | `composite_dof.glsl` | depth of field |
| composite4 | `composite_motionblur.glsl` | motion blur |
| composite5 | `composite_bloomdown.glsl` | bloom pyramid |
| composite6 | `composite_tonemap.glsl` | bloom, lens flare, exposure, grading, tone mapping |
| final | `final.glsl` | sharpening, CA, vignette, grain, letterbox |

---

## עברית – מדריך קצר

**Lumenfall** הוא Shader Pack מקורי ל-Minecraft Java עם Iris, ברמה קולנועית.

- **התקנה:** מתקינים Fabric + Iris, מעתיקים את `Lumenfall_v1.1.zip` (בלי לחלץ) לתיקיית
  `.minecraft/shaderpacks` ובוחרים אותו במשחק.
- **Presets:** `PERFORMANCE`, `HIGH`, `ULTRA` (ברירת מחדל), `INSANE`, `CINEMATIC`.
  ב-`CINEMATIC` מופעלים DOF, Motion Blur, Letterbox, Film Grain ו-Anamorphic Streaks.
- **שליטה נפרדת:** לכל אפקט כבד יש מסך משלו: Shadows, Water, Reflections, Volumetrics,
  Clouds, Bloom, DOF, Motion Blur, TAA ועוד.
- **Motion Blur:** הפעלה/כיבוי + Slider לעוצמה + מספר דגימות. העוצמה לא תלויה ב-FPS
  (שקול לשאטר 180° ב-24fps).
- **DOF:** פוקוס אוטומטי או ידני, מרחק פוקוס, עוצמה, רדיוס מקסימלי, מספר להבי צמצם,
  בוקה כרומטי וטשטוש קרוב.
