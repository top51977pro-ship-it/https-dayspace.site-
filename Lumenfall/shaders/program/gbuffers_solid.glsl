/*
    Lumenfall - opaque geometry -> G-buffer
    Used by terrain, block entities, entities, hand.
    Defines: GB_TERRAIN, GB_BLOCK, GB_ENTITIES, GB_HAND, GB_GLOWING
*/

#include "/lib/common.glsl"

//==================================================================================//
#ifdef VERTEX_SHADER

in vec4 mc_Entity;
in vec4 at_tangent;
in vec2 mc_midTexCoord;

out vec2 vTexCoord;
out vec2 vLmCoord;
out vec4 vColor;
out vec3 vNormal;     // world
out vec3 vTangent;    // world
out vec3 vBitangent;  // world
out vec3 vViewPos;
flat out int vBlockId;
flat out vec4 vTileRect; // min.xy, size.xy in atlas uv

#include "/lib/util/noise.glsl"

vec3 windOffset(vec3 wp, float amount) {
    float t = frameTimeCounter * WAVING_SPEED;
    float gust = sin(t * 0.35 + wp.x * 0.025 + wp.z * 0.01) * 0.5 + 0.5;
    gust = gust * gust;
    float strength = (0.35 + gust * 0.65) * (1.0 + lf_rain * 1.2) * WAVING_STRENGTH;
    vec3 o;
    o.x = sin(t * 1.9 + wp.x * 0.6 + wp.z * 0.35) * 0.045 + sin(t * 3.7 + wp.z * 1.3) * 0.015;
    o.z = sin(t * 1.6 + wp.z * 0.55 - wp.x * 0.25) * 0.035 + cos(t * 4.1 + wp.x * 1.1) * 0.012;
    o.y = sin(t * 2.3 + wp.x + wp.z) * 0.01;
    o.xz += vec2(0.06, 0.025) * gust;
    return o * strength * amount;
}

void main() {
    vTexCoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    vLmCoord = saturate(((gl_TextureMatrix[1] * gl_MultiTexCoord1).xy - 1.0 / 32.0) * 16.0 / 15.0);
    vColor = gl_Color;
    vBlockId = int(mc_Entity.x + 0.5);

    vec2 halfSize = abs(vTexCoord - mc_midTexCoord);
    vTileRect = vec4(mc_midTexCoord - halfSize, halfSize * 2.0);

    vec3 viewPos = (gl_ModelViewMatrix * gl_Vertex).xyz;

    #if defined GB_TERRAIN && defined WAVING_PLANTS
        if (vBlockId >= 10001 && vBlockId <= 10005) {
            vec3 playerPos = mat3(gbufferModelViewInverse) * viewPos + gbufferModelViewInverse[3].xyz;
            vec3 wp = playerPos + cameraPosition;
            bool topVertex = vTexCoord.y < mc_midTexCoord.y;
            float amount = 0.0;
            if (vBlockId == 10001) amount = 0.55;                          // leaves
            else if (vBlockId == 10002) amount = topVertex ? 1.0 : 0.0;    // short plants
            else if (vBlockId == 10003) amount = topVertex ? 0.6 : 0.0;    // tall plant lower half
            else if (vBlockId == 10004) amount = topVertex ? 1.4 : 0.6;    // tall plant upper half
            else if (vBlockId == 10005) amount = 0.4;                      // vines / hanging
            amount *= smoothstep(0.2, 0.8, vLmCoord.y);
            playerPos += windOffset(wp, amount);
            viewPos = (gbufferModelView * vec4(playerPos, 1.0)).xyz;
        }
    #endif

    vViewPos = viewPos;
    gl_Position = gl_ProjectionMatrix * vec4(viewPos, 1.0);
    #ifdef TAA
        gl_Position.xy += taaOffset() * 2.0 * gl_Position.w;
    #endif

    mat3 toWorld = mat3(gbufferModelViewInverse);
    vNormal = normalize(toWorld * (gl_NormalMatrix * gl_Normal));
    vTangent = normalize(toWorld * (gl_NormalMatrix * at_tangent.xyz));
    vBitangent = cross(vNormal, vTangent) * (at_tangent.w < 0.0 ? -1.0 : 1.0);
}

#endif

//==================================================================================//
#ifdef FRAGMENT_SHADER

in vec2 vTexCoord;
in vec2 vLmCoord;
in vec4 vColor;
in vec3 vNormal;
in vec3 vTangent;
in vec3 vBitangent;
in vec3 vViewPos;
flat in int vBlockId;
flat in vec4 vTileRect;

uniform sampler2D tex;
uniform sampler2D normals;
uniform sampler2D specular;

#include "/lib/util/encoding.glsl"
#include "/lib/util/noise.glsl"
#include "/lib/materials/materials.glsl"

/* RENDERTARGETS: 1,2,3 */
layout(location = 0) out vec4 outAlbedo;
layout(location = 1) out vec4 outNormal;
layout(location = 2) out vec4 outSpecular;

vec2 wrapTile(vec2 uv) {
    return vTileRect.xy + fract((uv - vTileRect.xy) / vTileRect.zw) * vTileRect.zw;
}

#if defined POM && PBR_MODE == 2
// Parallax occlusion mapping in tile space with linear + binary refinement
vec2 parallaxUV(vec2 uv, vec3 tangentView, vec2 dx, vec2 dy, out float pomDepth, out vec3 pomTangentPos) {
    float viewDist = length(vViewPos);
    pomDepth = 0.0;
    pomTangentPos = vec3(0.0);
    if (viewDist > float(POM_DISTANCE) || vTileRect.z <= 0.0) return uv;
    float fade = 1.0 - smoothstep(float(POM_DISTANCE) * 0.7, float(POM_DISTANCE), viewDist);

    vec2 tileUV = (uv - vTileRect.xy) / vTileRect.zw;
    vec2 stepDir = tangentView.xy / max(-tangentView.z, 0.05) * POM_DEPTH * fade;
    const int samples = POM_SAMPLES;
    vec2 delta = stepDir / float(samples);
    float layer = 1.0 / float(samples);

    float depth = 0.0;
    vec2 cur = tileUV;
    float h = textureGrad(normals, wrapTile(vTileRect.xy + cur * vTileRect.zw), dx, dy).a;
    if (h > 0.999) return uv;
    vec2 prev = cur;
    float prevDepth = 0.0;
    for (int i = 0; i < samples; i++) {
        if (1.0 - depth <= h) break;
        prev = cur;
        prevDepth = depth;
        cur += delta;
        depth += layer;
        h = textureGrad(normals, wrapTile(vTileRect.xy + cur * vTileRect.zw), dx, dy).a;
    }
    // binary refinement
    for (int i = 0; i < 5; i++) {
        vec2 mid = (prev + cur) * 0.5;
        float midDepth = (prevDepth + depth) * 0.5;
        float mh = textureGrad(normals, wrapTile(vTileRect.xy + mid * vTileRect.zw), dx, dy).a;
        if (1.0 - midDepth <= mh) { cur = mid; depth = midDepth; }
        else { prev = mid; prevDepth = midDepth; }
    }
    pomDepth = depth * POM_DEPTH * fade;
    pomTangentPos = vec3(cur, 1.0 - depth);
    return wrapTile(vTileRect.xy + cur * vTileRect.zw);
}

float parallaxSelfShadow(vec3 tangentPos, vec3 tangentLight, vec2 dx, vec2 dy) {
    #ifndef POM_SHADOWS
        return 1.0;
    #else
        if (tangentLight.z <= 0.0) return 0.0;
        vec2 dir = tangentLight.xy / tangentLight.z * POM_DEPTH;
        float h0 = tangentPos.z;
        const int steps = 16;
        float shadow = 1.0;
        for (int i = 1; i <= steps; i++) {
            float t = float(i) / float(steps);
            float rayH = h0 + t * (1.0 - h0);
            vec2 p = tangentPos.xy + dir * t * (1.0 - h0);
            float h = textureGrad(normals, wrapTile(vTileRect.xy + p * vTileRect.zw), dx, dy).a;
            shadow = min(shadow, saturate(1.0 - (h - rayH) * 24.0));
        }
        return shadow;
    #endif
}
#endif

void main() {
    vec2 uv = vTexCoord;
    vec2 dx = dFdx(vTexCoord), dy = dFdy(vTexCoord);
    mat3 tbn = mat3(normalize(vTangent), normalize(vBitangent), normalize(vNormal));

    float pomShadow = 1.0;
    #if defined POM && PBR_MODE == 2 && (defined GB_TERRAIN || defined GB_BLOCK)
        if (vBlockId < 10001 || vBlockId > 10005) {
            vec3 viewDirW = normalize(mat3(gbufferModelViewInverse) * vViewPos);
            vec3 tangentView = viewDirW * tbn; // = transpose(tbn) * v
            float pomDepth;
            vec3 tangentPos;
            uv = parallaxUV(uv, tangentView, dx, dy, pomDepth, tangentPos);
            if (pomDepth > 0.0) {
                vec3 tangentLight = lightDirWorld() * tbn;
                pomShadow = parallaxSelfShadow(tangentPos, tangentLight, dx, dy);
            }
        }
    #endif

    vec4 albedo = textureGrad(tex, uv, dx, dy) * vec4(vColor.rgb, 1.0);
    #if defined GB_ENTITIES || defined GB_HAND
        albedo.a *= vColor.a;
    #endif
    if (albedo.a < 0.1) discard;

    #ifdef GB_ENTITIES
        albedo.rgb = mix(albedo.rgb, entityColor.rgb, entityColor.a);
    #endif

    // vanilla AO is stored separately in vColor.a (separateAo)
    #ifdef GB_TERRAIN
        float vanillaAO = mix(1.0, vColor.a, VANILLA_AO_STRENGTH);
        albedo.rgb *= vanillaAO;
    #endif

    //---- material ----------------------------------------------------------
    int mat = MAT_DEFAULT;
    #if defined GB_TERRAIN || defined GB_BLOCK
        mat = materialFromBlockId(vBlockId);
    #elif defined GB_ENTITIES
        mat = MAT_ENTITY;
        if (entityId == 50001) mat = MAT_LIGHTNING;
        if (entityId == 50002) mat = MAT_GLOWING_ENT;
    #elif defined GB_HAND
        mat = MAT_HAND;
    #endif

    MaterialProps mp;
    #if PBR_MODE == 2
        mp = labPBR(textureGrad(specular, uv, dx, dy), mat);
    #elif PBR_MODE == 1
        mp = internalPBR(mat, albedo.rgb);
    #else
        mp.smoothness = 0.0; mp.f0 = 0.02; mp.emission = 0.0; mp.sss = 0.0; mp.porosity = 0.5;
        if (mat == MAT_LAVA || mat == MAT_FIRE || mat == MAT_EMISSIVE || mat == MAT_TORCH) mp.emission = 0.8;
        if (mat == MAT_FOLIAGE || mat == MAT_PLANT) mp.sss = 0.6;
    #endif

    #if PBR_MODE == 2
        // light sources without emissive maps still glow
        if (mp.emission < 0.01 && (mat == MAT_EMISSIVE || mat == MAT_TORCH || mat == MAT_LAVA || mat == MAT_FIRE)) {
            mp.emission = internalPBR(mat, albedo.rgb).emission;
        }
    #endif

    #ifdef GB_GLOWING
        mp.emission = max(mp.emission, 0.35);
    #endif
    // glow squids, blazes, magma cubes, allays...: their bright texels glow
    if (mat == MAT_GLOWING_ENT) mp.emission = max(mp.emission, smoothstep(0.45, 0.8, luminance(albedo.rgb)) * 0.8);
    if (mat == MAT_LIGHTNING) { mp.emission = 1.0; albedo.rgb = vec3(0.75, 0.82, 1.0); }

    //---- normal --------------------------------------------------------------
    vec3 normal = tbn[2];
    #ifdef NORMAL_MAPPING
        #if PBR_MODE == 2
            vec3 nm = textureGrad(normals, uv, dx, dy).rgb * 2.0 - 1.0;
            nm.z = sqrt(saturate(1.0 - dot(nm.xy, nm.xy)));
            nm.xy *= NORMAL_STRENGTH;
            normal = normalize(tbn * normalize(nm));
        #elif PBR_MODE == 1 && defined GENERATED_NORMALS
            if (mat != MAT_PLANT && mat != MAT_FOLIAGE && vTileRect.z > 0.0) {
                vec2 atlasTexel = 1.0 / vec2(atlasSize);
                float h0 = luminance(textureLod(tex, uv, 0.0).rgb);
                float hx = luminance(textureLod(tex, wrapTile(uv + vec2(atlasTexel.x, 0.0)), 0.0).rgb);
                float hy = luminance(textureLod(tex, wrapTile(uv + vec2(0.0, atlasTexel.y)), 0.0).rgb);
                float dist = length(vViewPos);
                float strength = 0.45 * NORMAL_STRENGTH * (1.0 - smoothstep(12.0, 40.0, dist));
                // polished materials are flatter
                if (mat == MAT_METAL || mat == MAT_GEM || mat == MAT_POLISHED || mat == MAT_ICE) strength *= 0.35;
                vec3 nm = normalize(vec3((h0 - hx) * strength * 2.0, (h0 - hy) * strength * 2.0, 1.0));
                normal = normalize(tbn * nm);
            }
        #endif
    #endif

    #if defined GB_TERRAIN
        if (mat == MAT_PLANT) normal = normalize(mix(normal, vec3(0.0, 1.0, 0.0), 0.5));
    #endif

    // POM self shadowing folds into the sky lightmap channel's sun visibility via emission-free darkening
    albedo.rgb *= mix(1.0, pomShadow, 0.65);

    vec2 lm = vLmCoord;
    #ifdef GB_HAND
        lm.y = max(lm.y, 0.0);
    #endif

    outAlbedo = packGData1(albedo.rgb, mat);
    outNormal = packGData2(normal, tbn[2]);
    outSpecular = packGData3(mp.smoothness, mp.f0, mp.emission, mp.sss, lm);
}

#endif
