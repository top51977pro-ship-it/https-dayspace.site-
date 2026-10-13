// Shared fragment shader for every gbuffers program.
// The including stub defines DIM_* and exactly one PROG_*.

#include "/lib/settings.glsl"
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"
#include "/lib/shadows.glsl"
#include "/lib/water.glsl"
#include "/lib/lighting.glsl"

uniform sampler2D gtexture;
uniform sampler2D depthtex1;
uniform vec4 entityColor;
uniform float alphaTestRef;
uniform int renderStage;

in vec2 texcoord;
in vec2 lmcoord;
in vec4 glcolor;
in vec3 viewPos;
in vec3 playerPos;
in vec3 viewNormal;
flat in int matID;

flat in vec3 atmLight;
flat in vec3 atmAmbient;
flat in vec3 atmZenith;
flat in vec3 atmHorizon;
flat in vec3 atmGlow;
flat in vec4 atmParams;

// ---------------------------------------------------------------------
#if defined PROG_SKYBASIC || defined PROG_SKYTEXTURED || defined PROG_BASIC || defined PROG_WEATHER || defined PROG_EMISSIVE || defined PROG_GLINT || defined PROG_DAMAGED
    /* RENDERTARGETS: 0 */
    layout(location = 0) out vec4 outColor;
    #define SINGLE_TARGET
#elif defined PROG_WATER
    /* RENDERTARGETS: 0,1,3 */
    layout(location = 0) out vec4 outColor;
    layout(location = 1) out vec4 outData;
    layout(location = 2) out vec4 outTint;
#else
    /* RENDERTARGETS: 0,1 */
    layout(location = 0) out vec4 outColor;
    layout(location = 1) out vec4 outData;
#endif

float dither() { return interleavedGradientNoise(gl_FragCoord.xy); }

void main() {
// ===================================================================== sky
#if defined PROG_SKYBASIC
    // The sky gradient itself is drawn in deferred.fsh. Here we only keep stars.
    #ifdef MC_RENDER_STAGE_STARS
        if (renderStage != MC_RENDER_STAGE_STARS) discard;
    #else
        discard;
    #endif
    #ifdef DIM_OVERWORLD
        float night = 1.0 - smoothstep(-0.2, 0.05, dot(normalize(sunPosition), normalize(upPosition)));
        outColor = vec4(toLinear(glcolor.rgb) * 2.5 * STAR_BRIGHTNESS * night * (1.0 - rainStrength), glcolor.a);
    #else
        outColor = vec4(toLinear(glcolor.rgb), glcolor.a);
    #endif

#elif defined PROG_SKYTEXTURED
    vec4 tex = texture(gtexture, texcoord) * glcolor;
    vec3 c = toLinear(tex.rgb);
    #if defined DIM_OVERWORLD && defined MC_RENDER_STAGE_SUN
        if (renderStage == MC_RENDER_STAGE_SUN) {
            // Big, bright, blocky sun that blooms like the Vibrant Visuals sun
            c *= (atmGlow * 0.6 + 0.4) * 28.0 * SUN_DISC_BRIGHTNESS * (1.0 - rainStrength);
        } else if (renderStage == MC_RENDER_STAGE_MOON) {
            c *= 2.2 * (1.0 - rainStrength);
        }
    #elif defined DIM_END
        c *= 0.7;
    #endif
    outColor = vec4(c, tex.a);

// ===================================================================== simple / unlit
#elif defined PROG_BASIC
    vec4 c = glcolor;
    if (c.a < 0.01) discard;
    outColor = vec4(toLinear(c.rgb), c.a);

#elif defined PROG_DAMAGED
    // Block breaking overlay uses multiplicative blending: keep it in 0..1
    vec4 c = texture(gtexture, texcoord) * glcolor;
    if (c.a < 0.01) discard;
    outColor = c;

#elif defined PROG_EMISSIVE
    // Spider/enderman eyes, beacon beams: glow
    vec4 c = texture(gtexture, texcoord) * glcolor;
    if (c.a < 0.01) discard;
    outColor = vec4(toLinear(c.rgb) * 2.5 * EMISSIVE_STRENGTH, c.a);

#elif defined PROG_GLINT
    vec4 c = texture(gtexture, texcoord) * glcolor;
    outColor = vec4(toLinear(c.rgb) * 0.8, c.a);

#elif defined PROG_WEATHER
    vec4 c = texture(gtexture, texcoord) * glcolor;
    if (c.a < 0.01) discard;
    vec3 lit = atmAmbient * 1.2 + atmLight * 0.25 + BLOCKLIGHT_COLOR * pow(lmcoord.x, 3.0);
    outColor = vec4(toLinear(c.rgb) * lit, c.a * 0.55);

// ===================================================================== clouds
#elif defined PROG_CLOUDS
    vec4 c = glcolor;
    if (c.a < 0.01) discard;
    vec3 wn = mat3(gbufferModelViewInverse) * viewNormal;
    vec3 L  = normalize(shadowLightPosition);
    float NdotL = dot(viewNormal, L);
    float VdotL = dot(normalize(viewPos), L);
    vec3 col = atmAmbient * (1.05 + 0.25 * wn.y)
             + atmLight * (0.35 + 0.45 * saturate(NdotL))
             + atmHorizon * 0.25
             + atmGlow * phaseHG(VdotL, 0.6) * atmParams.x * 3.0;   // warm sunset rim
    col *= toLinear(c.rgb) * 1.1;
    float alpha = c.a * CLOUD_OPACITY * (1.0 - rainStrength * 0.2);
    outColor = vec4(col, alpha);
    outData  = vec4(0.5, 0.5, packData(DATA_CLOUD, 1.0, 0.0), 1.0);

// ===================================================================== water & translucents
#elif defined PROG_WATER
    vec4 tex = texture(gtexture, texcoord);
    float dith = dither();

    if (matID == MAT_WATER) {
        // Water is shaded in composite.fsh, where the scene behind it is
        // known: there we do per-channel absorption (turquoise shallows,
        // blue depths), reflections and sun glints. Here we only leave the
        // scene untouched (alpha 0) and store the surface data.
        vec3 worldN = mat3(gbufferModelViewInverse) * viewNormal;
        vec3 wn = worldN;
        if (worldN.y > 0.5) wn = waterNormal(playerPos + cameraPosition, length(viewPos));
        vec3 N = normalize(mat3(gbufferModelView) * wn);

        // (tiny alpha instead of 0 so an injected alpha test can't discard us)
        outColor = vec4(0.0, 0.0, 0.0, 0.004);
        outData  = vec4(encodeNormal(N), packData(DATA_WATER, lmcoord.y, lmcoord.x), 1.0);
        outTint  = vec4(glcolor.rgb, 1.0);
    } else {
        // Glass, ice, stained glass, slime, honey...
        vec4 albedo = tex * glcolor;
        if (albedo.a < 0.01) discard;
        Surface s;
        s.albedo = toLinear(albedo.rgb);
        s.viewNormal = viewNormal;
        s.viewPos = viewPos;
        s.playerPos = playerPos;
        s.lm = lmcoord;
        s.ao = 1.0;
        s.mat = matID;
        vec3 c = shadeSurface(s, atmLight, atmAmbient, dith);
        outColor = vec4(c, albedo.a);
        float slot = matID == MAT_GLASS ? DATA_GLASS : 0.0;
        outData = vec4(encodeNormal(viewNormal), packData(slot, lmcoord.y, lmcoord.x), 1.0);
        outTint = vec4(0.0, 0.0, 0.0, 1.0);
    }

// ===================================================================== lit opaque
#else
    vec4 tex = texture(gtexture, texcoord);
    #ifdef PROG_TERRAIN
        // Iris "separateAo": rgb = biome tint, a = vanilla ambient occlusion
        vec4 albedo = vec4(tex.rgb * glcolor.rgb, tex.a);
        float ao = glcolor.a;
    #else
        vec4 albedo = tex * glcolor;
        float ao = 1.0;
    #endif
    if (albedo.a < max(alphaTestRef, 0.1)) discard;

    #if defined PROG_ENTITIES || defined PROG_HAND
        albedo.rgb = mix(albedo.rgb, entityColor.rgb, entityColor.a);
    #endif

    Surface s;
    s.albedo = toLinear(albedo.rgb);
    s.viewNormal = normalize(viewNormal);
    s.viewPos = viewPos;
    s.playerPos = playerPos;
    s.lm = lmcoord;
    s.ao = ao;
    s.mat = matID;
    #ifdef PROG_TEXTURED
        s.mat = MAT_PLANT;   // particles: lit flat, like the ground
    #endif

    vec3 c = shadeSurface(s, atmLight, atmAmbient, dither());
    c += emission(s.albedo, albedo.rgb, matID);

    outColor = vec4(c, albedo.a);
    outData  = vec4(0.5, 0.5, 0.0, 1.0);
#endif
}
