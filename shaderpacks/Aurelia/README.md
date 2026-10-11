# Aurelia Shaders

A shader pack for **Iris** (Minecraft 26.x) with a soft, colorful, cinematic look inspired by
packs like Complementary Unbound. All code here is original. It is written in the standard
OptiFine/Iris shader-pack format, so it also loads on other recent Iris versions.

## Installation

1. Install [Iris](https://irisshaders.dev) (and Sodium) for your Minecraft version.
2. Copy the newest `Aurelia-v<version>.zip` (from `shaderpacks/release/`) into `.minecraft/shaderpacks/`.
   Don't unzip it. If you do unzip it, the `shaders/` folder must sit directly inside the pack folder.
3. In game, open **Options → Video Settings → Shader Packs** and select **Aurelia**.
4. Open **Shader Pack Settings** to pick a profile (Potato → Ultra) or tune individual options.

## Features

| Area | What you get |
|---|---|
| Sky | Hand-tuned day/sunset/night gradients, sun disc and glow, twinkling stars that rotate with the sky, northern lights on clear nights |
| Clouds | Raymarched volumetric cumulus with a weather map, silver lining, sunset tinting and cloud shadows on the ground |
| Lighting | Deferred lighting, soft PCF shadows (Vogel disk), colored shadows through stained glass, warm block light, handheld light, minimum cave light |
| Materials | Generated normals from vanilla textures, optional rich soil retexture for dirt (off by default), subsurface scattering for leaves and grass, emissive torches, lanterns, lava and glowstone, optional glowing ores |
| Water | Animated wave normals, screen-space reflections with sky fallback, refraction, depth-based absorption, caustics projected through the shadow map |
| Atmosphere | Volumetric light shafts (sun, moon, underwater, End), screen-space sunbeams, height-based fog, morning mist, rain fog, cave darkening, border fog |
| Weather | Rain puddles with reflections, wet darkened surfaces, overcast sky |
| Post | Bloom, eye-adaptation exposure, Lottes filmic tonemap, vibrance/saturation/contrast grading, TAA (or FXAA), sharpening, vignette |
| Dimensions | Overworld, Nether (biome-coloured fog, drifting smoke, lava bounce light, no shadow pass) and End (nebula sky with dust lanes, star field, violet haze, soft light shafts) |
| Fun | 3D see-through Nether portals with glowing depth layers, animated starfield on End portals and gateways |
| Motion blur | Camera motion blur with its own settings page (strength, quality, max length, frame-rate independent) |

## Performance tips

- Start with the **Medium** profile on a mid-range GPU, **Low** or **Potato** on integrated graphics.
- The biggest costs are *Shadow Resolution*, *Cloud Quality*, *Light Shaft Quality* and *SSAO*.
- *Shadow Distance* above your render distance does nothing useful. Keep it at or below it.

## Pack layout

```
shaders/
  shaders.properties   profiles, option menu, blend modes
  block.properties     block ids (waving plants, emissives, water, glass, metals...)
  entity.properties    entity ids
  lang/en_us.lang      option names
  lib/                 shared GLSL (sky, clouds, shadows, lighting, water, fog, tonemap...)
  program/             the actual programs, one file per pass with VSH/FSH sections
  world0/ world-1/ world1/ + root *.vsh/*.fsh   tiny per-dimension stubs that include program/
  textures/noise.png   256x256 noise texture used for clouds, water and sky
```

### Render pipeline

1. **shadow**: shadow map with distortion, waving foliage, water caustics and glass tint written to `shadowcolor0`.
2. **gbuffers_\***: opaque geometry writes albedo / normal + lightmap / material into `colortex0-2`.
   Translucents (water, glass, particles, rain) are forward-lit into a premultiplied buffer (`colortex3`).
3. **deferred**: lights the G-buffer and adds SSAO, sky, stars, aurora, volumetric clouds and fog.
4. **composite**: refraction, water absorption, translucent blending, SSR, volumetric light.
5. **composite1**: bloom from mipmaps, exposure, tonemap, color grading.
6. **composite2**: TAA with reprojection, Catmull-Rom history and neighborhood clamping (FXAA fallback).
7. **final**: contrast-adaptive sharpening, vignette, dithered output.

## Development

```
python3 shaderpacks/tools/generate.py   # regenerate dimension stubs, block.properties, noise.png
python3 shaderpacks/tools/validate.py   # compile every program for every dimension with glslangValidator
python3 shaderpacks/tools/package.py    # build release/Aurelia-v<version>.zip
```

`validate.py` accepts `--define NAME[=VALUE]` / `--undef NAME` to test other option combinations.
