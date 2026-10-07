/*
    Lumenfall Shaders - user settings
    Every option here is exposed in the in-game shader menu (see shaders.properties).
*/

//==================================================================================//
// Shadows
//==================================================================================//
const int   shadowMapResolution   = 4096;  //[1024 2048 3072 4096 6144 8192 12288 16384]
const float shadowDistance        = 192.0; //[64.0 96.0 128.0 160.0 192.0 256.0 320.0 384.0 448.0 512.0]
const float shadowDistanceRenderMul = 1.0;
const float shadowIntervalSize    = 2.0;
const bool  shadowHardwareFiltering1 = true;
const bool  shadowtex0Nearest     = true;
const float sunPathRotation       = -25.0; //[-60.0 -50.0 -40.0 -35.0 -30.0 -25.0 -20.0 -15.0 -10.0 -5.0 0.0 5.0 10.0 15.0 20.0 25.0 30.0 35.0 40.0 50.0 60.0]

#define SHADOWS
#define SHADOW_FILTER 2              //[0 1 2]
#define SHADOW_SAMPLES 16            //[8 12 16 24 32 48 64 96]
#define SHADOW_BLOCKER_SAMPLES 8    //[6 8 12 16 24 32]
#define SHADOW_SOFTNESS 1.0          //[0.25 0.5 0.75 1.0 1.25 1.5 2.0 2.5 3.0 4.0]
#define COLORED_SHADOWS
#define SCREEN_SPACE_SHADOWS
#define ENTITY_SHADOWS
#define SSS_STRENGTH 1.0             //[0.0 0.25 0.5 0.75 1.0 1.25 1.5 2.0]

//==================================================================================//
// Lighting
//==================================================================================//
#define SUN_INTENSITY 1.0            //[0.5 0.6 0.7 0.8 0.9 1.0 1.1 1.2 1.3 1.4 1.5 1.75 2.0]
#define MOON_INTENSITY 1.0           //[0.25 0.5 0.75 1.0 1.25 1.5 2.0 3.0]
#define AMBIENT_INTENSITY 1.0        //[0.25 0.5 0.75 1.0 1.25 1.5 2.0]
#define BLOCKLIGHT_INTENSITY 1.0     //[0.25 0.5 0.75 1.0 1.25 1.5 2.0 2.5 3.0]
#define BLOCKLIGHT_TEMP 2900         //[1800 2200 2500 2900 3400 4000 5000 6500]
#define BLOCKLIGHT_FLICKER
#define HANDHELD_LIGHT
#define EMISSIVE_STRENGTH 1.0        //[0.25 0.5 0.75 1.0 1.5 2.0 3.0 4.0]
#define MIN_LIGHT 1.0                //[0.0 0.25 0.5 1.0 1.5 2.0 3.0]
#define AO_ENABLED
#define AO_SAMPLES 8                 //[4 6 8 12 16 24 32]
#define AO_RADIUS 1.5                //[0.5 0.75 1.0 1.5 2.0 2.5 3.0]
#define AO_STRENGTH 1.0              //[0.25 0.5 0.75 1.0 1.25 1.5 2.0]
#define VANILLA_AO_STRENGTH 0.6      //[0.0 0.2 0.4 0.6 0.8 1.0]
#define LIGHTNING_FLASH

//==================================================================================//
// Materials
//==================================================================================//
#define PBR_MODE 1                   //[0 1 2]
#define NORMAL_MAPPING
#define NORMAL_STRENGTH 1.0          //[0.25 0.5 0.75 1.0 1.25 1.5 2.0]
#define GENERATED_NORMALS
#define POM
#define POM_DEPTH 0.25               //[0.05 0.1 0.15 0.2 0.25 0.3 0.4 0.5 0.75 1.0]
#define POM_SAMPLES 48               //[16 32 48 64 96 128 192 256]
#define POM_DISTANCE 32              //[16 24 32 48 64 96 128]
#define POM_SHADOWS
#define WAVING_PLANTS
#define WAVING_STRENGTH 1.0          //[0.25 0.5 0.75 1.0 1.25 1.5 2.0]
#define WAVING_SPEED 1.0             //[0.25 0.5 0.75 1.0 1.25 1.5 2.0]
#define RAIN_PUDDLES
#define PUDDLE_AMOUNT 0.5            //[0.0 0.25 0.5 0.75 1.0]
#define SPECULAR_HIGHLIGHTS

//==================================================================================//
// Water
//==================================================================================//
#define WATER_WAVE_HEIGHT 1.0        //[0.0 0.25 0.5 0.75 1.0 1.25 1.5 2.0 3.0]
#define WATER_WAVE_SPEED 1.0         //[0.25 0.5 0.75 1.0 1.25 1.5 2.0 3.0]
#define WATER_WAVE_SCALE 1.0         //[0.5 0.75 1.0 1.25 1.5 2.0]
#define WATER_WAVE_OCTAVES 6         //[3 4 5 6 7 8 10 12 16]
#define WATER_VERTEX_WAVES
#define WATER_PARALLAX
#define WATER_REFRACTION
#define WATER_REFRACTION_STRENGTH 1.0 //[0.25 0.5 0.75 1.0 1.25 1.5 2.0 3.0]
#define WATER_CAUSTICS
#define WATER_CAUSTICS_STRENGTH 1.0  //[0.25 0.5 0.75 1.0 1.5 2.0 3.0]
#define WATER_FOAM
#define WATER_FOAM_STRENGTH 1.0      //[0.25 0.5 0.75 1.0 1.5 2.0]
#define WATER_FOG_DENSITY 1.0        //[0.25 0.5 0.75 1.0 1.25 1.5 2.0 3.0]
#define WATER_BIOME_TINT 0.5         //[0.0 0.25 0.5 0.75 1.0]
#define WATER_ABSORB_R 0.32          //[0.05 0.1 0.15 0.2 0.25 0.32 0.4 0.5 0.6 0.8]
#define WATER_ABSORB_G 0.075         //[0.02 0.04 0.06 0.075 0.1 0.125 0.15 0.2 0.3]
#define WATER_ABSORB_B 0.045         //[0.01 0.02 0.03 0.045 0.06 0.08 0.1 0.15 0.2]
#define UNDERWATER_DISTORTION
#define RAIN_RIPPLES

//==================================================================================//
// Reflections
//==================================================================================//
#define SSR
#define SSR_STEPS 24                 //[12 16 24 32 48 64 96 128]
#define SSR_REFINE_STEPS 6           //[0 4 6 8 10 12]
#define ROUGH_REFLECTIONS
#define PBR_REFLECTIONS
#define SKY_REFLECTIONS
//#define REFLECTION_CLOUDS

//==================================================================================//
// Atmosphere, fog & volumetrics
//==================================================================================//
#define ATMOSPHERE_STEPS 12          //[8 12 16 24 32]
#define FOG_DENSITY 1.0              //[0.0 0.25 0.5 0.75 1.0 1.25 1.5 2.0 3.0]
#define HEIGHT_FOG
#define HEIGHT_FOG_DENSITY 1.0       //[0.25 0.5 0.75 1.0 1.5 2.0 3.0 4.0]
#define RAIN_FOG_DENSITY 1.0         //[0.25 0.5 0.75 1.0 1.5 2.0 3.0]
#define CAVE_FOG
#define BORDER_FOG
#define VOLUMETRIC_LIGHT
#define VL_STEPS 16                  //[8 12 16 24 32 48 64 96]
#define VL_STRENGTH 1.0              //[0.25 0.5 0.75 1.0 1.25 1.5 2.0 3.0]
#define VL_NIGHT_STRENGTH 1.0        //[0.0 0.25 0.5 0.75 1.0 1.5 2.0]
#define UNDERWATER_VL

//==================================================================================//
// Clouds
//==================================================================================//
#define VOLUMETRIC_CLOUDS
#define CLOUD_STEPS 32               //[16 24 32 48 64 96 128 192]
#define CLOUD_LIGHT_STEPS 5          //[3 4 5 6 8 10 12 16]
#define CLOUD_COVERAGE 0.5           //[0.0 0.1 0.2 0.3 0.4 0.5 0.6 0.7 0.8 0.9 1.0]
#define CLOUD_DENSITY 1.0            //[0.25 0.5 0.75 1.0 1.25 1.5 2.0 3.0]
#define CLOUD_ALTITUDE 320           //[192 256 320 384 448 512 640 768]
#define CLOUD_THICKNESS 280          //[96 128 192 280 384 512]
#define CLOUD_SCALE 1.0              //[0.5 0.75 1.0 1.25 1.5 2.0 3.0]
#define CLOUD_SPEED 1.0              //[0.0 0.25 0.5 1.0 1.5 2.0 3.0 5.0]
#define CLOUD_DETAIL 2               //[0 1 2 3]
#define CLOUD_TEMPORAL 2             //[1 2]
#define CLOUD_SHADOWS
#define CIRRUS_CLOUDS

//==================================================================================//
// Sky
//==================================================================================//
#define SUN_SIZE 1.0                 //[0.5 0.75 1.0 1.5 2.0 3.0]
#define MOON_SIZE 1.0                //[0.5 0.75 1.0 1.5 2.0 3.0]
#define STARS
#define STAR_AMOUNT 1.0              //[0.25 0.5 0.75 1.0 1.5 2.0 3.0]
#define MILKY_WAY
#define MILKY_WAY_STRENGTH 1.0       //[0.25 0.5 0.75 1.0 1.5 2.0 3.0]
#define SHOOTING_STARS
#define AURORA 1                     //[0 1 2]
#define RAINBOWS

//==================================================================================//
// Camera & post-processing
//==================================================================================//
#define TAA
#define TAA_BLEND 0.92               //[0.80 0.85 0.88 0.90 0.92 0.94 0.96]
#define SHARPENING 0.45              //[0.0 0.15 0.3 0.45 0.6 0.75 1.0]
#define BLOOM
#define BLOOM_STRENGTH 0.10          //[0.02 0.04 0.06 0.08 0.10 0.12 0.15 0.2 0.25 0.3 0.4]
#define BLOOM_RADIUS 1.0             //[0.5 0.75 1.0 1.25 1.5 2.0]
#define ANAMORPHIC_STREAKS 0.0       //[0.0 0.1 0.2 0.3 0.5 0.75 1.0]
#define LENS_FLARE
#define LENS_FLARE_STRENGTH 1.0      //[0.25 0.5 0.75 1.0 1.5 2.0 3.0]

//#define DOF
#define DOF_FOCUS_MODE 0             //[0 1]
#define DOF_FOCUS_DISTANCE 16.0      //[1.0 2.0 3.0 4.0 6.0 8.0 12.0 16.0 24.0 32.0 48.0 64.0 96.0 128.0 256.0]
#define DOF_INTENSITY 1.0            //[0.25 0.5 0.75 1.0 1.5 2.0 3.0 4.0 6.0 8.0]
#define DOF_MAX_RADIUS 24.0          //[8.0 12.0 16.0 24.0 32.0 48.0 64.0]
#define DOF_SAMPLES 48               //[16 32 48 64 96 128 192 256]
#define DOF_BLADES 0                 //[0 5 6 7 8]
#define DOF_BOKEH_HIGHLIGHTS 1.0     //[0.0 0.5 1.0 1.5 2.0 3.0]
#define DOF_CHROMATIC
#define DOF_NEAR_BLUR
const float centerDepthHalflife = 1.0; //[0.1 0.25 0.5 1.0 1.5 2.0 3.0 4.0]

//#define MOTION_BLUR
#define MOTION_BLUR_STRENGTH 1.0     //[0.1 0.25 0.5 0.75 1.0 1.25 1.5 2.0 3.0]
#define MOTION_BLUR_SAMPLES 12       //[6 8 12 16 24 32 48 64]

#define AUTO_EXPOSURE
#define EXPOSURE 0.0                 //[-3.0 -2.5 -2.0 -1.5 -1.0 -0.75 -0.5 -0.25 0.0 0.25 0.5 0.75 1.0 1.5 2.0 2.5 3.0]
#define AE_SPEED 1.0                 //[0.25 0.5 1.0 2.0 4.0]
#define TONEMAP 0                    //[0 1 2 3]
#define CONTRAST 1.05                //[0.8 0.85 0.9 0.95 1.0 1.05 1.1 1.15 1.2 1.3]
#define SATURATION 1.05              //[0.0 0.5 0.75 0.85 0.9 0.95 1.0 1.05 1.1 1.15 1.2 1.3 1.5]
#define VIBRANCE 1.1                 //[0.5 0.75 0.9 1.0 1.1 1.2 1.3 1.5]
#define WHITE_BALANCE 6500           //[4000 4500 5000 5500 6000 6500 7000 7500 8000 9000 10000]
#define SPLIT_TONING 0.5             //[0.0 0.25 0.5 0.75 1.0 1.5]
#define VIGNETTE 0.35                //[0.0 0.1 0.2 0.3 0.35 0.4 0.5 0.6 0.8 1.0]
#define FILM_GRAIN 0.0               //[0.0 0.05 0.1 0.15 0.2 0.3 0.5]
#define CHROMATIC_ABERRATION 0.0     //[0.0 0.1 0.2 0.3 0.5 0.75 1.0]
#define LETTERBOX 0.0                //[0.0 1.85 2.0 2.2 2.39 2.76]
#define PURKINJE

//==================================================================================//
// Dimensions
//==================================================================================//
#define NETHER_FOG_DENSITY 1.0       //[0.25 0.5 0.75 1.0 1.5 2.0 3.0]
#define NETHER_HEAT_HAZE
#define END_NEBULA
#define END_FOG_DENSITY 1.0          //[0.25 0.5 0.75 1.0 1.5 2.0 3.0]

//==================================================================================//
// Info (menu only)
//==================================================================================//
#define LUMENFALL_VERSION 1          //[1]
