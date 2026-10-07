/*
    Lumenfall - translucent & forward-shaded geometry
    Water writes only surface data (normal, mask, biome tint) - it is shaded in composite.
    Glass, ice, portals, particles, weather and translucent entities are lit here.
    Defines: GB_WATER, GB_HAND_WATER, GB_ENT_TRANSLUCENT, GB_PARTICLES, GB_WEATHER, GB_CLOUDS
*/

#include "/lib/common.glsl"

#if defined GB_PARTICLES || defined GB_WEATHER || defined GB_CLOUDS || defined GB_ENT_TRANSLUCENT
    #define LF_FAST_SHADOWS
#endif

//==================================================================================//
#ifdef VERTEX_SHADER

in vec4 mc_Entity;
in vec4 at_tangent;

out vec2 vTexCoord;
out vec2 vLmCoord;
out vec4 vColor;
out vec3 vNormal;
out vec3 vViewPos;
out vec3 vPlayerPos;
flat out int vBlockId;

#include "/lib/util/noise.glsl"
#ifdef GB_WATER
    #include "/lib/water/waves.glsl"
#endif

void main() {
    vTexCoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    vLmCoord = saturate(((gl_TextureMatrix[1] * gl_MultiTexCoord1).xy - 1.0 / 32.0) * 16.0 / 15.0);
    vColor = gl_Color;
    vBlockId = int(mc_Entity.x + 0.5);

    vec3 viewPos = (gl_ModelViewMatrix * gl_Vertex).xyz;
    vec3 playerPos = mat3(gbufferModelViewInverse) * viewPos + gbufferModelViewInverse[3].xyz;
    vNormal = normalize(mat3(gbufferModelViewInverse) * (gl_NormalMatrix * gl_Normal));

    #if defined GB_WATER && defined WATER_VERTEX_WAVES
        if (vBlockId == 10010 && vNormal.y > 0.5) {
            vec3 wp = playerPos + cameraPosition;
            // only the top face of still-ish water gets displaced (keeps block edges sealed)
            float h = waterHeightOctaves(wp.xz, 3) - 0.06 * WATER_WAVE_HEIGHT;
            playerPos.y += h * 0.6 * smoothstep(0.0, 0.2, vLmCoord.y + 0.2);
            viewPos = (gbufferModelView * vec4(playerPos, 1.0)).xyz;
        }
    #endif

    #ifdef GB_WEATHER
        // slant the rain with the wind
        playerPos.xz += vec2(0.25, 0.1) * (playerPos.y) * 0.15 * rainStrength;
        viewPos = (gbufferModelView * vec4(playerPos, 1.0)).xyz;
    #endif

    vViewPos = viewPos;
    vPlayerPos = playerPos;
    gl_Position = gl_ProjectionMatrix * vec4(viewPos, 1.0);
    #ifdef TAA
        gl_Position.xy += taaOffset() * 2.0 * gl_Position.w;
    #endif
}

#endif

//==================================================================================//
#ifdef FRAGMENT_SHADER

in vec2 vTexCoord;
in vec2 vLmCoord;
in vec4 vColor;
in vec3 vNormal;
in vec3 vViewPos;
in vec3 vPlayerPos;
flat in int vBlockId;

uniform sampler2D tex;
uniform sampler2D depthtex1;

#include "/lib/util/encoding.glsl"
#include "/lib/util/noise.glsl"
#include "/lib/util/space.glsl"
#include "/lib/water/waves.glsl"
#include "/lib/atmosphere/atmosphere.glsl"
#include "/lib/atmosphere/clouds.glsl"
#include "/lib/lighting/brdf.glsl"
#include "/lib/lighting/shadows.glsl"
#include "/lib/lighting/lighting.glsl"
#include "/lib/atmosphere/lightData.glsl"
#include "/lib/atmosphere/dimensions.glsl"

#if defined GB_PARTICLES || defined GB_WEATHER || defined GB_CLOUDS
    /* RENDERTARGETS: 0 */
    layout(location = 0) out vec4 outColor;
    #define WRITES_DATA 0
#else
    /* RENDERTARGETS: 0,6 */
    layout(location = 0) out vec4 outColor;
    layout(location = 1) out vec4 outData;
    #define WRITES_DATA 1
#endif

vec4 packTranslucent(vec3 n, float mask, vec3 tint) {
    return vec4(encodeNormal(n), pack2x8(vec2(mask, vLmCoord.y)), pack565(tint));
}

LightInputs getLights() {
    LightInputs li = readLightInputs();
    #ifdef NETHER
        li.ambTop = netherAmbient(); li.ambBottom = li.ambTop;
    #endif
    #ifdef END
        li.ambTop = endAmbient(); li.ambBottom = endAmbient() * 0.6; li.lightCol = endLightColor();
    #endif
    return li;
}

void main() {
    vec3 worldPos = vPlayerPos + cameraPosition;
    vec3 viewDirW = normalize(vPlayerPos);
    float dither = blueNoise(gl_FragCoord.xy);

    //------------------------------------------------------------------ water
    #if defined GB_WATER || defined GB_HAND_WATER
    if (vBlockId == 10010) {
        vec3 n = normalize(vNormal);
        if (n.y > 0.5) {
            vec2 p = worldPos.xz;
            #ifdef WATER_PARALLAX
                // one-step parallax: shift the lookup along the view ray by the local height
                float h = waterHeightOctaves(p, 4);
                p += viewDirW.xz / max(-viewDirW.y, 0.15) * h * 0.8;
            #endif
            n = waterNormal(p);
            #ifdef RAIN_RIPPLES
                float rippleAmount = lf_rain * smoothstep(0.8, 0.95, vLmCoord.y);
                n = normalize(n + vec3(rainRipples(worldPos.xz, rippleAmount), 0.0).xzy);
            #endif
            // flatten with distance to avoid aliasing shimmer
            float dist = length(vPlayerPos);
            n = normalize(mix(n, vec3(0.0, 1.0, 0.0), smoothstep(48.0, 240.0, dist) * 0.7));
        } else {
            n = normalize(n + vec3(noise2D(worldPos.xy * 4.0 + frameTimeCounter) - 0.5, 0.0, noise2D(worldPos.zy * 4.0 - frameTimeCounter) - 0.5) * 0.08);
        }
        outColor = vec4(0.0);
        #if WRITES_DATA == 1
            outData = packTranslucent(n, TMASK_WATER, vColor.rgb);
        #endif
        return;
    }
    #endif

    //------------------------------------------------------------------ everything else
    vec4 albedo = texture(tex, vTexCoord) * vColor;
    #ifdef GB_WEATHER
        albedo.a *= 0.55;
    #endif
    if (albedo.a < 0.004) discard;
    vec3 albedoLin = srgbToLinear(albedo.rgb);

    GData g;
    g.albedo = albedoLin;
    g.matId = MAT_DEFAULT;
    g.normal = normalize(vNormal);
    g.geoNormal = g.normal;
    g.smoothness = 0.9;
    g.f0 = 0.04;
    g.emission = 0.0;
    g.sss = 0.0;
    g.lightmap = vLmCoord;

    float mask = TMASK_OTHER;

    #if defined GB_PARTICLES || defined GB_WEATHER || defined GB_CLOUDS
        // camera-facing sprites: light them like a thin volume
        g.normal = -viewDirW;
        g.geoNormal = g.normal;
        g.smoothness = 0.0;
        g.sss = 0.6;
        g.matId = MAT_PLANT;
        float lum = luminance(albedo.rgb);
        if (vLmCoord.x > 0.97 && lum > 0.45) g.emission = smoothstep(0.45, 0.9, lum);
    #endif

    #if defined GB_WATER || defined GB_HAND_WATER
        if (vBlockId == 10011) { mask = TMASK_GLASS; g.smoothness = 0.96; g.f0 = 0.04; }   // glass
        else if (vBlockId == 10036) { mask = TMASK_ICE; g.smoothness = 0.92; g.f0 = 0.02; g.sss = 0.3; } // ice
        else if (vBlockId == 10012) { g.smoothness = 0.8; g.sss = 0.5; }                    // slime / honey
        else if (vBlockId == 10013) {                                                       // nether portal
            float swirl = fbm2D(worldPos.xz * 2.0 + worldPos.y * 1.5 + frameTimeCounter * 0.4, 4);
            g.emission = 0.7 + swirl * 0.6;
            albedo.a = max(albedo.a, 0.75);
        }
    #endif

    vec3 spec;
    LightInputs li = getLights();
    vec3 color = shadeSurface(g, vPlayerPos, viewDirW, 1.0, dither, li, spec);
    color += spec;

    #ifdef GB_WEATHER
        // rain catches the sky light, snow is brighter
        color = mix(color, li.ambTop * 0.6 + li.lightCol * 0.05, 0.5) * (lf_snowyBiome > 0.5 ? 1.4 : 0.8);
    #endif

    outColor = vec4(color, albedo.a);
    #if WRITES_DATA == 1
        outData = packTranslucent(g.normal, mask, albedo.rgb);
    #endif
}

#endif
