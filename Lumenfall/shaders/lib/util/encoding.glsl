/*
    Lumenfall - G-buffer packing helpers
*/

// Octahedral normal encoding -> [0,1]^2
vec2 octWrap(vec2 v) { return (1.0 - abs(v.yx)) * vec2(v.x >= 0.0 ? 1.0 : -1.0, v.y >= 0.0 ? 1.0 : -1.0); }

vec2 encodeNormal(vec3 n) {
    n /= abs(n.x) + abs(n.y) + abs(n.z);
    n.xy = n.z >= 0.0 ? n.xy : octWrap(n.xy);
    return n.xy * 0.5 + 0.5;
}

vec3 decodeNormal(vec2 e) {
    e = e * 2.0 - 1.0;
    vec3 n = vec3(e, 1.0 - abs(e.x) - abs(e.y));
    float t = saturate(-n.z);
    n.xy += vec2(n.x >= 0.0 ? -t : t, n.y >= 0.0 ? -t : t);
    return normalize(n);
}

// Two 8-bit values in one 16-bit unorm channel
float pack2x8(vec2 v) {
    v = floor(saturate(v) * 255.0 + 0.5);
    return (v.x + v.y * 256.0) / 65535.0;
}

vec2 unpack2x8(float p) {
    float x = floor(p * 65535.0 + 0.5);
    float hi = floor(x / 256.0);
    return vec2(x - hi * 256.0, hi) / 255.0;
}

// RGB in 5-6-5 bits of one 16-bit unorm channel
float pack565(vec3 c) {
    vec3 q = floor(saturate(c) * vec3(31.0, 63.0, 31.0) + 0.5);
    return (q.r + q.g * 32.0 + q.b * 2048.0) / 65535.0;
}

vec3 unpack565(float p) {
    float x = floor(p * 65535.0 + 0.5);
    float b = floor(x / 2048.0);
    float g = floor((x - b * 2048.0) / 32.0);
    float r = x - b * 2048.0 - g * 32.0;
    return vec3(r, g, b) / vec3(31.0, 63.0, 31.0);
}

/*
    Translucent layer (colortex6, RGBA16):
      xy = world normal (oct), z = pack(mask, skylight), w = biome tint (565)

    G-buffer layout (opaque geometry):
      colortex1 RGBA8  : albedo.rgb (sRGB), materialId / 255
      colortex2 RGBA16 : mapped normal (oct), geometry normal (oct)          [world space]
      colortex3 RGBA16 : pack(smoothness, f0), pack(emission, sss), blocklight, skylight
*/

struct GData {
    vec3  albedo;     // linear
    int   matId;
    vec3  normal;     // world space, normal mapped
    vec3  geoNormal;  // world space, flat
    float smoothness;
    float f0;         // 0..229/255 dielectric reflectance, >= 230/255 metal (LabPBR)
    float emission;
    float sss;
    vec2  lightmap;   // x = block, y = sky
};

vec4 packGData1(vec3 albedoSrgb, int matId) { return vec4(albedoSrgb, float(matId) / 255.0); }
vec4 packGData2(vec3 n, vec3 gn)            { return vec4(encodeNormal(n), encodeNormal(gn)); }
vec4 packGData3(float smoothness, float f0, float emission, float sss, vec2 lm) {
    return vec4(pack2x8(vec2(smoothness, f0)), pack2x8(vec2(emission, sss)), lm);
}

GData unpackGData(vec4 g1, vec4 g2, vec4 g3) {
    GData d;
    d.albedo    = srgbToLinear(g1.rgb);
    d.matId     = int(g1.a * 255.0 + 0.5);
    d.normal    = decodeNormal(g2.xy);
    d.geoNormal = decodeNormal(g2.zw);
    vec2 sf = unpack2x8(g3.x);
    vec2 es = unpack2x8(g3.y);
    d.smoothness = sf.x;
    d.f0         = sf.y;
    d.emission   = es.x;
    d.sss        = es.y;
    d.lightmap   = g3.zw;
    return d;
}

bool isMetal(float f0) { return f0 >= 229.5 / 255.0; }

// LabPBR hardcoded metals (230-237) -> approximate F0 colors
vec3 metalF0(float f0, vec3 albedo) {
    int id = int(f0 * 255.0 + 0.5);
    if (id == 230) return vec3(0.56, 0.57, 0.58); // iron
    if (id == 231) return vec3(1.00, 0.71, 0.29); // gold
    if (id == 232) return vec3(0.91, 0.92, 0.92); // aluminium
    if (id == 233) return vec3(0.55, 0.56, 0.55); // chrome
    if (id == 234) return vec3(0.95, 0.64, 0.54); // copper
    if (id == 235) return vec3(0.63, 0.63, 0.63); // lead
    if (id == 236) return vec3(0.67, 0.67, 0.66); // platinum
    if (id == 237) return vec3(0.95, 0.93, 0.88); // silver
    return albedo;
}
