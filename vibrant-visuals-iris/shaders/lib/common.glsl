// =====================================================================
//  Shared uniforms and small helpers
// =====================================================================

uniform mat4 gbufferModelView;
uniform mat4 gbufferModelViewInverse;
uniform mat4 gbufferProjection;
uniform mat4 gbufferProjectionInverse;
uniform mat4 shadowModelView;
uniform mat4 shadowProjection;

uniform vec3 cameraPosition;
uniform vec3 sunPosition;
uniform vec3 moonPosition;
uniform vec3 shadowLightPosition;
uniform vec3 upPosition;
uniform vec3 fogColor;
uniform vec3 skyColor;

uniform float sunAngle;
uniform float rainStrength;
uniform float wetness;
uniform float frameTimeCounter;
uniform float viewWidth;
uniform float viewHeight;
uniform float near;
uniform float far;
uniform float nightVision;
uniform float blindness;
uniform float darknessFactor;

uniform int isEyeInWater;
uniform int frameCounter;
uniform ivec2 eyeBrightnessSmooth;

#if defined DIM_NETHER || defined DIM_END
    #define NO_SKY
#endif

const float PI  = 3.14159265359;
const float TAU = 6.28318530718;

// Material ids (see block.properties). Stored as mc_Entity.x - 10000.
#define MAT_NONE      0
#define MAT_PLANT     1   // grass, flowers, crops: wave from the top, lit like a flat surface
#define MAT_LEAVES    2   // leaves, vines: wave everywhere, subsurface scattering
#define MAT_WATER     3
#define MAT_EMISSIVE  4   // glowstone, sea lantern, shroomlight...
#define MAT_LIGHTSRC  5   // torches, lanterns, fire: only their bright pixels glow
#define MAT_GLASS     6   // glass, ice, slime: reflective translucents
#define MAT_LAVA      7
#define MAT_PLANT_TALL 8  // upper half of double plants: whole block waves
#define MAT_ENTITY_SSS 9  // sheep wool, zombie / villager skin: soft subsurface light

float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec2  saturate(vec2 x)  { return clamp(x, 0.0, 1.0); }
vec3  saturate(vec3 x)  { return clamp(x, 0.0, 1.0); }

float luminance(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 toLinear(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }
vec3 rgb255(float r, float g, float b) { return toLinear(vec3(r, g, b) / 255.0); }

// Henyey-Greenstein phase function
float phaseHG(float cosTheta, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * PI * pow(max(1.0 + g2 - 2.0 * g * cosTheta, 1e-4), 1.5));
}

// Remap vanilla lightmap coordinates (0.03..0.97) to 0..1
vec2 remapLightmap(vec2 lm) {
    return saturate((lm - 1.0 / 32.0) * (16.0 / 15.0));
}

// Octahedral normal encoding into 0..1
vec2 encodeNormal(vec3 n) {
    n /= abs(n.x) + abs(n.y) + abs(n.z);
    vec2 e = n.z >= 0.0 ? n.xy : (1.0 - abs(n.yx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);
    return e * 0.5 + 0.5;
}
vec3 decodeNormal(vec2 e) {
    e = e * 2.0 - 1.0;
    vec3 n = vec3(e, 1.0 - abs(e.x) - abs(e.y));
    float t = max(-n.z, 0.0);
    n.x += n.x >= 0.0 ? -t : t;
    n.y += n.y >= 0.0 ? -t : t;
    return normalize(n);
}

// Data stored in colortex1.z (16 bit): material slot * 0.25, plus sky and
// block light quantised to 64 levels each in the remaining 0.24.
#define DATA_WATER 1.0
#define DATA_GLASS 2.0
#define DATA_CLOUD 3.0
float packData(float slot, float skylight, float blocklight) {
    float v = floor(saturate(skylight) * 63.0 + 0.5) * 64.0 + floor(saturate(blocklight) * 63.0 + 0.5);
    return slot * 0.25 + (v + 0.5) / 4096.0 * 0.24;
}
float unpackSlot(float z) { return floor(z * 4.0 + 0.02); }
vec2 unpackLight(float z) {   // x: block light, y: sky light (same order as lmcoord)
    float v = floor((z - unpackSlot(z) * 0.25) / 0.24 * 4096.0);
    return vec2(mod(v, 64.0), floor(v / 64.0)) / 63.0;
}

vec3 screenToView(vec2 uv, float depth) {
    vec4 p = gbufferProjectionInverse * vec4(vec3(uv, depth) * 2.0 - 1.0, 1.0);
    return p.xyz / p.w;
}
vec3 viewToScreen(vec3 viewPos) {
    vec4 p = gbufferProjection * vec4(viewPos, 1.0);
    return (p.xyz / p.w) * 0.5 + 0.5;
}

// Hash / noise
float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}
float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Ordered dither, 0..1
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
float bayer16(vec2 a) { return bayer8(0.5 * a) * 0.25 + bayer2(a); }

float interleavedGradientNoise(vec2 p) {
    return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}
