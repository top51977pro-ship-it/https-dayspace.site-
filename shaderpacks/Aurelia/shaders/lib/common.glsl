// Shared constants and helper functions.

#define PI  3.14159265359
#define TAU 6.28318530718
#define saturate(x) clamp(x, 0.0, 1.0)

// ---- block / entity ids (see block.properties, entity.properties) ----
#define ID_PLANT        10001
#define ID_TALL_LOWER   10002
#define ID_TALL_UPPER   10003
#define ID_LEAVES       10004
#define ID_VINES        10005
#define ID_WATER_PLANT  10006
#define ID_WATER        10010
#define ID_GLASS        10011
#define ID_ICE          10012
#define ID_NETHER_PORTAL 10013
#define ID_EMISSIVE     10020
#define ID_LAVA         10021
#define ID_LIGHT_SOURCE 10022
#define ID_ORE          10030
#define ID_METAL        10040
#define ID_POLISHED     10041
#define ID_END_PORTAL   10050
#define ID_LIGHTNING    10100

// ---- material ids stored in colortex2.r ----
#define MAT_NONE        0
#define MAT_TERRAIN     1
#define MAT_PLANT       2
#define MAT_LEAVES      3
#define MAT_WATER       4
#define MAT_GLASS       5
#define MAT_METAL       6
#define MAT_ENTITY      7
#define MAT_PASSTHROUGH 250

float encodeMat(int m) { return float(m) / 255.0; }
int   decodeMat(float v) { return int(v * 255.0 + 0.5); }

float sq(float x) { return x * x; }
float pow5(float x) { float x2 = x * x; return x2 * x2 * x; }
float maxOf(vec3 v) { return max(v.x, max(v.y, v.z)); }
float luminance(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
vec3 toGamma(vec3 c) { return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2)); }

// ---- normal encoding (octahedral) ----
vec2 octWrapSign(vec2 v) { return vec2(v.x >= 0.0 ? 1.0 : -1.0, v.y >= 0.0 ? 1.0 : -1.0); }

vec2 encodeNormal(vec3 n) {
    n /= abs(n.x) + abs(n.y) + abs(n.z);
    vec2 e = n.z >= 0.0 ? n.xy : (1.0 - abs(n.yx)) * octWrapSign(n.xy);
    return e * 0.5 + 0.5;
}

vec3 decodeNormal(vec2 e) {
    e = e * 2.0 - 1.0;
    vec3 n = vec3(e, 1.0 - abs(e.x) - abs(e.y));
    if (n.z < 0.0) n.xy = (1.0 - abs(n.yx)) * octWrapSign(n.xy);
    return normalize(n);
}

// ---- dithering ----
float interleavedGradientNoise(vec2 p) {
    return fract(52.9829189 * fract(0.06711056 * p.x + 0.00583715 * p.y));
}

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
}

// ---- texture noise (textures/noise.png: R = white noise, G = R shifted by 37 texels in x, B/A = extra) ----
float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return textureLod(noisetex, (i + f + 0.5) / 256.0, 0.0).r;
}

float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    vec2 uv = i.xy + vec2(37.0, 0.0) * i.z + f.xy;
    vec2 rg = textureLod(noisetex, (uv + 0.5) / 256.0, 0.0).rg;
    return mix(rg.r, rg.g, f.z);
}

vec2 vogelDisk(int i, int n, float phi) {
    float r = sqrt((float(i) + 0.5) / float(n));
    float theta = float(i) * 2.39996323 + phi;
    return r * vec2(cos(theta), sin(theta));
}

// Henyey-Greenstein phase function (normalized to 1 at g = 0 for convenience)
float phaseHG(float cosTheta, float g) {
    float g2 = g * g;
    return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5);
}

float schlick(float cosTheta, float f0) {
    return f0 + (1.0 - f0) * pow5(1.0 - saturate(cosTheta));
}

// GGX specular term (already multiplied by NdotL)
float specularGGX(vec3 n, vec3 v, vec3 l, float roughness, float f0) {
    vec3 h = normalize(l + v);
    float NdotL = saturate(dot(n, l));
    float NdotH = saturate(dot(n, h));
    float NdotV = saturate(dot(n, v)) + 1e-3;
    float a = max(roughness * roughness, 0.002);
    float a2 = a * a;
    float d = NdotH * NdotH * (a2 - 1.0) + 1.0;
    float D = a2 / (PI * d * d);
    float k = a * 0.5;
    float G = NdotL / (NdotL * (1.0 - k) + k) * NdotV / (NdotV * (1.0 - k) + k);
    float F = schlick(saturate(dot(h, v)), f0);
    return D * G * F / (4.0 * NdotV) ;
}
