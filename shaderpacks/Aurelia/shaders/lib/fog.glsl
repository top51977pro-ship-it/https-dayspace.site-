// Distance fog for every dimension + medium (water / lava / powder snow).
// Requires sky.glsl.

// Natural water optics: red is absorbed first, then blue, leaving a clear green-teal tint
// instead of a saturated "pool blue".
const vec3 WATER_ABSORPTION = vec3(0.30, 0.080, 0.075);
const vec3 WATER_SCATTER = vec3(0.026, 0.048, 0.050);

// colour of light scattered inside the water, skyLight = how much sky reaches the water (0..1)
vec3 getWaterScatter(float skyLight) {
    return WATER_SCATTER * (ambientColor * (0.30 + skyLight * 1.3) + lightColor * 0.12 + 0.012);
}

vec3 getWaterFogColor() {
    return getWaterScatter(eyeSky);
}

vec3 applyFog(vec3 color, vec3 playerPos) {
    float dist = length(playerPos);
    vec3 dir = playerPos / max(dist, 1e-4);

    if (isEyeInWater == 1) {
        // colours fade out by wavelength first, then everything sinks into the murk
        vec3 transmit = exp(-WATER_ABSORPTION * dist * 0.55 * WATER_FOG_DENSITY);
        float f = 1.0 - exp(-dist * 0.045 * WATER_FOG_DENSITY);
        return mix(color * transmit, getWaterFogColor(), f);
    }
    if (isEyeInWater == 2) {
        return mix(color, vec3(1.0, 0.22, 0.02) * 1.5, 1.0 - exp(-dist * 0.8));
    }
    if (isEyeInWater == 3) {
        return mix(color, vec3(0.62, 0.72, 0.85) * (ambientColor + 0.05), 1.0 - exp(-dist * 0.6));
    }

    #if defined NETHER
        vec3 fogCol = getNetherFogColor();
        float f = 1.0 - exp(-dist * 0.016 * FOG_DENSITY);
    #elif defined END
        vec3 fogCol = vec3(0.075, 0.045, 0.12);
        float f = 1.0 - exp(-dist * 0.0045 * FOG_DENSITY);
    #else
        vec3 fogCol = getSkyColor(dir);
        float caveDark = mix(0.03, 1.0, saturate(eyeSky * 1.5));
        fogCol *= caveDark;
        float worldY = cameraPosition.y + playerPos.y;
        float heightFalloff = exp(-max(worldY - 62.0, 0.0) * 0.015);
        float morningFog = (1.0 - noonF) * dayF * 0.0025;
        float density = (0.0004 + heightFalloff * 0.0008 + morningFog * heightFalloff + rainStrength * 0.0065) * FOG_DENSITY;
        float f = 1.0 - exp(-dist * density);
    #endif
    color = mix(color, fogCol, f);

    #ifdef BORDER_FOG
        #if defined NETHER
        vec3 borderCol = getNetherFogColor();
        #else
        vec3 borderCol = getSkyColor(dir);
        #endif
        float horizDist = length(playerPos.xz);
        float border = smoothstep(far * 0.72, far * 0.98, horizDist);
        color = mix(color, borderCol, border * border);
    #endif

    float blind = max(blindness, darknessFactor);
    color *= 1.0 - saturate(dist * 0.15 * blind);
    return color;
}

// Fog transparency for the composite pass when looking at water from above.
vec3 waterAbsorption(float dist) {
    return exp(-WATER_ABSORPTION * dist * WATER_FOG_DENSITY);
}
