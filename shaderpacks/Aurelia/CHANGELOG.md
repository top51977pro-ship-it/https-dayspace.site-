# Aurelia Shaders - Changelog

## v1.1
- **Water:** clear, natural colour instead of cyan. Shallow water stays see-through and deep
  water fades to a dark, neutral blue-green. Biome tint is toned down.
- **Waves:** bigger, calmer swells without the fine ripples. Refraction is about 3x weaker,
  so the sea floor no longer looks broken up from above. Caustics are softer.
- **Shadows and contrast:** stronger sunlight against weaker sky light, darker sides and
  undersides, deeper ambient occlusion, slightly more vivid default colour grading.
- **Sunbeams:** new screen-space sunbeams that stream from the sun past trees and terrain,
  and volumetric light shafts that are about twice as strong.
  Options: *Sunbeams*, *Sunbeam Strength*.
- **Rich Soil:** dirt, coarse dirt, rooted dirt, dirt paths, farmland and grass block sides are
  repainted as darker, richer soil with more surface relief. Option: *Rich Soil*.

## v1.0.2
- Bigger sun with a soft corona (*Sun Size* option), stronger light shafts, underwater shafts
  with caustic patterns, more natural water colours.

## v1.0.1
- Fixed "function signNotZero is already defined" error on Sodium terrain.

## v1.0
- First release.
