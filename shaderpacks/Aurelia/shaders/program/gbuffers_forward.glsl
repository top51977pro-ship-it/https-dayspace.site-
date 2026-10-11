// Forward-lit programs: held items (PROG_HAND), translucent held items (PROG_HAND_WATER),
// particles (PROG_PARTICLES) and rain/snow (PROG_WEATHER).
// The hand is written as "passthrough" so the deferred pass leaves it alone, the others
// go into the premultiplied translucent buffer (colortex3).

#include "/lib/settings.glsl"
#include "/lib/uniforms.glsl"
#include "/lib/common.glsl"
#include "/lib/transforms.glsl"

#if defined PROG_HAND_WATER || defined PROG_PARTICLES || defined PROG_WEATHER
#define TRANSLUCENT_OUTPUT
#endif

//==================================================================================//
#ifdef VSH

out vec2 texcoord;
out vec2 lmcoord;
out vec4 glcolor;
out vec3 normalW;
out vec3 playerPos;

void main() {
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    lmcoord = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
    lmcoord = saturate((lmcoord - 1.0 / 32.0) * 16.0 / 15.0);
    glcolor = gl_Color;

    vec3 viewPos = (gl_ModelViewMatrix * gl_Vertex).xyz;
    playerPos = viewToPlayer(viewPos);
    normalW = normalize(mat3(gbufferModelViewInverse) * (gl_NormalMatrix * gl_Normal));

    gl_Position = gl_ProjectionMatrix * vec4(viewPos, 1.0);
    applyTAAJitter(gl_Position);
}

#endif
//==================================================================================//
#ifdef FSH

in vec2 texcoord;
in vec2 lmcoord;
in vec4 glcolor;
in vec3 normalW;
in vec3 playerPos;

#include "/lib/atmosphere.glsl"
#include "/lib/sky.glsl"
#include "/lib/shadows.glsl"
#ifdef OVERWORLD
#include "/lib/clouds.glsl"
#endif
#include "/lib/lighting.glsl"
#include "/lib/fog.glsl"

#ifdef TRANSLUCENT_OUTPUT
/* RENDERTARGETS: 3 */
layout(location = 0) out vec4 outTranslucent;
#else
/* RENDERTARGETS: 0,1,2 */
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outData;
layout(location = 2) out vec4 outMaterial;
#endif

void main() {
    setupAtmosphere();

    vec4 albedo = texture(gtexture, texcoord) * glcolor;
    if (albedo.a < 0.05) discard;

    vec3 lin = toLinear(albedo.rgb);
    float dither = getDither(gl_FragCoord.xy);
    vec3 color;

    #if defined PROG_WEATHER
        vec3 light = ambientColor * (0.6 + lmcoord.y) + lightColor * 0.12 + getBlockLightColor() * blockLightFalloff(lmcoord.x);
        color = lin * light * 1.2;
        albedo.a *= 0.45;
    #else
        #ifdef PROG_HAND
        vec3 normal = normalize(normalW);
        float sss = 0.0;
        #else
        vec3 normal = vec3(0.0, 1.0, 0.0);
        float sss = 1.0;
        #endif
        vec3 shadow;
        color = computeLighting(lin, normal, playerPos, lmcoord, 1.0, sss, 0.0, 0.04, 0.0, dither, shadow);
        #ifdef PROG_PARTICLES
        // particles drawn at full brightness by the game are light sources: let them glow
        if (lmcoord.x > 0.93) {
            float sat = maxOf(lin) - min(lin.r, min(lin.g, lin.b));
            color = mix(color, lin * 4.0 * EMISSIVE_STRENGTH, smoothstep(0.05, 0.25, sat));
        }
        #endif
    #endif

    #ifdef TRANSLUCENT_OUTPUT
        #ifndef PROG_HAND_WATER
        color = applyFog(color, playerPos);
        #endif
        outTranslucent = vec4(color, albedo.a);
    #else
        outColor = vec4(color, 1.0);
        outData = vec4(encodeNormal(normalize(normalW)), lmcoord);
        outMaterial = vec4(encodeMat(MAT_PASSTHROUGH), 0.0, 0.0, 0.0);
    #endif
}

#endif
