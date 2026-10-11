// Volumetric light shafts (sun, moon, End light and underwater).
// Requires atmosphere.glsl and shadows.glsl.

// Shafts in air along the camera ray (or through water when the camera is submerged).
vec3 getVolumetricLight(vec3 dir, float dist, float dither) {
    #if defined NETHER
    return vec3(0.0);
    #else
    if (maxOf(lightColor) <= 0.0) return vec3(0.0);

    float VdotL = dot(dir, lightDir);

    #if !defined END
    if (isEyeInWater == 1) {
        // underwater: shafts get their caustic pattern from the water tint in shadowcolor0
        float maxDist = min(dist, 48.0);
        vec3 accum = vec3(0.0);
        for (int i = 0; i < VL_SAMPLES; i++) {
            float t = (float(i) + dither) / float(VL_SAMPLES) * maxDist;
            accum += getShadowVL(dir * t) * exp(-t * 0.08 * WATER_FOG_DENSITY);
        }
        accum *= maxDist / float(VL_SAMPLES);
        float phase = 0.25 + phaseHG(VdotL, 0.65) * 0.12;
        return accum * lightColor * vec3(0.45, 0.58, 0.55) * phase * 0.045 * VL_STRENGTH;
    }
    #endif

    float maxDist = min(dist, shadowDistance * 0.9);
    vec3 accum = vec3(0.0);
    for (int i = 0; i < VL_SAMPLES; i++) {
        float t = (float(i) + dither) / float(VL_SAMPLES);
        accum += getShadowVL(dir * (t * t * maxDist));
    }
    accum /= float(VL_SAMPLES);

    // strong forward scattering makes shafts pop when looking towards the light
    float phase = 0.12 + phaseHG(VdotL, 0.70) * 0.22;
    float depthFactor = 1.0 - exp(-maxDist * 0.02);

    #if defined END
    float amount = 0.08;
    #else
    float amount = mix(0.30, 0.11, noonF) * (1.0 - rainStrength * 0.6);
    amount *= mix(0.2, 1.0, eyeSky);
    #endif

    return accum * lightColor * phase * depthFactor * amount * VL_STRENGTH;
    #endif
}

// Shafts below the water surface, seen from above the water.
// startPos = water surface, endPos = what lies behind it (both player space).
vec3 getUnderwaterLight(vec3 startPos, vec3 endPos, float dither) {
    #if defined NETHER || defined END
    return vec3(0.0);
    #else
    if (maxOf(lightColor) <= 0.0) return vec3(0.0);
    vec3 delta = endPos - startPos;
    float fullLen = length(delta);
    if (fullLen < 0.05) return vec3(0.0);
    vec3 rd = delta / fullLen;
    float len = min(fullLen, 40.0);

    const int samples = VL_SAMPLES / 2 + 2;
    vec3 accum = vec3(0.0);
    for (int i = 0; i < samples; i++) {
        float t = (float(i) + dither) / float(samples) * len;
        vec3 p = startPos + rd * t;
        float depthBelowSurface = max(startPos.y - p.y, 0.0);
        float w = exp(-(t * 0.09 + depthBelowSurface * 0.06) * WATER_FOG_DENSITY);
        accum += getShadowVL(p) * w;
    }
    accum *= len / float(samples);

    float phase = 0.25 + phaseHG(dot(rd, lightDir), 0.65) * 0.12;
    return accum * lightColor * vec3(0.45, 0.58, 0.55) * phase * 0.035 * VL_STRENGTH;
    #endif
}

// Slowly drifting wisps of smoke (Nether) or violet haze (End).
// Returns in-scattered colour in .rgb and transmittance in .a
vec4 getDimensionHaze(vec3 dir, float dist, float dither) {
    #if !defined NETHER && !defined END
    return vec4(0.0, 0.0, 0.0, 1.0);
    #else
    #if defined NETHER
    float maxDist = min(dist, 128.0);
    vec3 hazeCol = getNetherFogColor() * 1.3;
    float density = 0.012;
    #elif defined END
    float maxDist = min(dist, 192.0);
    vec3 hazeCol = vec3(0.30, 0.18, 0.48) * 0.40 + lightColor * 0.04;
    float density = 0.022;
    #endif
    const int steps = 8;
    float stepLen = maxDist / float(steps);
    float time = frameTimeCounter;
    vec3 sum = vec3(0.0);
    float transmittance = 1.0;
    for (int i = 0; i < steps; i++) {
        float t = (float(i) + dither) * stepLen;
        vec3 p = cameraPosition + dir * t;
        vec3 q = p * 0.03 + vec3(time * 0.05, time * 0.02, time * 0.035);
        float n = noise3D(q) * 0.6 + noise3D(q * 2.7 + 5.0) * 0.4;
        float d = smoothstep(0.50, 0.85, n) * density * HAZE_DENSITY;
        #if defined END
        d *= exp(-max(abs(p.y - 55.0) - 12.0, 0.0) * 0.03);
        #endif
        float a = 1.0 - exp(-d * stepLen);
        sum += transmittance * a * hazeCol;
        transmittance *= 1.0 - a;
    }
    return vec4(sum, transmittance);
    #endif
}
