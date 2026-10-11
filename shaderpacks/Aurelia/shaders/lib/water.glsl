// Water surface waves and caustics.

float waterHeight(vec2 p) {
    float t = frameTimeCounter * WATER_WAVE_SPEED;
    float h = 0.0;
    h += noise2D(p * 0.45 + vec2( t * 0.55,  t * 0.30)) * 1.00;
    h += noise2D(p * 0.95 + vec2(-t * 0.80,  t * 0.60)) * 0.50;
    h += noise2D(p * 2.10 + vec2( t * 1.20, -t * 0.90)) * 0.22;
    h += noise2D(p * 4.60 + vec2(-t * 1.60, -t * 1.30)) * 0.08;
    return h;
}

// world-space normal of a horizontal water surface at world xz
vec3 getWaterNormal(vec2 worldXZ, float strength) {
    const float e = 0.06;
    float h0 = waterHeight(worldXZ);
    float hx = waterHeight(worldXZ + vec2(e, 0.0));
    float hz = waterHeight(worldXZ + vec2(0.0, e));
    vec2 slope = vec2(hx - h0, hz - h0) / e;
    return normalize(vec3(-slope.x * 0.22 * strength, 1.0, -slope.y * 0.22 * strength));
}

float getCaustics(vec3 worldPos) {
    float t = frameTimeCounter * WATER_WAVE_SPEED;
    vec2 p = worldPos.xz + worldPos.y * 0.3;
    float a = noise2D(p * 0.85 + vec2(t * 0.7, t * 0.4));
    float b = noise2D(p * 1.10 - vec2(t * 0.5, -t * 0.6) + 31.0);
    float c = 1.0 - abs(a - b);
    return pow(c, 12.0) * 2.4 + 0.25;
}

vec3 getWaterTint(vec3 vertexColor) {
    // vanilla biome water colour, nudged towards a clean turquoise
    vec3 tint = toLinear(vertexColor);
    return mix(vec3(0.08, 0.42, 0.55), tint * 1.6, 0.45);
}
