// Water surface waves and caustics.

float waterHeight(vec2 p) {
    float t = frameTimeCounter * WATER_WAVE_SPEED;
    float h = 0.0;
    h += noise2D(p * 0.22 + vec2( t * 0.30,  t * 0.18)) * 1.00;
    h += noise2D(p * 0.50 + vec2(-t * 0.45,  t * 0.35)) * 0.45;
    h += noise2D(p * 1.15 + vec2( t * 0.70, -t * 0.55)) * 0.16;
    h += noise2D(p * 2.40 + vec2(-t * 0.90, -t * 0.80)) * 0.04;
    return h;
}

// world-space normal of a horizontal water surface at world xz
vec3 getWaterNormal(vec2 worldXZ, float strength) {
    const float e = 0.1;
    float h0 = waterHeight(worldXZ);
    float hx = waterHeight(worldXZ + vec2(e, 0.0));
    float hz = waterHeight(worldXZ + vec2(0.0, e));
    vec2 slope = vec2(hx - h0, hz - h0) / e;
    return normalize(vec3(-slope.x * 0.16 * strength, 1.0, -slope.y * 0.16 * strength));
}

float getCaustics(vec3 worldPos) {
    float t = frameTimeCounter * WATER_WAVE_SPEED;
    vec2 p = worldPos.xz + worldPos.y * 0.3;
    float a = noise2D(p * 0.85 + vec2(t * 0.7, t * 0.4));
    float b = noise2D(p * 1.10 - vec2(t * 0.5, -t * 0.6) + 31.0);
    float c = 1.0 - abs(a - b);
    return pow(c, 10.0) * 1.1 + 0.55;
}

vec3 getWaterTint(vec3 vertexColor) {
    // vanilla biome water colour, heavily desaturated so swamps still read greener than oceans
    vec3 biome = toLinear(vertexColor);
    biome = mix(vec3(luminance(biome)), biome, 0.35);
    return mix(vec3(0.060, 0.080, 0.080), biome * 0.40, 0.25);
}
