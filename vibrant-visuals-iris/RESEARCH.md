# Vibrant Visuals: research notes

These notes are what this pack is based on. Most numbers come straight from Mojang's
own Vibrant Visuals files in the official
[Mojang/bedrock-samples](https://github.com/Mojang/bedrock-samples) resource pack
(atmospherics, lighting, fog, water, biome files, and 1,226 block plus 750 entity PBR
texture sets). The rest comes from Mojang's announcements, the Minecraft Wiki, and a
close look at the reference screenshots.

## What it is for

Mojang calls Vibrant Visuals the game "as you've always imagined it in your head". It is a
**deepening of the vanilla look, not a new art style**. Art director Jasper Boerstra said
it was inspired by how streamers and the community picture Minecraft. He also stressed
that **shadows and reflections stay pixelated**, so they fit the block world. It is purely
visual and changes no gameplay. Boerstra named water as one of his favourite improvements.

## Textures stay vanilla

- Every block keeps its vanilla colour texture. Vanilla VV adds only a **MERS** map
  (metalness, emissive, roughness, subsurface) per texture.
- **Normal maps exist only for water and lava** (`water_still_grey`, `water_flow_grey`,
  `lava_still`, `lava_flow`). Stone, wood, sand and leaves have no bumps.
- Sample values (0–255):

| Texture | Roughness | Subsurface | Other |
|---|---|---|---|
| stone, sand, oak log | ~188–199 (matte) | 0 | |
| grass block top | ~233 | 0 | |
| oak / jungle leaves | ~170–200 | **~135–150, varies per pixel** | |
| short grass | ~164 | ~128 | |
| glass | 0 (mirror) | 0 | metalness 89 |
| ice | ~150 | 255 | |
| glowstone | ~171 | 255 | emissive ~25 (max 41) |
| torch | | | emissive only on the flame pixels |
| **water** | **~22 (very glossy)** | 0 | metalness 18 |

## Water

- **Still the vanilla water texture** (`water_still_grey`), tinted by the biome colour.
  Bedrock's colours are brighter than Java's: plains/river `#44AFF5`, ocean `#1787D4`,
  warm ocean `#02B0E5` (opacity 0.55), swamp `#617B64` (opacity 0.65).
- **Normal map made from that texture.** It is almost flat (average tilt ~1°, max ~10°)
  and follows the vanilla ripple pattern. That is where the blocky sky reflections and
  the pixel-sized sun glints come from.
- `water.json`: **waves disabled**. No chlorophyll, sediment or CDOM (clear water).
  Caustics on: `frame_length 0.09` s (stepped animation), `scale 0.5`, `power 1`.
- Caustics are "randomly animated" and **pixelated**. Shadows don't fall underwater;
  missing caustics act as the shadow. Snell's window shows when looking up from below.
- Underwater fog uses the biome colour (plains `#44AFF5`) and fades over 60 blocks.
- In the screenshots: 1 block of water over sand is almost clear, cyan, with golden
  pixel caustics. Gravel shows through untinted. 2–3 block drop-offs turn solid medium
  blue, and the vanilla ripple pattern stays visible as light pixel streaks. Far away,
  the water is a calm mirror of the sky.

## Sun, moon, sky

- VV has its own **`sun_vv.png`**: the vanilla sun's 8×8 core only (orange rim, pale
  yellow ring, cream centre) **with the dim halo removed**. The glow around it is the
  atmosphere's glare plus bloom.
- Sky: `atmospherics.json` keyframes (zenith/horizon colours, Rayleigh 5–10, sun Mie 0.75
  at sunrise/sunset, glare shape, horizon blend stops), plus per-biome variants
  (desert, mesa, swamp, jungle…).
- Sun light: white `(255,227,215)` at noon, deep orange `(255,127,0)` at sunset.
  Moonlight is blue `(163,182,255)` at 0.4 lux against 100 lux for the sun.

## Shadows

- **Blocky by default:** shadows are quantized to the texture's texel size (16 per block),
  so every pixel is fully lit or fully shadowed. "Soft" is an option creators can pick.
- Shadows are sharp and match the casting objects. In the screenshots, shaded grass is a
  deep, still-saturated green.

## Leaves, plants, branches

- Leaves and grass use **subsurface scattering**: light glows through when backlit.
  Logs (branches) are plain matte vanilla textures.
- **No waving foliage.** Players have filed feedback asking for plant and water waves.

## Mobs and eyes

- In the entity MERS maps, **only the eyes glow**, and only a little (emissive ~32–64):
  spiders (red), Endermen (purple), Phantoms (green), Endermites. Allays and Glow Squids
  glow softly all over.
- **Player (Steve/Alex) and villager eyes do not glow.**
- Sheep wool, zombies and villagers have subsurface scattering (soft light through wool
  and skin).

## Fog and god rays

- Volumetric fog is set per biome: density 0.05 × scattering 0.04–0.06 (~0.0025 per
  block), Henyey-Greenstein g 0.4–0.6. It is in jungles, swamps, taiga, warm oceans,
  lush caves and more. The pale garden has dense fog (scattering 0.5).
- Distance fog only at the very edge of render distance (`fog_start 0.92`).

## Colour

- `color_grading.json`: contrast 1.15, saturation 1.05, gamma 2.2, "generic" tone mapper.
  White balance is 6500 K by default, warmer in hot biomes (warmish 4800 K, desert 4400 K).
- Lighting: sky intensity 1.0, a tiny flat ambient (0.02), and eye adaptation.

## Sources

- [Mojang/bedrock-samples (official VV resource pack data)](https://github.com/Mojang/bedrock-samples)
- [Minecraft.net: Vibrant Visuals](https://www.minecraft.net/en-us/article/minecraft-vibrant-visuals)
- [Xbox Wire: Vibrant Visuals transforms the game into what you've always imagined](https://news.xbox.com/en-us/2025/03/25/minecraft-vibrant-visuals/)
- [Minecraft Wiki: Vibrant Visuals](https://minecraft.wiki/w/Vibrant_Visuals) and [Water](https://minecraft.wiki/w/Water)
- [Microsoft Learn: shadows customization](https://learn.microsoft.com/en-us/minecraft/creator/documents/vibrantvisuals/shadowscustomization?view=minecraft-bedrock-stable)
- [Microsoft Learn: PBR overview](https://learn.microsoft.com/en-us/minecraft/creator/documents/vibrantvisuals/pbroverview?view=minecraft-bedrock-stable)
- [Microsoft Learn: atmospherics customization](https://learn.microsoft.com/en-us/minecraft/creator/documents/vibrantvisuals/atmosphericscustomization)
- [CGMagazine: Vibrant Visuals preview](https://www.cgmagonline.com/articles/previews/minecraft-vibrant-visuals/)
- [Digital Trends: makes the game look more like you imagine](https://www.digitaltrends.com/gaming/minecraft-vibrant-visuals-makes-game-look-more-like-you-imagine/)
- [Windows Central: what it gets right and where it falls short](https://www.windowscentral.com/gaming/minecraft/minecraft-vibrant-visuals-what-it-gets-right-and-where-it-falls-short)
- [Minecraft Feedback: "Waves for Vibrant Visuals"](https://feedback.minecraft.net/hc/en-us/community/posts/39317692008845-Waves-of-water)
- [Minecraft Feedback: "Less pixelated shadows on Vibrant Visuals"](https://feedback.minecraft.net/hc/en-us/community/posts/38368858924301-Less-pixelated-shadows-on-Vibrant-Visuals)
