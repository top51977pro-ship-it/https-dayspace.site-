// =====================================================================
//  Water: waves, caustics and the Vibrant Visuals water look.
//
//  Bedrock's default water.json has no chlorophyll, sediment or CDOM,
//  i.e. pure water: red is absorbed within a few blocks, green slower,
//  blue slowest. That is what makes shallows over sand turquoise and
//  deep water blue, so we use pure-water absorption per channel.
// =====================================================================

// Absorption per block (~1 m). Pure water is ~(0.45, 0.07, 0.02) / m;
// slightly stronger here so deep water reads blue at Minecraft depths.
vec3 waterAbsorption() { return vec3(0.42, 0.095, 0.04) / WATER_CLARITY; }

float waveHeight(vec2 p, float t) {
    float h = 0.0;
    h += valueNoise(p * 0.55 + vec2(t * 0.35, t * 0.22)) * 1.00;
    h += valueNoise(p * 1.10 - vec2(t * 0.30, -t * 0.41)) * 0.50;
    h += valueNoise(p * 2.30 + vec2(-t * 0.55, t * 0.48)) * 0.25;
    h += valueNoise(p * 4.70 + vec2(t * 0.80, t * 0.70)) * 0.12;
    return h;
}

// World-space normal of the water surface at worldPos (top faces only).
// dist = distance from the camera: detail fades out far away so distant
// water becomes a calm mirror instead of shimmering noise.
vec3 waterNormal(vec3 worldPos, float dist) {
    vec2 p = worldPos.xz;
    vec2 texel = floor(p * 16.0);
    #ifdef PIXELATED_WATER
        // Snap to the 16x16 texel grid: each texel becomes a flat facet,
        // which gives the pixel-sized sun glints seen in Vibrant Visuals.
        p = (texel + 0.5) / 16.0;
    #endif
    float t = frameTimeCounter;
    const float e = 1.0 / 16.0;
    float h  = waveHeight(p, t);
    float hx = waveHeight(p + vec2(e, 0.0), t);
    float hz = waveHeight(p + vec2(0.0, e), t);
    // Height gradient is ~1 per block; scale it to gentle slopes
    float strength = 0.06 * WATER_WAVE_STRENGTH * mix(1.0, 0.06, smoothstep(6.0, 40.0, dist));
    vec2 slope = vec2(h - hx, h - hz) / e * strength;

    // Per-texel random tilt that slowly changes: single pixels glitter
    vec2 j = hash22(texel + floor(t * 1.5 + hash12(texel) * 7.0) * 17.31) - 0.5;
    slope += j * 0.07 * WATER_SPARKLE * (1.0 - smoothstep(6.0, 28.0, dist));

    return normalize(vec3(slope.x, 1.0, slope.y));
}

// Animated caustic network (bright lines where voronoi cells meet)
float causticLayer(vec2 p, float t) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float d1 = 8.0, d2 = 8.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 g = vec2(x, y);
            vec2 o = hash22(i + g);
            o = 0.5 + 0.42 * sin(t + TAU * o);
            float d = length(g + o - f);
            if (d < d1) { d2 = d1; d1 = d; }
            else if (d < d2) { d2 = d; }
        }
    }
    return 1.0 - smoothstep(0.0, 0.16, d2 - d1);
}

float waterCaustics(vec3 worldPos, vec3 lightDirWorld) {
    // Project along the light so patterns line up with the sun
    vec2 p = worldPos.xz - lightDirWorld.xz / max(lightDirWorld.y, 0.2) * worldPos.y;
    #ifdef PIXELATED_WATER
        p = (floor(p * 16.0) + 0.5) / 16.0;
    #endif
    float t = frameTimeCounter * 0.9;
    float c = causticLayer(p * 0.95, t) * 0.6 + causticLayer(p * 1.6 + 3.7, t * 1.3) * 0.45;
    return c;
}

// ---------------------------------------------------------------------
//  Full water surface shading (used in composite.fsh).
//   under:  scene colour behind the water surface
//   thick:  metres of water the view ray travels
//   tint:   biome water colour (linear)
//   N, V, L: surface normal, view direction, light direction (same space)
//   refl:   reflected colour (SSR or sky)
// ---------------------------------------------------------------------
vec3 shadeWater(vec3 under, float thick, vec3 tint, vec3 N, vec3 V, vec3 L,
                vec3 lightCol, vec3 ambient, vec2 lm, float shadow, vec3 refl) {
    vec3 T = exp(-waterAbsorption() * thick);

    // Light scattered back toward the eye by the water itself: blue-cyan.
    // The biome colour nudges it (swamps greener, warm oceans more cyan).
    vec3 tintDir = tint / max(luminance(tint), 1e-3);
    vec3 scatterAlbedo = mix(vec3(0.012, 0.10, 0.21), vec3(0.012, 0.10, 0.21) * tintDir * 0.8, 0.3);
    vec3 inLight = ambient * lm.y * lm.y + lightCol * shadow * 0.3
                 + vec3(1.0, 0.56, 0.24) * pow(lm.x, 3.0) * 1.5 + 0.002;
    vec3 c = under * T + inLight * scatterAlbedo * (1.0 - T);

    // Fresnel reflection (water F0 = 0.02)
    float NdotV = saturate(dot(N, -V));
    float fres = 0.02 + 0.98 * pow(1.0 - NdotV, 5.0);
    c = mix(c, refl, fres);

    // Sun glints on the pixel facets
    vec3 H = normalize(L - V);
    float NdotH = saturate(dot(N, H));
    vec3 spec = lightCol * shadow * (pow(NdotH, 2000.0) * 90.0 + pow(NdotH, 180.0) * 1.0) * (0.25 + fres);
    return c + spec;
}
