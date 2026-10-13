# Mirage Textures 128x

A realistic 128x128 resource pack made to go with **Mirage Shaders**. Every texture is generated
from code (noise, cells, wood grain, brick layouts...) by `resourcepacks/tools/generate_textures.py`,
so the pack contains only original artwork, no edited or upscaled vanilla textures.

## Installation

1. Copy `MirageTextures_128x_v<version>.zip` into `.minecraft/resourcepacks/` (don't unzip it).
2. In game: **Options → Resource Packs**, move **MirageTextures** to the right side, click Done.

Blocks that aren't covered yet keep their vanilla texture.

## Blocks in v1.0 (59 textures)

- **Soil:** grass block (top, side, overlay, snowy side), dirt, coarse dirt, sand, red sand, gravel, clay, snow
- **Stone:** stone, deepslate (side + top), cobbled deepslate, cobblestone, mossy cobblestone,
  andesite, diorite, granite, bedrock, obsidian, netherrack, sandstone (side, top, bottom)
- **Ores:** coal, iron, copper, gold, redstone, lapis, diamond, emerald (stone and deepslate versions)
- **Wood:** oak, spruce and birch logs (bark + rings), planks and leaves
- **Built / other:** bricks, stone bricks, glass, ice, short grass

Grass, leaves and short grass are grayscale on purpose: Minecraft tints them with the biome colour.

## Building

```
python3 resourcepacks/tools/generate_textures.py   # regenerate all textures
python3 resourcepacks/tools/package_textures.py    # build release/MirageTextures_128x_v<version>.zip
```
