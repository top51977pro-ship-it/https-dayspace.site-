// Main surface lighting model used by the deferred pass and the forward (translucent) programs.
// Requires atmosphere.glsl, shadows.glsl (when shadows exist) and clouds.glsl (overworld).

#if !defined NETHER
#define HAS_SHADOWS
#endif

float blockLightFalloff(float bl) {
    return pow(bl, 4.0) * 1.20 + bl * bl * 0.30;
}

vec3 getBlockLighting(float bl, float dist) {
    float f = blockLightFalloff(bl);
    #ifdef HANDHELD_LIGHT
    float held = float(max(heldBlockLightValue, heldBlockLightValue2));
    if (held > 0.5) {
        float hl = saturate((held - dist) / 15.0);
        f = max(f, blockLightFalloff(hl));
    }
    #endif
    return getBlockLightColor() * f * BLOCKLIGHT_STRENGTH;
}

vec3 getAmbientLighting(vec3 normalW, float skyLm) {
    #if defined NETHER
    // ceilings and overhangs catch a warm bounce from the lava seas below
    float underside = saturate(-normalW.y * 0.5 + 0.5);
    return ambientColor * (0.85 + 0.15 * normalW.y) + vec3(1.0, 0.32, 0.08) * 0.05 * underside * AMBIENT_STRENGTH;
    #elif defined END
    return ambientColor * (0.80 + 0.20 * normalW.y);
    #else
    float skyAmt = skyLm * skyLm;
    return ambientColor * skyAmt * (0.62 + 0.38 * normalW.y);
    #endif
}

vec3 getMinimumLight() {
    return vec3(0.60, 0.72, 1.00) * 0.0045 * MIN_LIGHT + vec3(0.45, 0.50, 0.55) * nightVision * 0.6;
}

// shadowOut returns the computed shadow so callers can reuse it (water specular etc.)
vec3 computeLighting(vec3 albedo, vec3 normalW, vec3 playerPos, vec2 lm, float ao, float sss,
                     float smoothness, float f0, float emission, float dither, out vec3 shadowOut) {
    float dist = max(length(playerPos), 1e-4);
    vec3 viewDir = -playerPos / dist;
    vec3 direct = vec3(0.0);
    shadowOut = vec3(0.0);

    #ifdef HAS_SHADOWS
    float NdotL = dot(normalW, lightDir);
    float diffuse = saturate(NdotL);
    #ifdef SUBSURFACE_SCATTERING
    diffuse = mix(diffuse, abs(NdotL) * 0.45 + 0.30, sss);
    #endif

    if (diffuse > 0.0001 && maxOf(lightColor) > 0.0) {
        vec3 shadow = getShadow(playerPos, normalW, sss, dither);
        float fade = smoothstep(shadowDistance * 0.75, shadowDistance * 0.95, dist);
        #ifdef OVERWORLD
        shadow = mix(shadow, vec3(smoothstep(0.85, 0.97, lm.y)), fade);
        shadow *= smoothstep(0.02, 0.25, lm.y);
        #if defined CLOUD_SHADOWS && defined VOLUMETRIC_CLOUDS
        shadow *= cloudShadowAt(playerPos + cameraPosition, lightDir);
        #endif
        #else
        shadow = mix(shadow, vec3(1.0), fade);
        #endif
        shadowOut = shadow;
        direct = lightColor * diffuse * shadow;

        #ifdef SUBSURFACE_SCATTERING
        float VdotL = saturate(dot(-viewDir, lightDir));
        direct += lightColor * shadow * sss * pow(VdotL, 6.0) * 1.6;
        #endif
    }
    #endif

    vec3 ambient = getAmbientLighting(normalW, lm.y) * ao;
    vec3 block = getBlockLighting(lm.x, dist) * mix(1.0, ao, 0.6);
    vec3 color = albedo * (direct + ambient + block + getMinimumLight());

    color += albedo * emission * 3.5 * EMISSIVE_STRENGTH;

    #ifdef HAS_SHADOWS
    if (smoothness > 0.05 && maxOf(shadowOut) > 0.0) {
        float spec = specularGGX(normalW, viewDir, lightDir, 1.0 - smoothness, f0);
        vec3 specTint = f0 > 0.5 ? albedo : vec3(1.0);
        color += lightColor * shadowOut * specTint * min(spec, 40.0);
    }
    #endif

    return color;
}
