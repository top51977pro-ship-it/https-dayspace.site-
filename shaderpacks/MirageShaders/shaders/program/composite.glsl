// Composite 0: refraction + water absorption, translucent blending, reflections, volumetric light.

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
#include "/lib/fog.glsl"
#include "/lib/reflections.glsl"
#include "/lib/volumetrics.glsl"

/* RENDERTARGETS: 0 */
layout(location = 0) out vec4 outColor;

void main() {
    setupAtmosphere();

    float depth0 = texture(depthtex0, texcoord).r;
    float depth1 = texture(depthtex1, texcoord).r;
    vec3 viewPos0 = screenToView(texcoord, depth0);
    vec3 playerPos0 = viewToPlayer(viewPos0);
    float dist0 = length(playerPos0);
    vec3 dir = playerPos0 / max(dist0, 1e-5);
    float dither = getDither(gl_FragCoord.xy);

    vec4 gData = texture(colortex1, texcoord);
    vec4 matData = texture(colortex2, texcoord);
    int material = decodeMat(matData.r);
    vec3 normalW = decodeNormal(gData.xy);
    vec2 lm = gData.zw;
    float smoothness = matData.g;

    bool translucentSurface = depth0 < depth1 && (material == MAT_WATER || material == MAT_GLASS);
    bool isWater = translucentSurface && material == MAT_WATER;

    // ---- refraction ----
    vec2 sceneUV = texcoord;
    #ifdef WATER_REFRACTION
    if (isWater) {
        vec3 flatN = abs(normalW.y) > 0.5 ? vec3(0.0, sign(normalW.y), 0.0) : normalW;
        vec3 deviation = mat3(gbufferModelView) * (normalW - flatN);
        vec2 refractUV = texcoord + deviation.xy * 0.035 / (1.0 + dist0 * 0.12);
        if (all(greaterThan(refractUV, vec2(0.0))) && all(lessThan(refractUV, vec2(1.0)))
            && texture(depthtex1, refractUV).r > depth0) {
            sceneUV = refractUV;
        }
    }
    #endif

    vec3 color = texture(colortex0, sceneUV).rgb;

    // ---- looking into water from above: absorption + in-scattering ----
    if (isWater && isEyeInWater == 0) {
        float sceneDepth = texture(depthtex1, sceneUV).r;
        vec3 scenePlayer = viewToPlayer(screenToView(sceneUV, sceneDepth));
        float waterDist = sceneDepth >= 1.0 ? 256.0 : distance(scenePlayer, playerPos0);
        // light travels down to the bottom and back up to the eye, so depth darkens twice
        float verticalDepth = sceneDepth >= 1.0 ? 64.0 : max(playerPos0.y - scenePlayer.y, 0.0);
        vec3 absorb = waterAbsorption(waterDist + verticalDepth);
        absorb = mix(absorb, vec3(1.0), smoothstep(far * 0.6, far, dist0));
        vec3 scatterCol = getWaterScatter(lm.y * lm.y);
        color = color * absorb + applyFog(scatterCol, playerPos0) * (1.0 - absorb.g);
        #ifdef VOLUMETRIC_LIGHT
        // light shafts continue below the surface
        vec3 bottomPlayer = sceneDepth >= 1.0 ? playerPos0 + dir * 48.0 : scenePlayer;
        color += getUnderwaterLight(playerPos0, bottomPlayer, dither) * mix(1.0, 0.0, smoothstep(far * 0.6, far, dist0));
        #endif
    }

    // ---- translucent layer (premultiplied) ----
    vec4 translucent = texture(colortex3, texcoord);
    color = color * (1.0 - translucent.a) + translucent.rgb;

    // ---- glowing portal edges ----
    #if defined PORTAL_EFFECT && defined PORTAL_EDGES
    if (material == MAT_PORTAL && depth0 < depth1) {
        // portal planes are axis aligned: build the in-plane axes from the stored normal
        vec3 N = abs(normalW.x) > abs(normalW.z) ? vec3(sign(normalW.x), 0.0, 0.0) : vec3(0.0, 0.0, sign(normalW.z));
        vec3 T = vec3(N.z, 0.0, -N.x);
        const vec3 B = vec3(0.0, 1.0, 0.0);
        float edge = 0.0;
        for (int k = 0; k < 8; k++) {
            float ang = float(k) * 0.785398 + dither * 0.785398;
            vec3 dirInPlane = T * cos(ang) + B * sin(ang);
            for (int r = 0; r < 2; r++) {
                float radius = r == 0 ? 0.045 : 0.11;
                vec3 q = playerPos0 + dirInPlane * radius;
                vec3 s = viewToScreen(playerToView(q));
                if (any(lessThan(s.xy, vec2(0.0))) || any(greaterThan(s.xy, vec2(1.0)))) continue;
                float d = texture(depthtex0, s.xy).r;
                vec3 seen = viewToPlayer(screenToView(s.xy, d));
                bool isPortal = decodeMat(texture(colortex2, s.xy).r) == MAT_PORTAL && distance(seen, q) < 0.1;
                // the frame block covering that point sits at most ~0.7 blocks closer to the camera
                bool frameThere = !isPortal && distance(seen, q) < 0.75;
                if (frameThere) edge = max(edge, r == 0 ? 1.0 : 0.45);
            }
        }
        #if defined NETHER
        const float comp = 1.0 / 1.2;
        #elif defined END
        const float comp = 1.0 / 1.3;
        #else
        const float comp = 1.0;
        #endif
        color += vec3(0.74, 0.12, 1.14) * 1.6 * edge * comp * PORTAL_BRIGHTNESS;
    }
    #endif

    // ---- reflections ----
    bool opaqueReflective = depth0 == depth1 && material != MAT_PASSTHROUGH && material != MAT_NONE;
    bool reflective = depth0 > 0.56 && depth0 < 1.0 && smoothness > 0.1;
    #ifndef WATER_REFLECTIONS
    if (translucentSurface) reflective = false;
    #endif
    #ifndef BLOCK_REFLECTIONS
    if (opaqueReflective) reflective = false;
    #endif
    reflective = reflective && (translucentSurface || opaqueReflective);
    if (isWater && isEyeInWater == 1) reflective = false;

    if (reflective) {
        vec3 viewN = normalize(mat3(gbufferModelView) * normalW);
        vec3 viewDir = normalize(viewPos0);
        float roughness = 1.0 - smoothness;
        vec3 jitter = (vec3(hash12(gl_FragCoord.xy + dither * 31.0), hash12(gl_FragCoord.yx * 1.3 + dither * 17.0),
                            hash12(gl_FragCoord.xy * 0.7 + 5.0)) - 0.5) * roughness * roughness * 0.6;
        vec3 reflView = normalize(reflect(viewDir, normalize(viewN + jitter)));
        vec3 reflW = mat3(gbufferModelViewInverse) * reflView;

        float NdotV = saturate(dot(viewN, -viewDir));
        float f0 = material == MAT_METAL ? 0.8 : (material == MAT_WATER ? 0.02 : 0.04);
        float fresnel = schlick(NdotV, f0);

        float skyVisibility = smoothstep(0.3, 0.9, lm.y);
        #if defined OVERWORLD
        vec3 fallback = getSkyColor(reflW) * skyVisibility * smoothstep(-0.35, 0.05, reflW.y);
        #else
        vec3 fallback = getSkyColor(reflW);
        #endif

        vec3 reflection = fallback;
        vec3 hit = raytraceSSR(viewPos0, reflView, dither);
        if (hit.z > 0.0) reflection = mix(fallback, texture(colortex0, hit.xy).rgb, hit.z);
        reflection = applyFog(reflection, playerPos0);

        float weight = fresnel * smoothness * smoothness;
        if (material == MAT_METAL) weight = mix(weight, 0.75, 0.6) * smoothness;
        color = mix(color, reflection, saturate(weight));
    }

    // ---- drifting Nether smoke / End haze ----
    #if defined DIMENSION_HAZE && (defined NETHER || defined END)
    if (isEyeInWater == 0 && depth0 > 0.56) {
        vec4 haze = getDimensionHaze(dir, depth0 >= 1.0 ? 256.0 : dist0, dither);
        color = color * haze.a + haze.rgb;
    }
    #endif

    // ---- volumetric light ----
    #ifdef VOLUMETRIC_LIGHT
    float vlDist = depth0 >= 1.0 ? shadowDistance : dist0;
    color += getVolumetricLight(dir, vlDist, dither);
    #endif

    outColor = vec4(color, 1.0);
}

#endif
