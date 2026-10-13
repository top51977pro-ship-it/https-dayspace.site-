// =====================================================================
//  Vibrant Visuals for Java - user settings
//  Every #define with a [list] comment shows up in the Iris shader menu.
// =====================================================================

// ---------- Shadows ----------
const int   shadowMapResolution = 2048; // [1024 1536 2048 3072 4096]
const float shadowDistance      = 128.0; // [64.0 96.0 128.0 160.0 192.0 256.0]
const float sunPathRotation     = -20.0; // [-40.0 -30.0 -20.0 -10.0 0.0 10.0 20.0 30.0 40.0]
const float shadowDistanceRenderMul = 1.0;
const float shadowIntervalSize  = 2.0;
const bool  shadowHardwareFiltering = false;

#define BLOCKY_SHADOWS            // Snap shadows to the 16x16 texel grid (Vibrant Visuals default)
#define SHADOW_SAMPLES 4          // [1 2 4 8 12 16] (each sample is bilinear-filtered)
#define SHADOW_SOFTNESS 1.0       // [0.5 0.75 1.0 1.5 2.0 3.0]

// ---------- Lighting ----------
#define SUN_BRIGHTNESS 1.0        // [0.5 0.75 1.0 1.25 1.5 2.0]
#define AMBIENT_BRIGHTNESS 1.0    // [0.5 0.75 1.0 1.25 1.5 2.0]
#define BLOCKLIGHT_BRIGHTNESS 1.0 // [0.5 0.75 1.0 1.25 1.5 2.0]
#define NIGHT_BRIGHTNESS 1.0      // [0.5 0.75 1.0 1.5 2.0 3.0]
#define EMISSIVE_STRENGTH 1.0     // [0.0 0.5 1.0 1.5 2.0 3.0]
#define SUBSURFACE_SCATTERING     // Light glowing through leaves and grass
//#define WAVING_PLANTS           // Wind on grass, flowers and leaves (Vibrant Visuals has none)
#define WAVING_STRENGTH 1.0       // [0.25 0.5 0.75 1.0 1.5 2.0]

// ---------- Sky ----------
#define SUN_GLOW 1.0              // [0.0 0.5 1.0 1.5 2.0]
#define SUN_DISC_BRIGHTNESS 1.0   // [0.25 0.5 1.0 1.5 2.0 3.0]
#define STAR_BRIGHTNESS 1.0       // [0.0 0.5 1.0 2.0 3.0]
#define CLOUD_OPACITY 0.65        // [0.3 0.4 0.5 0.65 0.8 0.9 1.0]

// ---------- Atmosphere ----------
#define VOLUMETRIC_LIGHT          // God rays / sun shafts through trees and caves
#define VL_SAMPLES 16             // [8 12 16 24 32]
#define VL_STRENGTH 1.0           // [0.25 0.5 0.75 1.0 1.5 2.0 3.0]
#define FOG_DENSITY 1.0           // [0.0 0.25 0.5 0.75 1.0 1.5 2.0 3.0]
#define MORNING_FOG 1.0           // [0.0 0.5 1.0 1.5 2.0 3.0]

// ---------- Water ----------
#define WATER_REFLECTIONS         // Screen space reflections on water and glass
#define WATER_CAUSTICS            // Light patterns under water
#define PIXELATED_WATER           // Snap the optional ocean waves to the 16x16 texel grid
#define WATER_WAVE_STRENGTH 0.0   // [0.0 0.25 0.5 0.75 1.0 1.5 2.0] Extra ocean waves (Vibrant Visuals has none)
#define WATER_CLARITY 1.0         // [0.5 0.75 1.0 1.5 2.0 3.0]
#define WATER_SPARKLE 1.0         // [0.0 0.5 1.0 1.5 2.0 3.0]

// ---------- Post processing ----------
#define BLOOM
#define BLOOM_STRENGTH 1.0        // [0.25 0.5 0.75 1.0 1.5 2.0 3.0]
#define EXPOSURE 1.0              // [0.5 0.75 0.9 1.0 1.1 1.25 1.5 2.0]
#define CONTRAST 1.08             // [1.0 1.05 1.08 1.1 1.15 1.2 1.25 1.3]
#define SATURATION 1.0            // [0.8 0.85 0.9 0.95 1.0 1.05 1.1 1.2 1.3 1.5]
#define VIBRANCE 0.0              // [0.0 0.05 0.1 0.15 0.2 0.3 0.4 0.5]
#define AUTO_EXPOSURE             // Brighten caves and nights like Vibrant Visuals
