/*
    Lumenfall Shaders - shared header
    Included first by every program (after the per-dimension/per-program defines).
*/

#include "/lib/settings.glsl"
#include "/lib/buffers.glsl"

//----------------------------------------------------------------------------------//
// Uniforms (Iris only binds the ones a program actually uses)
//----------------------------------------------------------------------------------//
uniform int   frameCounter;
uniform int   isEyeInWater;
uniform int   worldTime;
uniform int   worldDay;
uniform int   moonPhase;
uniform int   heldBlockLightValue;
uniform int   heldBlockLightValue2;
uniform int   heldItemId;
uniform int   heldItemId2;
uniform int   entityId;
uniform int   blockEntityId;
uniform int   renderStage;

uniform float frameTime;
uniform float frameTimeCounter;
uniform float viewWidth;
uniform float viewHeight;
uniform float aspectRatio;
uniform float near;
uniform float far;
uniform float rainStrength;
uniform float wetness;
uniform float sunAngle;
uniform float nightVision;
uniform float blindness;
uniform float darknessFactor;
uniform float screenBrightness;
uniform float eyeAltitude;
uniform float centerDepthSmooth;

uniform ivec2 eyeBrightnessSmooth;
uniform ivec2 atlasSize;

uniform vec3  cameraPosition;
uniform vec3  previousCameraPosition;
uniform vec3  sunPosition;
uniform vec3  moonPosition;
uniform vec3  shadowLightPosition;
uniform vec3  upPosition;
uniform vec3  skyColor;
uniform vec3  fogColor;

uniform vec4  entityColor;
uniform vec4  lightningBoltPosition;

uniform mat4  gbufferModelView;
uniform mat4  gbufferModelViewInverse;
uniform mat4  gbufferProjection;
uniform mat4  gbufferProjectionInverse;
uniform mat4  gbufferPreviousModelView;
uniform mat4  gbufferPreviousProjection;
uniform mat4  shadowModelView;
uniform mat4  shadowModelViewInverse;
uniform mat4  shadowProjection;
uniform mat4  shadowProjectionInverse;

// Custom uniforms defined in shaders.properties
uniform float lf_caveFactor;      // 1 = deep underground / enclosed
uniform float lf_rain;            // smoothed rain strength
uniform float lf_snowyBiome;      // smoothed "cold biome" factor
uniform float lf_dryBiome;        // smoothed "no-rain biome" factor
uniform float lf_eyeSky;          // smoothed eye skylight (0..1)
uniform float lf_netherWastes;
uniform float lf_crimson;
uniform float lf_warped;
uniform float lf_basalt;
uniform float lf_soulValley;
uniform float lf_frameTimeSmooth;

//----------------------------------------------------------------------------------//
// Constants
//----------------------------------------------------------------------------------//
const float PI      = 3.14159265359;
const float TAU     = 6.28318530718;
const float HALF_PI = 1.57079632679;
const float INV_PI  = 0.31830988618;
const float GOLDEN_ANGLE = 2.39996322973;
const float PHI_INV = 0.61803398875;

#define saturate(x) clamp(x, 0.0, 1.0)

float sqr(float x) { return x * x; }
vec2  sqr(vec2 x)  { return x * x; }
vec3  sqr(vec3 x)  { return x * x; }
float pow4(float x) { x *= x; return x * x; }
float pow5(float x) { return pow4(x) * x; }
float maxOf(vec3 v) { return max(v.x, max(v.y, v.z)); }
float minOf(vec3 v) { return min(v.x, min(v.y, v.z)); }
float luminance(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float remap(float x, float a, float b, float c, float d) { return c + (x - a) * (d - c) / (b - a); }
float remapSat(float x, float a, float b) { return saturate((x - a) / (b - a)); }
float smoothRemap(float x, float a, float b) { return smoothstep(a, b, x); }

vec3 srgbToLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 linearToSrgb(vec3 c) { c = max(c, vec3(0.0)); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }

vec2 viewSize() { return vec2(viewWidth, viewHeight); }
vec2 texelSize() { return 1.0 / vec2(viewWidth, viewHeight); }

//----------------------------------------------------------------------------------//
// Time-of-day helpers
//----------------------------------------------------------------------------------//
vec3 sunDirWorld()   { return normalize(mat3(gbufferModelViewInverse) * sunPosition); }
vec3 moonDirWorld()  { return normalize(mat3(gbufferModelViewInverse) * moonPosition); }
vec3 lightDirWorld() { return normalize(mat3(gbufferModelViewInverse) * shadowLightPosition); }

// 0 at night, 1 during the day (smooth around the horizon)
float dayFactor()    { return smoothstep(-0.08, 0.08, sunDirWorld().y); }

//----------------------------------------------------------------------------------//
// TAA jitter (R2 / Halton 2,3 sequence, 8 phases)
//----------------------------------------------------------------------------------//
vec2 haltonJitter(int idx) {
    const vec2 seq[8] = vec2[8](
        vec2( 0.500000, 0.333333), vec2( 0.250000, 0.666667),
        vec2( 0.750000, 0.111111), vec2( 0.125000, 0.444444),
        vec2( 0.625000, 0.777778), vec2( 0.375000, 0.222222),
        vec2( 0.875000, 0.555556), vec2( 0.062500, 0.888889));
    return seq[idx & 7] - 0.5;
}
vec2 taaOffset() {
    #ifdef TAA
        return haltonJitter(frameCounter) / vec2(viewWidth, viewHeight);
    #else
        return vec2(0.0);
    #endif
}

struct LightInputs {
    vec3  lightDir;     // world, sun or moon
    vec3  lightCol;     // direct irradiance colour
    vec3  ambTop;       // sky ambient from above
    vec3  ambBottom;    // bounce from below / horizon
    float lightRadius;  // angular radius proxy for spec highlights
};

//----------------------------------------------------------------------------------//
// Hand depth: Minecraft renders the hand with a squashed depth range.
//----------------------------------------------------------------------------------//
const float HAND_DEPTH = 0.56;

//----------------------------------------------------------------------------------//
// Material IDs (stored as id/255 in colortex1.a)
//----------------------------------------------------------------------------------//
#define MAT_DEFAULT     0
#define MAT_FOLIAGE     1   // leaves - full SSS
#define MAT_PLANT       2   // grass, flowers, crops - SSS + up-normal shading
#define MAT_EMISSIVE    3   // light-emitting blocks
#define MAT_LAVA        4
#define MAT_METAL       5
#define MAT_SNOW        6
#define MAT_ENTITY      7
#define MAT_HAND        8
#define MAT_SKY         9
#define MAT_FIRE        10
#define MAT_ORE         11
#define MAT_GEM         12
#define MAT_POLISHED    13
#define MAT_ICE         14
#define MAT_SAND        15
#define MAT_TORCH       16
#define MAT_SCULK       17
#define MAT_END_PORTAL  18
#define MAT_LIGHTNING   19
#define MAT_GLOWING_ENT 20
#define MAT_BEAM        21
#define MAT_WOOD        22
#define MAT_STONE       23
#define MAT_PORTAL      24
#define MAT_AMETHYST    25

// Translucent mask (colortex6.b)
#define TMASK_NONE   0.0
#define TMASK_WATER  1.0
#define TMASK_GLASS  0.5
#define TMASK_ICE    0.75
#define TMASK_OTHER  0.25
