// Opaque geometry -> G-buffer (terrain, entities, block entities).
// Expects one of PROG_TERRAIN / PROG_ENTITIES / PROG_BLOCK to be defined.

#include "/lib/settings.glsl"
#include "/lib/uniforms.glsl"
#include "/lib/common.glsl"
#include "/lib/transforms.glsl"

//==================================================================================//
#ifdef VSH

in vec4 mc_Entity;
in vec4 mc_midTexCoord;
in vec4 at_tangent;

out vec2 texcoord;
out vec2 lmcoord;
out vec4 glcolor;
out vec3 normalW;
out vec4 tangentW;
out vec3 playerPos;
out vec2 midCoord;
out vec2 texHalf;
flat out int blockId;

#include "/lib/waving.glsl"

void main() {
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    lmcoord = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
    lmcoord = saturate((lmcoord - 1.0 / 32.0) * 16.0 / 15.0);
    glcolor = gl_Color;

    vec3 viewPos = (gl_ModelViewMatrix * gl_Vertex).xyz;
    playerPos = viewToPlayer(viewPos);

    normalW = normalize(mat3(gbufferModelViewInverse) * (gl_NormalMatrix * gl_Normal));
    vec3 t = gl_NormalMatrix * at_tangent.xyz;
    tangentW = vec4(dot(t, t) > 1e-6 ? normalize(mat3(gbufferModelViewInverse) * t) : vec3(1.0, 0.0, 0.0),
                    at_tangent.w < 0.0 ? -1.0 : 1.0);

    midCoord = mc_midTexCoord.xy;
    texHalf = abs(texcoord - mc_midTexCoord.xy);

    #if defined PROG_TERRAIN
    blockId = int(mc_Entity.x + 0.5);
    bool isTop = texcoord.y < mc_midTexCoord.y;
    playerPos = applyWaving(playerPos, blockId, isTop, lmcoord.y);
    #elif defined PROG_ENTITIES
    blockId = entityId;
    #elif defined PROG_BLOCK
    blockId = blockEntityId;
    #else
    blockId = 0;
    #endif

    gl_Position = gl_ProjectionMatrix * vec4(playerToView(playerPos), 1.0);
    applyTAAJitter(gl_Position);
}

#endif
//==================================================================================//
#ifdef FSH

in vec2 texcoord;
in vec2 lmcoord;
in vec4 glcolor;
in vec3 normalW;
in vec4 tangentW;
in vec3 playerPos;
in vec2 midCoord;
in vec2 texHalf;
flat in int blockId;

#if defined PROG_ENTITIES || defined PROG_BLOCK
// Entities and block entities are lit right here (forward) and stored as "passthrough".
// Recent Iris versions can draw them after the deferred lighting pass, which left them
// completely unlit (full-bright) when they relied on it.
#define FORWARD_LIT
#include "/lib/atmosphere.glsl"
#include "/lib/sky.glsl"
#include "/lib/shadows.glsl"
#ifdef OVERWORLD
#include "/lib/clouds.glsl"
#endif
#include "/lib/lighting.glsl"
#include "/lib/fog.glsl"
#endif

/* RENDERTARGETS: 0,1,2 */
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outData;
layout(location = 2) out vec4 outMaterial;

#ifdef PROG_TERRAIN
float heightSample(vec2 coord, vec2 tileMin, vec2 tileSize) {
    coord = tileMin + mod(coord - tileMin, tileSize);
    vec4 s = textureLod(gtexture, coord, 0.0);
    return s.a < 0.1 ? -1.0 : luminance(s.rgb);
}

vec3 generatedNormal(vec3 n, float dist, float boost) {
    float strength = GEN_NORMAL_STRENGTH * boost * (1.0 - smoothstep(12.0, 40.0, dist));
    if (strength <= 0.0 || texHalf.x < 1e-6) return n;

    vec2 atlasTexel = 1.0 / vec2(textureSize(gtexture, 0));
    vec2 tileMin = midCoord - texHalf;
    vec2 tileSize = texHalf * 2.0;

    float hc = heightSample(texcoord, tileMin, tileSize);
    float hl = heightSample(texcoord - vec2(atlasTexel.x, 0.0), tileMin, tileSize);
    float hr = heightSample(texcoord + vec2(atlasTexel.x, 0.0), tileMin, tileSize);
    float hd = heightSample(texcoord - vec2(0.0, atlasTexel.y), tileMin, tileSize);
    float hu = heightSample(texcoord + vec2(0.0, atlasTexel.y), tileMin, tileSize);
    if (hl < 0.0) hl = hc;
    if (hr < 0.0) hr = hc;
    if (hd < 0.0) hd = hc;
    if (hu < 0.0) hu = hc;

    vec3 tangentNormal = normalize(vec3((hl - hr) * strength * 1.6, (hd - hu) * strength * 1.6, 1.0));
    vec3 T = normalize(tangentW.xyz - n * dot(tangentW.xyz, n));
    vec3 B = cross(n, T) * tangentW.w;
    // B = cross(N, T) * w follows +v (Iris tangent convention), matching the height gradient above
    return normalize(T * tangentNormal.x + B * tangentNormal.y + n * tangentNormal.z);
}
#endif

#if defined PROG_TERRAIN && defined SOIL_RETEXTURE
// Turns the noisy orange vanilla dirt into darker, richer soil. Works on luminance only,
// so moist farmland, paths and coarse dirt keep their own brightness patterns.
vec3 retextureSoil(vec3 c) {
    vec2 o = texHalf * 0.5;
    float avg = 0.0;
    avg += luminance(textureLod(gtexture, midCoord + vec2( o.x,  o.y), 0.0).rgb);
    avg += luminance(textureLod(gtexture, midCoord + vec2(-o.x,  o.y), 0.0).rgb);
    avg += luminance(textureLod(gtexture, midCoord + vec2( o.x, -o.y), 0.0).rgb);
    avg += luminance(textureLod(gtexture, midCoord + vec2(-o.x, -o.y), 0.0).rgb);
    avg += luminance(textureLod(gtexture, midCoord, 0.0).rgb);
    avg *= 0.2;

    float l = luminance(c);
    l = mix(l, avg, 0.35);                              // calm the harsh pixel noise
    float t = saturate((l - 0.20) / 0.40);
    vec3 soil = mix(vec3(0.19, 0.125, 0.080), vec3(0.50, 0.375, 0.255), t * t * (3.0 - 2.0 * t));
    float pebble = smoothstep(0.62, 0.75, luminance(c));  // keep light stones/pebbles a bit grey
    soil = mix(soil, vec3(luminance(c)) * vec3(0.92, 0.90, 0.86), pebble * 0.6);
    return mix(soil, c, 0.12);
}
#endif

#ifdef PROG_BLOCK
vec3 endPortalStars(vec3 dir) {
    vec3 col = vec3(0.012, 0.018, 0.035);
    for (int i = 0; i < 4; i++) {
        float layer = float(i + 1);
        vec2 p = playerPos.xz + cameraPosition.xz;
        p = p * (0.6 + layer * 0.35) + dir.xz * layer * 2.0 + frameTimeCounter * 0.05 * layer;
        vec2 cell = floor(p * 6.0);
        float h = hash12(cell + layer * 17.0);
        float d = length(fract(p * 6.0) - 0.5);
        float star = smoothstep(0.25, 0.0, d) * step(0.93, h);
        vec3 tint = mix(vec3(0.20, 0.90, 0.80), vec3(0.65, 0.35, 1.00), hash12(cell + 3.0));
        col += tint * star * (1.6 / layer);
    }
    return col;
}
#endif

void main() {
    vec4 albedo = texture(gtexture, texcoord) * glcolor;

    #ifdef PROG_ENTITIES
    albedo.rgb = mix(albedo.rgb, entityColor.rgb, entityColor.a);
    #endif

    if (albedo.a < 0.1) discard;

    vec3 normal = normalize(normalW);
    int material = MAT_TERRAIN;
    float smoothness = 0.0;
    float emission = 0.0;
    float subsurface = 0.0;

    #if defined PROG_TERRAIN
    float dist = length(playerPos);
    float lum = luminance(albedo.rgb);

    if (blockId == ID_PLANT || blockId == ID_TALL_LOWER || blockId == ID_TALL_UPPER || blockId == ID_WATER_PLANT) {
        material = MAT_PLANT;
        normal = vec3(0.0, 1.0, 0.0);
        subsurface = 0.6;
    } else if (blockId == ID_LEAVES || blockId == ID_VINES) {
        material = MAT_LEAVES;
        subsurface = 0.55;
    } else if (blockId == ID_EMISSIVE) {
        emission = 0.15 + pow(lum, 1.6) * 1.1;
    } else if (blockId == ID_LAVA) {
        emission = 1.0;
    } else if (blockId == ID_LIGHT_SOURCE) {
        emission = smoothstep(0.62, 0.95, maxOf(albedo.rgb)) * 1.1;
    } else if (blockId == ID_ORE) {
        #ifdef GLOWING_ORES
        float sat = maxOf(albedo.rgb) - min(albedo.r, min(albedo.g, albedo.b));
        emission = smoothstep(0.22, 0.5, sat) * 0.45;
        #endif
    } else if (blockId == ID_METAL) {
        material = MAT_METAL;
        smoothness = 0.78;
    } else if (blockId == ID_POLISHED) {
        smoothness = 0.45;
    } else if (blockId == ID_ICE) {
        smoothness = 0.85;
    }

    float normalBoost = 1.0;
    #ifdef SOIL_RETEXTURE
    if (blockId == ID_SOIL) {
        // vertex colour is grey (only AO) on dirt faces, green on tinted grass top/overlay
        bool tinted = abs(glcolor.r - glcolor.g) > 0.03 || abs(glcolor.g - glcolor.b) > 0.03;
        vec3 tex = albedo.rgb / max(glcolor.rgb, vec3(1e-3));
        bool brownish = tex.r >= tex.g * 0.95 && tex.r > tex.b;
        if (!tinted && brownish) {
            albedo.rgb = retextureSoil(tex) * glcolor.rgb;
            normalBoost = 1.6;
        }
    }
    #endif

    #ifdef GENERATED_NORMALS
    if (material != MAT_PLANT) normal = generatedNormal(normal, dist, normalBoost);
    #endif

    #ifdef RAIN_PUDDLES
    if (wetness > 0.001 && material != MAT_PLANT && material != MAT_LEAVES) {
        float exposed = smoothstep(0.85, 0.95, lmcoord.y);
        float up = smoothstep(0.6, 0.95, normalW.y);
        vec2 wp = playerPos.xz + cameraPosition.xz;
        float puddle = smoothstep(0.42, 0.62, noise2D(wp * 1.6) * 0.65 + noise2D(wp * 5.0) * 0.35);
        float wet = wetness * exposed;
        albedo.rgb *= 1.0 - 0.30 * wet;
        float puddleAmt = wet * up * puddle;
        smoothness = max(smoothness, mix(0.35 * wet * up, 0.92, puddleAmt));
        normal = normalize(mix(normal, normalW, puddleAmt));
    }
    #endif

    #elif defined PROG_ENTITIES
    material = MAT_ENTITY;
    if (blockId == ID_LIGHTNING) {
        material = MAT_PASSTHROUGH;
        albedo.rgb = vec3(0.75, 0.80, 1.00) * 6.0;
    }
    #elif defined PROG_BLOCK
    if (blockId == ID_END_PORTAL) {
        material = MAT_PASSTHROUGH;
        vec3 dir = normalize(playerPos);
        albedo.rgb = endPortalStars(dir);
        albedo.a = 1.0;
    }
    #endif

    #ifdef FORWARD_LIT
    if (material != MAT_PASSTHROUGH) {
        setupAtmosphere();
        vec3 shadow;
        float dither = getDither(gl_FragCoord.xy);
        vec3 lit = computeLighting(toLinear(albedo.rgb), normal, playerPos, lmcoord, 1.0, subsurface,
                                   smoothness, 0.04, emission, dither, shadow);
        albedo.rgb = applyFog(lit, playerPos);
        material = MAT_PASSTHROUGH;
    } else {
        albedo.rgb = applyFog(albedo.rgb, playerPos);
    }
    #endif

    outColor = albedo;
    outData = vec4(encodeNormal(normal), lmcoord);
    outMaterial = vec4(encodeMat(material), smoothness, saturate(emission), subsurface);
}

#endif
