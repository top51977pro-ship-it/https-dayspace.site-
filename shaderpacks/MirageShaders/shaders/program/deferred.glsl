// Deferred lighting: lights the opaque G-buffer, draws the sky, clouds and fog.

#include "/lib/settings.glsl"
#include "/lib/uniforms.glsl"
#include "/lib/common.glsl"
#include "/lib/transforms.glsl"

//==================================================================================//
#ifdef VSH

out vec2 texcoord;

void main() {
    texcoord = gl_MultiTexCoord0.xy;
    gl_Position = ftransform();
}

#endif
//==================================================================================//
#ifdef FSH

in vec2 texcoord;

#include "/lib/atmosphere.glsl"
#include "/lib/sky.glsl"
#include "/lib/shadows.glsl"
#ifdef OVERWORLD
#include "/lib/clouds.glsl"
#endif
#include "/lib/lighting.glsl"
#include "/lib/fog.glsl"

/* RENDERTARGETS: 0 */
layout(location = 0) out vec4 outColor;

#ifdef SSAO
float getSSAO(vec3 viewPos, vec3 viewNormal, float dither) {
    const float radius = 0.85;
    vec3 t = normalize(cross(viewNormal, abs(viewNormal.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 b = cross(viewNormal, t);

    float occlusion = 0.0;
    for (int i = 0; i < SSAO_SAMPLES; i++) {
        vec2 d = vogelDisk(i, SSAO_SAMPLES, dither * TAU);
        vec3 s = t * d.x + b * d.y + viewNormal * sqrt(max(1.0 - dot(d, d), 0.0));
        float scale = (float(i) + dither) / float(SSAO_SAMPLES);
        scale = mix(0.15, 1.0, scale * scale);
        vec3 samplePos = viewPos + viewNormal * 0.03 + s * radius * scale;

        vec3 screen = viewToScreen(samplePos);
        if (any(lessThan(screen.xy, vec2(0.0))) || any(greaterThan(screen.xy, vec2(1.0)))) continue;
        float sampleDepth = texture(depthtex0, screen.xy).r;
        if (sampleDepth < 0.56) continue;

        vec3 sceneView = screenToView(screen.xy, sampleDepth);
        float diff = sceneView.z - samplePos.z;
        float range = smoothstep(0.0, 1.0, radius / max(abs(viewPos.z - sceneView.z), 1e-3));
        occlusion += step(0.02, diff) * range;
    }
    float ao = 1.0 - occlusion / float(SSAO_SAMPLES);
    return pow(saturate(ao), 2.0 * SSAO_STRENGTH);
}
#endif

void main() {
    setupAtmosphere();

    float depth = texture(depthtex0, texcoord).r;
    vec4 albedoData = texture(colortex0, texcoord);
    vec3 viewPos = screenToView(texcoord, depth);
    vec3 playerPos = viewToPlayer(viewPos);
    float dist = length(playerPos);
    vec3 dir = playerPos / max(dist, 1e-5);
    float dither = getDither(gl_FragCoord.xy);
    bool isSky = depth >= 1.0;

    vec3 color;
    if (isSky) {
        color = getSky(dir, dither);
        #ifdef OVERWORLD
        color += albedoData.rgb * (1.0 - rainStrength); // vanilla moon from gbuffers_skytextured
        #endif
        if (isEyeInWater != 0) color = applyFog(color, dir * 40.0);
    } else {
        vec4 matData = texture(colortex2, texcoord);
        int material = decodeMat(matData.r);

        if (material == MAT_PASSTHROUGH) {
            color = albedoData.rgb; // already lit and fogged by the program that drew it
        } else {
            vec4 gData = texture(colortex1, texcoord);
            vec3 normal = decodeNormal(gData.xy);
            vec2 lm = gData.zw;
            vec3 albedo = toLinear(albedoData.rgb);
            float smoothness = matData.g;
            float emission = matData.b;
            float subsurface = matData.a;

            float ao = 1.0;
            #ifdef SSAO
            if (depth > 0.56) ao = getSSAO(viewPos, mat3(gbufferModelView) * normal, dither);
            #endif

            float f0 = 0.04;
            if (material == MAT_METAL) {
                f0 = 0.8;
                albedo *= 0.75;
            }

            vec3 shadow;
            color = computeLighting(albedo, normal, playerPos, lm, ao, subsurface, smoothness, f0, emission, dither, shadow);
            if (depth > 0.56) color = applyFog(color, playerPos);
        }
    }

    #if defined OVERWORLD && defined VOLUMETRIC_CLOUDS
    if (isEyeInWater == 0) {
        vec4 clouds = getClouds(dir, isSky ? 1e7 : dist, dither);
        color = color * clouds.a + clouds.rgb;
    }
    #endif

    outColor = vec4(color, 1.0);
}

#endif
