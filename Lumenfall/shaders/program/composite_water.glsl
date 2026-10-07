/*
    Lumenfall - composite: water, glass & reflections
    - water: refraction, depth absorption + in-scattering, shoreline foam, fresnel,
      SSR / sky / cloud reflections, sun glitter, Snell's window from below
    - glass & ice: reflections on top of the forward-shaded layer
    - opaque PBR surfaces: rough (GGX sampled, TAA-resolved) reflections
    - underwater / lava / powder snow view media
*/

#include "/lib/common.glsl"

//==================================================================================//
#ifdef VERTEX_SHADER

out vec2 vUV;
flat out vec3 vLightCol;
flat out vec3 vAmbTop;
flat out vec3 vAmbBottom;
flat out vec3 vFogCol;

#include "/lib/atmosphere/lightData.glsl"
#include "/lib/util/noise.glsl"
#include "/lib/atmosphere/dimensions.glsl"

void main() {
    gl_Position = ftransform();
    vUV = gl_MultiTexCoord0.xy;
    LightInputs li = readLightInputs();
    vLightCol = li.lightCol;
    vAmbTop = li.ambTop;
    vAmbBottom = li.ambBottom;
    vFogCol = readLightData(LD_FOG).rgb;
    #ifdef NETHER
        vLightCol = vec3(0.0); vAmbTop = netherAmbient(); vAmbBottom = vAmbTop;
    #endif
    #ifdef END
        vLightCol = endLightColor(); vAmbTop = endAmbient(); vAmbBottom = endAmbient() * 0.6;
    #endif
}

#endif

//==================================================================================//
#ifdef FRAGMENT_SHADER

in vec2 vUV;
flat in vec3 vLightCol;
flat in vec3 vAmbTop;
flat in vec3 vAmbBottom;
flat in vec3 vFogCol;

uniform sampler2D colortex0;
uniform sampler2D colortex1;
uniform sampler2D colortex2;
uniform sampler2D colortex3;
uniform sampler2D colortex6;
uniform sampler2D depthtex0;

#include "/lib/util/encoding.glsl"
#include "/lib/util/noise.glsl"
#include "/lib/util/space.glsl"
#include "/lib/water/waves.glsl"
#include "/lib/atmosphere/atmosphere.glsl"
#include "/lib/atmosphere/skyObjects.glsl"
#include "/lib/atmosphere/dimensions.glsl"
#include "/lib/atmosphere/sky.glsl"
#include "/lib/atmosphere/clouds.glsl"
#include "/lib/lighting/brdf.glsl"
#include "/lib/lighting/shadows.glsl"
#include "/lib/lighting/ssr.glsl"

/* RENDERTARGETS: 0 */
layout(location = 0) out vec4 outColor;

// What a reflected ray sees when it leaves the screen
vec3 reflectionMiss(vec3 dirW, float skyOcclusion, float dither, bool highQuality) {
    vec3 sky = skyAtmosphere(dirW);
    #if defined OVERWORLD && defined VOLUMETRIC_CLOUDS && defined REFLECTION_CLOUDS
        if (highQuality && dirW.y > 0.0) {
            CloudResult c = marchClouds(dirW, 1e7, lightDirWorld(), vLightCol, vAmbTop, vAmbBottom, dither, max(CLOUD_STEPS / 4, 8));
            sky = sky * c.transmittance + c.scattering;
        }
    #endif
    #ifdef OVERWORLD
        sky += nightSkyEmission(dirW, 0.002, dither, sunTransmittanceAtViewer(dirW)) * 0.7;
    #endif
    // indoor / cave reflections fall back to a dim ambient instead of bright sky
    vec3 indoor = vAmbBottom * 0.15 + vec3(0.002);
    return mix(indoor, sky, skyOcclusion);
}

vec3 waterScatterColor(vec3 tint, float skyLM) {
    vec3 base = vec3(0.012, 0.085, 0.095);
    base = mix(base, srgbToLinear(tint) * 0.12, WATER_BIOME_TINT * 0.6);
    vec3 light = vLightCol * max(lightDirWorld().y, 0.0) * 0.12 + vAmbTop * 0.8 * skyLM + vec3(0.0015);
    #ifdef NETHER
        light = vAmbTop;
    #endif
    return base * light;
}

vec3 waterAbsorptionTinted(vec3 tint) {
    vec3 a = waterAbsorption();
    // biome water colour bends the absorption spectrum (swamps get murky, warm oceans clearer)
    vec3 t = srgbToLinear(tint);
    vec3 tintAbs = -log(clamp(t / maxOf(t), 0.05, 1.0)) * 0.12;
    return mix(a, a + tintAbs, WATER_BIOME_TINT);
}

void main() {
    ivec2 px = ivec2(gl_FragCoord.xy);
    vec2 uv = vUV;
    float z0 = texelFetch(depthtex0, px, 0).r;
    float z1 = texelFetch(depthtex1, px, 0).r;
    vec3 color = texelFetch(colortex0, px, 0).rgb;
    float dither = blueNoise(gl_FragCoord.xy);

    vec2 uvU = uv - taaOffset();
    vec3 viewPos0 = screenToView(vec3(uvU, z0));
    vec3 viewPos1 = screenToView(vec3(uvU, z1));
    vec3 playerPos0 = viewToPlayer(viewPos0);
    vec3 dirW = normalize(mat3(gbufferModelViewInverse) * viewPos0);
    vec3 viewDir = normalize(viewPos0);

    vec4 tData = texelFetch(colortex6, px, 0);
    vec2 maskLM = unpack2x8(tData.z);
    float mask = maskLM.x;
    float waterSkyLM = maskLM.y;
    bool isWater = mask > 0.9 && z0 < 1.0;
    bool isGlass = abs(mask - 0.5) < 0.05 || abs(mask - 0.75) < 0.05;
    bool underwaterView = isEyeInWater == 1;

    if (isWater) {
        //================================================================== WATER
        vec3 n = decodeNormal(tData.xy);
        vec3 tint = unpack565(tData.w);
        vec3 absorb = waterAbsorptionTinted(tint);
        vec3 nView = mat3(gbufferModelView) * n;
        bool fromBelow = underwaterView || dot(n, dirW) > 0.0;
        if (fromBelow) { n = -n; nView = -nView; }

        // ---------- refraction
        vec2 refrUV = uv;
        float waterDepth = length(viewPos1 - viewPos0);
        #ifdef WATER_REFRACTION
            vec2 offset = nView.xy * 0.045 * WATER_REFRACTION_STRENGTH * saturate(waterDepth * 0.35) / (1.0 + length(viewPos0) * 0.03);
            vec2 candidate = uv + offset;
            float zc = texture(depthtex1, candidate).r;
            if (zc > z0 && all(greaterThan(candidate, vec2(0.002))) && all(lessThan(candidate, vec2(0.998)))) refrUV = candidate;
        #endif
        vec3 behind = texture(colortex0, refrUV).rgb;
        float zBehind = texture(depthtex1, refrUV).r;
        vec3 behindView = screenToView(vec3(refrUV - taaOffset(), zBehind));
        float thickness = zBehind >= 1.0 ? 64.0 : length(behindView - viewPos0);

        vec3 transmitted;
        if (!fromBelow) {
            // light travelling through the water body towards the eye
            vec3 T = exp(-absorb * thickness);
            vec3 scatter = waterScatterColor(tint, waterSkyLM);
            transmitted = behind * T + scatter * (1.0 - T);
        } else {
            transmitted = behind; // seen from below: medium handled by the view fog
        }

        // ---------- reflection
        float NdotV = saturate(dot(n, -dirW));
        float F = fromBelow ? fresnelDielectric(NdotV, 1.333) : fresnelDielectric(NdotV, 1.0 / 1.333);
        vec3 R = reflect(dirW, n);
        vec3 Rview = mat3(gbufferModelView) * R;
        vec3 reflection;
        vec3 hit = traceSSR(viewPos0, Rview, dither, SSR_STEPS);
        float skyOcc = smoothstep(0.3, 0.9, waterSkyLM);
        if (fromBelow) {
            // underwater the reflection is the dim water body itself (total internal reflection)
            vec3 deep = waterScatterColor(tint, max(waterSkyLM, float(eyeBrightnessSmooth.y) / 240.0));
            reflection = hit.z > 0.0 ? mix(deep, texture(colortex0, hit.xy).rgb, hit.z) : deep;
        } else {
            vec3 miss = reflectionMiss(R, skyOcc, dither, true);
            reflection = hit.z > 0.0 ? mix(miss, texture(colortex0, hit.xy).rgb, hit.z) : miss;
        }

        color = mix(transmitted, reflection, F);

        // ---------- sun / moon glitter
        #if defined OVERWORLD || defined END
            if (!fromBelow) {
                float NdotL = dot(n, lightDirWorld());
                if (NdotL > 0.0) {
                    vec3 geoN = vec3(0.0, 1.0, 0.0);
                    ShadowResult sr = sampleShadow(playerPos0, geoN, 1.0, dither, false);
                    float cs = 1.0;
                    #ifdef OVERWORLD
                        cs = cloudShadow(playerPos0 + cameraPosition, lightDirWorld());
                    #endif
                    vec3 spec = specularGGX(n, -dirW, lightDirWorld(), 0.045, vec3(0.02), 0.02);
                    color += spec * vLightCol * sr.light * cs * 1.2;
                }
            }
        #endif

        // ---------- foam
        #ifdef WATER_FOAM
            if (!fromBelow) {
                vec3 wp = playerPos0 + cameraPosition;
                float shore = 1.0 - smoothstep(0.0, 0.55, thickness);
                float pattern = fbm2D(wp.xz * 2.6 + frameTimeCounter * vec2(0.25, 0.15), 4);
                float bubbles = smoothstep(0.62, 0.7, fbm2D(wp.xz * 9.0 - frameTimeCounter * 0.3, 2));
                float foam = smoothstep(0.55, 0.85, pattern + shore * 0.35) * shore + bubbles * shore * 0.4;
                foam *= WATER_FOAM_STRENGTH * 0.65;
                vec3 foamLit = vAmbTop * waterSkyLM + vLightCol * max(lightDirWorld().y, 0.0) * INV_PI * 1.5 + vec3(0.01);
                color = mix(color, foamLit * 0.85, saturate(foam));
            }
        #endif
    } else if (isGlass && z0 < z1) {
        //================================================================== GLASS / ICE
        vec3 n = decodeNormal(tData.xy);
        float NdotV = saturate(dot(n, -dirW));
        float F = fresnelDielectric(NdotV, 1.0 / 1.5);
        vec3 R = reflect(dirW, n);
        vec3 hit = traceSSR(viewPos0, mat3(gbufferModelView) * R, dither, max(SSR_STEPS / 2, 12));
        vec3 miss = reflectionMiss(R, smoothstep(0.3, 0.9, waterSkyLM), dither, false);
        vec3 reflection = hit.z > 0.0 ? mix(miss, texture(colortex0, hit.xy).rgb, hit.z) : miss;
        color += reflection * F;
    } else if (z0 < 1.0 && z0 >= HAND_DEPTH && z0 == z1) {
        //================================================================== OPAQUE PBR
        #ifdef PBR_REFLECTIONS
            GData g = unpackGData(texelFetch(colortex1, px, 0), texelFetch(colortex2, px, 0), texelFetch(colortex3, px, 0));
            #ifdef OVERWORLD
                // mirror the wetness logic of the lighting pass for puddles
                float exposure = smoothstep(0.85, 0.97, g.lightmap.y) * wetness;
                float up = smoothstep(0.3, 0.9, g.geoNormal.y);
                g.smoothness = mix(g.smoothness, max(g.smoothness, 0.55 + up * 0.25), exposure * up);
                #ifdef RAIN_PUDDLES
                    float pn = fbm2D((playerPos0.xz + cameraPosition.xz) * 0.35, 3);
                    float puddle = smoothstep(0.62 - PUDDLE_AMOUNT * 0.3, 0.70 - PUDDLE_AMOUNT * 0.3, pn) * up * exposure;
                    if (g.matId == MAT_PLANT || g.matId == MAT_FOLIAGE) puddle = 0.0;
                    g.smoothness = mix(g.smoothness, 0.97, puddle);
                    g.normal = normalize(mix(g.normal, g.geoNormal, puddle));
                #endif
            #endif
            bool metal = isMetal(g.f0);
            float roughness = 1.0 - g.smoothness;
            if (g.smoothness > 0.45 || metal) {
                vec3 f0 = metal ? metalF0(g.f0, g.albedo) : vec3(max(g.f0, 0.02));
                vec3 n = g.normal;
                float NdotV = saturate(dot(n, -dirW));
                vec3 R = reflect(dirW, n);
                #ifdef ROUGH_REFLECTIONS
                    if (roughness > 0.04) {
                        vec2 xi = blueNoise2(gl_FragCoord.xy);
                        xi.y *= 0.75; // trim the long tail to reduce noise
                        vec3 h = tbnFromNormal(n) * sampleGGX(xi, roughness * roughness);
                        vec3 Rs = reflect(dirW, h);
                        if (dot(Rs, n) > 0.0) R = Rs;
                    }
                #endif
                float skyOcc = smoothstep(0.3, 0.9, g.lightmap.y);
                vec3 hit = traceSSR(viewPos0, mat3(gbufferModelView) * R, dither, roughness > 0.3 ? max(SSR_STEPS / 2, 12) : SSR_STEPS);
                vec3 miss = reflectionMiss(R, skyOcc, dither, false);
                vec3 refl = hit.z > 0.0 ? mix(miss, texture(colortex0, hit.xy).rgb, hit.z) : miss;
                vec3 Fenv = envBRDFApprox(f0, NdotV, roughness);
                float fade = smoothstep(0.45, 0.6, g.smoothness);
                if (metal) fade = 1.0;
                color += refl * Fenv * fade;
            }
        #endif
    }

    //====================================================================== VIEW MEDIA
    if (underwaterView) {
        float dist = z0 >= 1.0 ? far : length(viewPos0);
        vec3 tint = vec3(0.25, 0.55, 0.85);
        vec3 absorb = waterAbsorption();
        vec3 T = exp(-absorb * dist * 0.85);
        float skyLM = float(eyeBrightnessSmooth.y) / 240.0;
        vec3 scatter = waterScatterColor(tint, skyLM);
        color = color * T + scatter * (1.0 - T);
    } else if (isEyeInWater == 2) {
        float dist = z0 >= 1.0 ? far : length(viewPos0);
        color = mix(color, vec3(2.2, 0.55, 0.08), 1.0 - exp(-dist * 0.9));
    } else if (isEyeInWater == 3) {
        float dist = z0 >= 1.0 ? far : length(viewPos0);
        color = mix(color, vAmbTop * 1.5 + vec3(0.05), 1.0 - exp(-dist * 0.6));
    }

    outColor = vec4(max(color, vec3(0.0)), 1.0);
}

#endif
