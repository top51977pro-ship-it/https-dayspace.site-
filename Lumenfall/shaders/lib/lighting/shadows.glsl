/*
    Lumenfall - shadows
    PCSS soft shadows (blocker search + variable-radius PCF on hardware-filtered
    shadow map), coloured translucent shadows, underwater light transport
    (caustics + absorption), subsurface thickness estimate.
    Needs space.glsl, noise.glsl, waves.glsl.
*/

uniform sampler2D       shadowtex0;   // raw depth incl. translucents
uniform sampler2DShadow shadowtex1;   // opaque only, hardware compare
uniform sampler2D       shadowcolor0; // translucent tint
uniform sampler2D       shadowcolor1; // r = water flag

struct ShadowResult {
    vec3  light;      // coloured visibility (includes water transport)
    float opaque;     // opaque-only visibility
    float thickness;  // blocks of occluder in front of receiver (for SSS)
};

vec2 vogelDisk(int i, int n, float phi) {
    float r = sqrt((float(i) + 0.5) / float(n));
    float theta = float(i) * GOLDEN_ANGLE + phi;
    return r * vec2(cos(theta), sin(theta));
}

// Blocks per unit of shadow screen depth
float shadowDepthScale() {
    return 1.0 / abs(0.125 * shadowProjection[2][2]);
}

ShadowResult sampleShadow(vec3 playerPos, vec3 geoNormal, float NdotL, float dither, bool foliage) {
    ShadowResult r;
    r.light = vec3(1.0);
    r.opaque = 1.0;
    r.thickness = 0.0;

    #ifndef SHADOWS
        return r;
    #else
    float dist = length(playerPos);
    float fade = smoothstep(shadowDistance * 0.92, shadowDistance, dist);
    if (fade >= 1.0) return r;

    // normal offset bias scaled with distance & resolution
    float texelWorld = 2.0 * shadowDistance / float(shadowMapResolution);
    float bias = texelWorld * (1.2 + dist * 0.012) * (foliage ? 0.6 : 1.0);
    vec3 offsetPos = playerPos + geoNormal * bias * (foliage ? 0.5 : (1.0 + 2.0 * (1.0 - abs(NdotL))));
    // thin foliage would shadow itself (crossed quads, leaf layers): step towards the light first
    if (foliage) offsetPos += lightDirWorld() * (0.35 + bias);

    vec3 clip = playerToShadowClip(offsetPos);
    float distortF = shadowDistortFactor(clip.xy);
    vec3 sp = distortShadow(clip) * 0.5 + 0.5;
    if (any(greaterThan(abs(sp.xy - 0.5), vec2(0.5)))) return r;

    float texel = 1.0 / float(shadowMapResolution);
    float phi = dither * TAU;
    float zScale = shadowDepthScale();
    // size of one world block in shadow uv near this point
    float blockToUV = abs(shadowProjection[0][0]) * 0.5 / distortF;

    float receiver = sp.z - 0.00002;

    // --- blocker search ------------------------------------------------------
    float searchRadius = 1.6 * blockToUV * SHADOW_SOFTNESS + 2.0 * texel;
    float blockerSum = 0.0, blockerCount = 0.0;
    float centerBlocker = texelFetch(shadowtex0, ivec2(sp.xy * float(shadowMapResolution)), 0).r;
    #if SHADOW_FILTER == 2
        for (int i = 0; i < SHADOW_BLOCKER_SAMPLES; i++) {
            vec2 o = vogelDisk(i, SHADOW_BLOCKER_SAMPLES, phi) * searchRadius;
            float d = texelFetch(shadowtex0, ivec2((sp.xy + o) * float(shadowMapResolution)), 0).r;
            if (d < receiver) { blockerSum += d; blockerCount += 1.0; }
        }
    #endif

    // thickness for SSS from the center blocker
    r.thickness = max(receiver - centerBlocker, 0.0) * zScale;

    float radius = 1.0 * texel;
    #if SHADOW_FILTER == 2
        if (blockerCount < 0.5) {
            // nothing occludes within the search radius: fully lit (cheap path)
            if (centerBlocker >= receiver) {
                r.light = vec3(1.0);
                r.opaque = 1.0;
                return r;
            }
        } else {
            float avgBlocker = blockerSum / blockerCount;
            float penumbraBlocks = (receiver - avgBlocker) * zScale * 0.022 * SHADOW_SOFTNESS;
            radius = clamp(penumbraBlocks * blockToUV, 1.0 * texel, searchRadius);
        }
    #elif SHADOW_FILTER == 1
        radius = 1.5 * texel * SHADOW_SOFTNESS;
    #endif

    // --- filtering -----------------------------------------------------------
    float vis = 0.0, visAll = 0.0;
    #if SHADOW_FILTER == 0
        vis = texture(shadowtex1, vec3(sp.xy, receiver));
        visAll = step(receiver, centerBlocker);
    #else
        for (int i = 0; i < SHADOW_SAMPLES; i++) {
            vec2 o = vogelDisk(i, SHADOW_SAMPLES, phi) * radius;
            vis += texture(shadowtex1, vec3(sp.xy + o, receiver));
            #ifdef COLORED_SHADOWS
                visAll += step(receiver, texelFetch(shadowtex0, ivec2((sp.xy + o) * float(shadowMapResolution)), 0).r);
            #endif
        }
        vis /= float(SHADOW_SAMPLES);
        #ifdef COLORED_SHADOWS
            visAll /= float(SHADOW_SAMPLES);
        #else
            visAll = vis;
        #endif
    #endif

    r.opaque = vis;
    r.light = vec3(vis);

    #ifdef COLORED_SHADOWS
        float translucentOnly = saturate(vis - visAll);
        if (translucentOnly > 0.001) {
            ivec2 stc = ivec2(sp.xy * float(shadowMapResolution));
            vec4 tint = texelFetch(shadowcolor0, stc, 0);
            float isWater = texelFetch(shadowcolor1, stc, 0).r;
            vec3 transmitted;
            if (isWater > 0.5) {
                // underwater: absorption along the light path + caustics
                float waterDepth = max(receiver - centerBlocker, 0.0) * zScale;
                vec3 wp = playerPos + cameraPosition;
                vec3 L = lightDirWorld();
                transmitted = exp(-waterAbsorption() * waterDepth) * waterCaustics(wp, L, waterDepth);
            } else {
                vec3 c = srgbToLinear(tint.rgb);
                transmitted = mix(vec3(1.0), c * (1.0 - tint.a * 0.35), sqrt(tint.a));
            }
            r.light = vec3(visAll) + transmitted * translucentOnly;
        }
    #endif

    r.light = mix(r.light, vec3(1.0), fade);
    r.opaque = mix(r.opaque, 1.0, fade);
    return r;
    #endif
}
