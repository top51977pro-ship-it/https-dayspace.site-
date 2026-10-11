/*
    Aurelia Shaders - user settings
    Every #define with a [ ... ] list below is exposed in the Iris shader options menu.
*/

//==================================================================================//
//  Shadows                                                                         //
//==================================================================================//
const int shadowMapResolution = 2048; // [1024 1536 2048 3072 4096]
const float shadowDistance = 160.0; // [64.0 96.0 128.0 160.0 192.0 224.0 256.0]
const float sunPathRotation = -30.0; // [-45.0 -40.0 -35.0 -30.0 -25.0 -20.0 -15.0 -10.0 -5.0 0.0 5.0 10.0 15.0 20.0 25.0 30.0 35.0 40.0 45.0]
const float shadowDistanceRenderMul = 1.0;
const float ambientOcclusionLevel = 1.0; // [0.0 0.25 0.5 0.75 1.0]
const float eyeBrightnessHalflife = 6.0;
const float wetnessHalflife = 300.0;
const float drynessHalflife = 120.0;

#define SHADOW_SAMPLES 12 // [4 8 12 16 24 32]
#define SHADOW_SOFTNESS 1.0 // [0.0 0.5 1.0 1.5 2.0 3.0]
#define COLORED_SHADOWS
#define WATER_CAUSTICS
#define SHADOW_DISTORT 0.85

//==================================================================================//
//  Lighting                                                                        //
//==================================================================================//
#define SUN_INTENSITY 1.0 // [0.5 0.6 0.7 0.8 0.9 1.0 1.1 1.2 1.3 1.4 1.5 1.75 2.0]
#define AMBIENT_STRENGTH 1.0 // [0.5 0.6 0.7 0.8 0.9 1.0 1.1 1.2 1.3 1.4 1.5 1.75 2.0]
#define BLOCKLIGHT_STRENGTH 1.0 // [0.5 0.6 0.7 0.8 0.9 1.0 1.1 1.2 1.3 1.4 1.5 1.75 2.0]
#define BLOCKLIGHT_STYLE 0 // [0 1 2]
#define MIN_LIGHT 1.0 // [0.0 0.5 1.0 1.5 2.0 3.0 4.0]
#define HANDHELD_LIGHT
#define SSAO
#define SSAO_STRENGTH 1.0 // [0.25 0.5 0.75 1.0 1.25 1.5 2.0]
#define SSAO_SAMPLES 8 // [4 6 8 12 16]
#define SUBSURFACE_SCATTERING
#define GENERATED_NORMALS
#define GEN_NORMAL_STRENGTH 1.0 // [0.25 0.5 0.75 1.0 1.25 1.5 2.0 3.0]
#define EMISSIVE_STRENGTH 1.0 // [0.0 0.25 0.5 0.75 1.0 1.25 1.5 2.0 3.0]
//#define GLOWING_ORES
#define BLOCK_REFLECTIONS
#define RAIN_PUDDLES
//#define SOIL_RETEXTURE
#define PORTAL_EFFECT
#define PORTAL_BRIGHTNESS 1.0 // [0.25 0.5 0.75 1.0 1.25 1.5 2.0 3.0]
#define CLOUD_SHADOWS

//==================================================================================//
//  Atmosphere                                                                      //
//==================================================================================//
#define VOLUMETRIC_LIGHT
#define VL_STRENGTH 1.0 // [0.25 0.5 0.75 1.0 1.25 1.5 2.0 3.0]
#define VL_SAMPLES 12 // [6 8 12 16 24]
#define SUNBEAMS
#define SUNBEAM_STRENGTH 1.0 // [0.25 0.5 0.75 1.0 1.25 1.5 2.0 3.0]
#define VOLUMETRIC_CLOUDS
#define CLOUD_QUALITY 2 // [1 2 3]
#define CLOUD_COVERAGE 1.0 // [0.5 0.6 0.7 0.8 0.9 1.0 1.1 1.2 1.3 1.4 1.5]
#define CLOUD_ALTITUDE 192 // [128 160 192 224 256 320]
#define CLOUD_THICKNESS 96 // [48 64 96 128 160]
#define CLOUD_SPEED 1.0 // [0.0 0.25 0.5 1.0 1.5 2.0 3.0]
#define SUN_SIZE 1.0 // [0.5 0.75 1.0 1.25 1.5 2.0 2.5 3.0]
#define STARS
#define STAR_BRIGHTNESS 1.0 // [0.25 0.5 0.75 1.0 1.5 2.0 3.0]
#define AURORA
#define AURORA_STRENGTH 1.0 // [0.25 0.5 0.75 1.0 1.5 2.0]
#define FOG_DENSITY 1.0 // [0.0 0.25 0.5 0.75 1.0 1.25 1.5 2.0 3.0]
#define BORDER_FOG
#define END_NEBULA
#define DIMENSION_HAZE
#define HAZE_DENSITY 1.0 // [0.0 0.25 0.5 0.75 1.0 1.5 2.0 3.0]

//==================================================================================//
//  Water                                                                           //
//==================================================================================//
#define WATER_WAVES
#define WATER_WAVE_STRENGTH 1.0 // [0.25 0.5 0.75 1.0 1.25 1.5 2.0]
#define WATER_WAVE_SPEED 1.0 // [0.25 0.5 0.75 1.0 1.5 2.0]
#define WATER_REFLECTIONS
#define WATER_REFRACTION
#define WATER_OPACITY 0.15 // [0.0 0.05 0.1 0.15 0.2 0.3 0.4 0.5]
#define WATER_FOG_DENSITY 1.0 // [0.25 0.5 0.75 1.0 1.5 2.0 3.0]

//==================================================================================//
//  Waving geometry                                                                 //
//==================================================================================//
#define WAVING_PLANTS
#define WAVING_LEAVES
#define WAVING_SPEED 1.0 // [0.25 0.5 0.75 1.0 1.25 1.5 2.0]
#define WAVING_AMPLITUDE 1.0 // [0.25 0.5 0.75 1.0 1.25 1.5 2.0]

//==================================================================================//
//  Post processing                                                                 //
//==================================================================================//
#define TAA
#define SHARPENING 4 // [0 1 2 3 4 5 6 8 10]
#define BLOOM
#define BLOOM_STRENGTH 1.0 // [0.0 0.25 0.5 0.75 1.0 1.25 1.5 2.0 3.0]
#define EXPOSURE 1.0 // [0.5 0.6 0.7 0.8 0.9 1.0 1.1 1.2 1.3 1.4 1.5 1.75 2.0]
#define SATURATION 1.1 // [0.0 0.5 0.7 0.8 0.9 1.0 1.1 1.2 1.3 1.5]
#define VIBRANCE 1.2 // [0.8 0.9 1.0 1.05 1.1 1.15 1.2 1.3 1.4 1.5]
#define CONTRAST 1.05 // [0.8 0.9 0.95 1.0 1.05 1.1 1.2]
#define VIGNETTE
#define VIGNETTE_STRENGTH 1.0 // [0.25 0.5 0.75 1.0 1.25 1.5 2.0]

//==================================================================================//
//  Motion blur                                                                     //
//==================================================================================//
#define MOTION_BLUR
#define MOTION_BLUR_STRENGTH 1.0 // [0.25 0.5 0.75 1.0 1.25 1.5 2.0 3.0]
#define MOTION_BLUR_SAMPLES 8 // [4 6 8 12 16 24]
#define MOTION_BLUR_MAX_LENGTH 32 // [8 16 24 32 48 64 96 128]
#define MOTION_BLUR_FPS_INDEPENDENT
