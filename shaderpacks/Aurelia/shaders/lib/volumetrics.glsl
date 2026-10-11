// Volumetric light shafts (sun, moon, End light and underwater).
// Requires atmosphere.glsl and shadows.glsl.

vec3 getVolumetricLight(vec3 dir, float dist, float dither) {
    #if defined NETHER
    return vec3(0.0);
    #else
    if (maxOf(lightColor) <= 0.0) return vec3(0.0);

    float maxDist = min(dist, shadowDistance * 0.9);
    vec3 accum = vec3(0.0);
    for (int i = 0; i < VL_SAMPLES; i++) {
        float t = (float(i) + dither) / float(VL_SAMPLES);
        accum += getShadowVL(dir * (t * t * maxDist));
    }
    accum /= float(VL_SAMPLES);

    float VdotL = dot(dir, lightDir);
    float phase = 0.05 + phaseHG(VdotL, 0.75) * 0.12;
    float depthFactor = 1.0 - exp(-maxDist * 0.015);

    #if defined END
    float amount = 0.06;
    vec3 tint = vec3(1.0);
    #else
    float amount = mix(0.10, 0.025, noonF) * (1.0 - rainStrength * 0.6);
    amount *= mix(0.15, 1.0, eyeSky);
    vec3 tint = vec3(1.0);
    if (isEyeInWater == 1) {
        amount = 0.35;
        tint = vec3(0.20, 0.65, 0.80);
        phase = 0.15 + phaseHG(VdotL, 0.6) * 0.08;
    }
    #endif

    return accum * lightColor * tint * phase * depthFactor * amount * VL_STRENGTH;
    #endif
}
