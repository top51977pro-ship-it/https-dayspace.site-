// =====================================================================
//  Shadow mapping. The distortion here must match shadow.vsh.
// =====================================================================

#define SHADOW_DISTORT 0.85
// Shadow depth is squashed by this in the shadow pass (more depth range)
#define SHADOW_Z_SCALE 0.2

vec3 distortShadow(vec3 p) {
    float d = length(p.xy) * SHADOW_DISTORT + (1.0 - SHADOW_DISTORT);
    p.xy /= d;
    p.z *= SHADOW_Z_SCALE;
    return p;
}

#ifndef NO_SKY
uniform sampler2D shadowtex0;   // everything, including water and glass
uniform sampler2D shadowtex1;   // opaque only

// playerPos -> undistorted shadow clip space
vec3 playerToShadowClip(vec3 playerPos) {
    vec4 p = shadowProjection * (shadowModelView * vec4(playerPos, 1.0));
    return p.xyz / p.w;
}

struct ShadowResult {
    float light;       // 0 = shadowed, 1 = lit
    float waterDepth;  // blocks of translucent (water) between surface and the sun, 0 if none
};

ShadowResult getShadow(vec3 playerPos, vec3 worldNormal, float NdotL, bool foliage, float dither) {
    ShadowResult r;
    r.light = 1.0;
    r.waterDepth = 0.0;

    vec3 clip = playerToShadowClip(playerPos);
    float distortFactor = length(clip.xy) * SHADOW_DISTORT + (1.0 - SHADOW_DISTORT);

    // Normal offset, scaled by the size of one shadow texel at this spot
    float texelWorld = (2.0 * shadowDistance / float(shadowMapResolution)) * distortFactor;
    vec3 offsetNormal = foliage ? vec3(0.0) : worldNormal * texelWorld * (1.6 + 2.0 * (1.0 - abs(NdotL)));
    clip = playerToShadowClip(playerPos + offsetNormal);

    vec3 sp = distortShadow(clip) * 0.5 + 0.5;
    if (any(lessThan(sp, vec3(0.0))) || any(greaterThan(sp, vec3(1.0)))) return r;

    float bias = foliage ? 0.0006 : 0.00008;
    float z = sp.z - bias;

    // Vogel disk PCF rotated by dither
    float radius = SHADOW_SOFTNESS * 1.25 / float(shadowMapResolution);
    float rot = dither * TAU;
    float lit = 0.0;
    #if SHADOW_SAMPLES <= 1
        lit = step(z, texture(shadowtex1, sp.xy).r);
    #else
        for (int i = 0; i < SHADOW_SAMPLES; i++) {
            float fi = float(i) + 0.5;
            float rr = sqrt(fi / float(SHADOW_SAMPLES));
            float th = fi * 2.39996323 + rot;
            vec2 o = vec2(cos(th), sin(th)) * rr * radius;
            lit += step(z, texture(shadowtex1, sp.xy + o).r);
        }
        lit /= float(SHADOW_SAMPLES);
    #endif
    r.light = lit;

    // Water above us? shadowtex0 includes translucents, shadowtex1 does not.
    float d0 = texture(shadowtex0, sp.xy).r;
    if (d0 < z && lit > 0.0) {
        // Shadow depth (0..1) spans ~256 blocks, squashed by SHADOW_Z_SCALE
        r.waterDepth = max((z - d0) * 256.0 / SHADOW_Z_SCALE, 0.0);
    }

    // Fade out at the edge of the shadow map
    float edge = smoothstep(0.85, 0.98, max(abs(clip.x), abs(clip.y)));
    r.light = mix(r.light, 1.0, edge);
    if (edge > 0.99) r.waterDepth = 0.0;
    return r;
}

// Single-tap test for volumetric light
float shadowTap(vec3 playerPos) {
    vec3 sp = distortShadow(playerToShadowClip(playerPos)) * 0.5 + 0.5;
    if (any(lessThan(sp.xy, vec2(0.0))) || any(greaterThan(sp.xy, vec2(1.0)))) return 1.0;
    return step(sp.z - 0.0002, texture(shadowtex1, sp.xy).r);
}
#endif
