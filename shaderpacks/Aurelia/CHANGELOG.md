# Aurelia Shaders - Changelog

## v1.12
- **Rain & Puddles (new settings page):**
  - Puddles form on open, upward-facing ground while it rains and spread into larger pools
    during long storms, then dry up slowly afterwards (about 30 s half-life). Not in snowy biomes.
  - Raindrop impacts: every drop that lands in a puddle or on open water leaves a small splash
    and a ring that spreads out and fades.
  - Player wake: walking or swimming through puddles and water sends ripples out from your feet;
    the faster you move, the stronger they are.
  - Options: *Rain Puddles*, *Puddle Amount*, *Raindrop Ripples*, *Player Wake*, *Ripple Strength*.
- **Glowing Portal Edges:** a thin glowing rim where Nether portals meet their frame, detected in
  screen space (no voxel data needed). Option under *Nether & End*.
- Portal interior: a soft dark-violet veil between the streaks and it fades out when you stand
  inside the portal.
- Note: written from scratch. Complementary's code is not included (its license does not allow
  reusing parts of it here); only the general technique was studied.

## v1.11
- **Fixed full-bright players, mobs and animals:** entities were lit in the deferred pass, but
  recent Iris versions can draw them after that pass, so they showed up completely unlit (raw
  texture colours, even at night). Entities and block entities are now lit as they are drawn
  (sun/moon, shadows, sky light, block light, handheld light, fog), which works whatever order
  Iris uses.
- Glowing eyes (spiders, endermen, phantoms) and enchantment glint adjusted to match.

## v1.10
- **Nether portal colours matched to the reference screenshot:** streak colours were measured
  from the reference (edge 140,15,200 / main 200,12,234 / core 230,95,250) and solved back through
  Aurelia's tonemap and colour grading, so they appear with those exact on-screen colours.
  The Nether and End exposure is compensated so portals look the same in every dimension.

## v1.9
- **Nether portal glow halved:** the streaks were too bright in game. Same look, about half the
  brightness, so the colour stays a deep purple-magenta instead of glaring.

## v1.8
- **Nether portal matched to the reference look:** the window between the streaks is now clear
  (no violet tint), and every bright swirl pixel becomes a deep magenta dash with a short glowing
  trail extruded into the portal (10 thin layers in a shallow depth, combined with max() so they
  never pile up into a solid sheet).

## v1.7
- **Nether portal cleaned up:** up close or at an angle the depth layers shifted so far that
  they wrapped around the texture, turning the portal into a solid sheet of stretched, curved
  pink bands. Now there are 3 shallow layers instead of 6, and the shift is capped, so the
  streaks stay crisp and the gaps stay see-through from any distance or angle.

## v1.6
- **No more "sun" in the End:** removed the bright distant star from the End sky, turned off the
  screen-space sunbeams there, and made the End's light haze even instead of glowing towards
  the light direction. The End keeps its soft lighting and shadows, just without a visible source.

## v1.5
- **Nether portal fixed:** the glowing streaks never appeared in v1.4 because they were tuned
  for a brighter texture than the real one. Retuned and tested against the actual vanilla
  portal texture: vivid magenta streaks stacked in depth that stretch towards the centre like a
  tunnel, with see-through gaps and a violet haze. The portal code now lives in lib/portal.glsl.
- **Generated Normals is now off by default** (and no longer switched on by the quality
  presets), so block textures look like vanilla. It can still be enabled under Lighting.

## v1.4
- **Fixed glowing mobs and players:** block light at full strength was about 2.4x brighter than
  vanilla, and caves / the Nether added a big exposure boost on top, so anything next to lava,
  torches or portals washed out to white. Block light is now about 1.5x vanilla at its peak and
  the exposure boosts are much smaller.
- **Nether portal redone:** dark see-through window with distinct pink-violet streaks instead of
  a solid bright pink sheet. The streaks are still layered in depth.
- **Nether fog:** air is much clearer (fog about 2.5x thinner) and the drifting smoke is lighter
  and dimmer.

## v1.3
- **3D Nether portals:** see-through portals with bright pink-violet streaks stacked at several
  depths behind the surface, so they look like a glowing tunnel that shifts as you move.
  Portal particles (and other full-bright particles like flames and end rods) now glow.
  Options: *3D Nether Portal*, *Portal Glow*.
- **Nether:** fog follows each biome's own colour (crimson red, warped teal-violet, soul sand
  valley blue, basalt grey), drifting wisps of smoke, warm bounce light from lava on ceilings,
  stronger bloom.
- **End:** deeper sky with a richer nebula, dust lanes, more visible stars, a glowing distant
  star and slowly drifting violet haze around the islands.
- **Motion blur:** new *Motion Blur* settings page with Strength, Quality, Max Blur Length and
  Same Blur At Any FPS. Your hand always stays sharp.
- New *Nether & End* settings page.

## v1.2
- Dirt is back to its normal vanilla look. *Rich Soil* is now off by default (still available
  under Lighting for anyone who wants it).

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
