// =====================================================================
//  Water waves and caustics
// =====================================================================

float waveHeight(vec2 p, float t) {
    float h = 0.0;
    h += valueNoise(p * 0.55 + vec2(t * 0.35, t * 0.22)) * 1.00;
    h += valueNoise(p * 1.10 - vec2(t * 0.30, -t * 0.41)) * 0.50;
    h += valueNoise(p * 2.30 + vec2(-t * 0.55, t * 0.48)) * 0.25;
    h += valueNoise(p * 4.70 + vec2(t * 0.80, t * 0.70)) * 0.12;
    return h;
}

// World-space normal of the water surface at worldPos (top faces only)
vec3 waterNormal(vec3 worldPos) {
    vec2 p = worldPos.xz;
    #ifdef PIXELATED_WATER
        // Snap to the 16x16 texel grid: each texel becomes a flat facet,
        // which gives the pixel-sized sun glints seen in Vibrant Visuals.
        p = (floor(p * 16.0) + 0.5) / 16.0;
    #endif
    float t = frameTimeCounter;
    const float e = 1.0 / 16.0;
    float h  = waveHeight(p, t);
    float hx = waveHeight(p + vec2(e, 0.0), t);
    float hz = waveHeight(p + vec2(0.0, e), t);
    // Height gradient is ~1 per block; scale it to gentle slopes
    float strength = 0.09 * WATER_WAVE_STRENGTH;
    return normalize(vec3((h - hx) / e * strength, 1.0, (h - hz) / e * strength));
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
    float c = causticLayer(p * 0.42, t) * 0.65 + causticLayer(p * 0.73 + 3.7, t * 1.3) * 0.45;
    return c;
}
