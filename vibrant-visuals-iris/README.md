# Vibrant Visuals for Java (Iris shader pack)

A shader pack for **Minecraft Java 26.3 (Fabric + Iris)** that recreates the look of
Bedrock's **Vibrant Visuals** graphics mode. It uses Mojang's own default Vibrant Visuals
settings (from `Mojang/bedrock-samples`) for the sky colours, sun colours, light
intensity, tone mapping and water.

![Sky preview at different times of day](sky-preview.png)

![Water preview: noon and facing the sun](water-preview.png)

*These previews are rendered from this pack's real GLSL code (headless WebGL,
with a simple test seabed). They are not in-game screenshots.*

## Install (Minecraft 26.3)

1. Install **Fabric Loader** for 26.3, plus **Fabric API**.
2. Put **Sodium 0.9.2** (or newer for 26.3) and **Iris 1.11.7** (or newer for 26.3) in `mods/`.
3. Copy `release/VibrantVisualsJava.zip` into `.minecraft/shaderpacks/`.
   You can also copy the `vibrant-visuals-iris` folder there, as long as it contains `shaders/`.
4. In game, open **Options → Video Settings → Shader Packs** and pick *VibrantVisualsJava*.

## What Vibrant Visuals changes, and how this pack does it

| Vibrant Visuals (Bedrock) | Vanilla Java | This pack |
|---|---|---|
| Sun shadows that move through the day | Only smooth-lighting AO | Shadow map with soft PCF filtering, normal-offset bias, and a fallback to the skylight value past shadow range |
| Sun colour keyframed over the day: white at noon, orange `(255,127,0)` at sunset | Flat, uncoloured light | Exact `lighting/global.json` sun colour and illuminance keyframes |
| Atmospheric sky: zenith and horizon colours, Rayleigh, sun Mie glow, glare, horizon blend stops | Two flat colours | Port of `atmospherics.json`: all keyframes plus the 3-band shape (horizon, blend start, Mie bump around the sun) |
| Volumetric fog and haze, with distant hills fading out | Linear fog | Ray-marched god rays through the shadow map, a sky-coloured distance haze (orange toward the sun at sunset), stronger fog at sunrise, and border fog at the edge of render distance |
| Water: crystal clear, turquoise shallows, deep blue depths, mirror reflections far away, pixel sparkles, caustics | Flat, semi-opaque texture | The water is shaded in a post pass that can see the scene behind it. It uses **per-channel pure-water absorption** (Bedrock's `water.json` has no sediment or chlorophyll), so red fades first: sand under 1–2 blocks turns turquoise and deep water turns blue. Also: refraction, Fresnel and screen-space reflections, **pixel-snapped waves with per-texel sparkle** (calm toward the distance so far water becomes a mirror), sharp blocky sun glints, and fine pixel caustics on the sea floor |
| Translucent clouds lit by the sun | White clouds | Clouds lit by sun, sky and horizon colour, with a warm forward-scatter rim at sunset |
| Glowing emissive blocks, bloom around the sun | No bloom | Emissive glowstone, lanterns, torches and lava, and mip-chain bloom |
| `color_grading.json`: contrast 1.15, saturation 1.05, "generic" tone mapper | None | Same contrast and saturation, the Lottes "generic" filmic curve, and eye adaptation for caves and nights |
| Foliage | Flat | Subsurface glow through leaves and grass when backlit; optional gentle wind |

Nether and End get their own simpler lighting and fog, with no shadow pass.

## Settings

Open **Shader Pack Settings** to choose a profile (Low / Medium / High / Ultra) or to tune
individual options:

- **Lighting:** sun, sky light, torch light, night brightness, glowing blocks, leaf glow, waving plants
- **Shadows:** resolution, distance, filter samples, softness, sun path angle
- **Sky:** sun glow, sun brightness, stars, cloud opacity
- **Atmosphere:** god rays (on/off, quality, strength), haze density, sunrise fog
- **Water:** reflections, caustics, pixel waves, wave height, clarity, pixel sparkle
- **Camera:** bloom, eye adaptation, exposure, contrast, saturation, vibrance

For Vibrant Visuals' straight overhead sun path, set *Sun Path Angle* to 0.
The default (-20°) gives nicer noon shadows.

## Layout

```
shaders/
  shaders.properties   menu, profiles, Iris flags
  block.properties     block -> material ids (plants, leaves, water, emissive, glass, lava)
  lang/en_us.lang      option names
  lib/                 shared code
    atmosphere.glsl    Vibrant Visuals keyframes + sky model
    lighting.glsl      sun / sky / torch / subsurface lighting
    shadows.glsl       shadow distortion + PCF
    water.glsl         pixel waves + caustics
    tonemap.glsl       colour grading + generic tone mapper
  program/             the real shader sources
  *.vsh / *.fsh        tiny stubs (overworld); world-1/ = Nether, world1/ = End
tools/generate-stubs.sh  regenerates the stubs
```

After adding a program to `tools/generate-stubs.sh`, run it again.

## Known limits

- Vibrant Visuals uses per-texture PBR maps (MER / normal maps). This pack lights vanilla
  textures and does not read LabPBR resource packs yet.
- Reflections are screen space. Anything off screen is replaced by the sky.
- The pack was compile-checked with `glslangValidator`, and the sky was previewed in WebGL.
  It has not been run in-game yet, so some values may need tuning with the in-game sliders.
