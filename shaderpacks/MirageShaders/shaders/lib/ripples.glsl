// Rain puddles, raindrop impact ripples and the wake the player leaves in water.
// All functions work on horizontal surfaces in world space and return a slope (d/dx, d/dz)
// that callers turn into a normal:  n = normalize(vec3(-slope.x, 1.0, -slope.y)).

// How much of a surface is covered by standing water (0..1).
// Puddles start in "low spots" of a noise field and spread as the ground gets wetter,
// until whole flat areas turn into shallow pools during long storms.
float getPuddleAmount(vec2 worldXZ, float wet) {
    if (wet <= 0.001) return 0.0;
    float n = noise2D(worldXZ * 0.35) * 0.55 + noise2D(worldXZ * 1.1 + 17.0) * 0.30
            + noise2D(worldXZ * 3.3 + 41.0) * 0.15;
    float threshold = mix(1.05, 0.45, wet) - (PUDDLE_AMOUNT - 1.0) * 0.20;
    return smoothstep(threshold, threshold + 0.10, n);
}

// One layer of raindrop impacts. Every grid cell gets a drop at a random moment, which
// spreads out as a ring with a crest and a trough, then fades.
vec2 rippleLayer(vec2 q, float time, float seed, float density) {
    vec2 slope = vec2(0.0);
    vec2 cell = floor(q);
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 c = cell + vec2(x, y);
            float h = hash12(c + seed);
            float period = 0.9 + h * 0.6;
            float cycle = time / period + h * 7.13;
            float t = fract(cycle);
            float id = floor(cycle);
            // a new random spot (and on/off decision) for every drop
            vec2 rnd = vec2(hash12(c + id * 1.37 + seed + 3.1), hash12(c + id * 2.71 + seed + 9.7));
            if (hash12(c + id * 0.93 + seed + 5.5) > density) continue;
            vec2 center = c + 0.15 + 0.7 * rnd;

            vec2 d = q - center;
            float dist = length(d);
            float radius = t * 0.85;
            float x0 = dist - radius;
            float ring = exp(-x0 * x0 * 120.0);
            float fade = (1.0 - t) * (1.0 - t);
            float wave = sin(x0 * 34.0) * ring * fade;
            // small sharp bump at the moment of impact
            wave += exp(-dist * dist * 900.0) * smoothstep(0.08, 0.0, t) * 1.5;
            slope += d / max(dist, 1e-3) * wave;
        }
    }
    return slope;
}

vec2 getRainRipples(vec2 worldXZ, float intensity) {
    if (intensity <= 0.01) return vec2(0.0);
    float time = frameTimeCounter;
    float density = saturate(intensity * 1.2);
    vec2 slope = rippleLayer(worldXZ * 1.7, time, 0.0, density);
    slope += rippleLayer(worldXZ * 1.7 + vec2(0.37, 0.71), time * 1.13, 19.0, density) * 0.8;
    return slope * 0.11 * RIPPLE_STRENGTH * intensity;
}

// Rings that spread from the player's feet while walking or swimming through water.
// playerPos is relative to the camera; the player's feet are 1.62 blocks below the eye.
vec2 getPlayerRipples(vec3 playerPos) {
    #ifdef PLAYER_RIPPLES
    float speed = saturate(miragePlayerSpeed / 4.3);
    if (speed < 0.02) return vec2(0.0);

    vec3 eye = (eyePosition == vec3(0.0)) ? cameraPosition : eyePosition;
    vec3 rel = playerPos + cameraPosition - eye;
    float feetHeight = rel.y + 1.62;
    if (abs(feetHeight) > 1.4) return vec2(0.0);

    vec2 d = rel.xz;
    float dist = length(d);
    float wave = sin(dist * 10.0 - frameTimeCounter * 9.0) * exp(-dist * 1.1);
    wave *= smoothstep(0.05, 0.45, dist);   // calm right under the feet
    wave *= 1.0 - smoothstep(0.6, 1.4, abs(feetHeight));
    return d / max(dist, 1e-3) * wave * speed * 0.16 * RIPPLE_STRENGTH;
    #else
    return vec2(0.0);
    #endif
}

// Whether rain can reach this spot (sky above it and a biome where it rains, not snows).
float rainExposure(float skyLight) {
    float exposed = smoothstep(0.86, 0.96, skyLight);
    if (biome_precipitation == 2) exposed = 0.0;
    return exposed;
}
