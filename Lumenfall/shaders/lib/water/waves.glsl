/*
    Lumenfall - water surface
    Choppy directional waves with deep-water dispersion and gradient "drag"
    (crests sharpen and lean), detail ripples, rain drop rings and caustics.
    Needs noise.glsl.
*/

float waterTime() { return frameTimeCounter * WATER_WAVE_SPEED; }

// Height in blocks. p = world xz.
float waterHeightOctaves(vec2 p, int octaves) {
    p /= WATER_WAVE_SCALE;
    float t = waterTime();
    float h = 0.0, wSum = 0.0;
    float amp = 1.0, freq = 0.55, angle = 0.4;
    for (int i = 0; i < octaves; i++) {
        vec2 dir = vec2(cos(angle), sin(angle));
        float k = freq;
        float omega = sqrt(9.8 * k) * 0.9;                 // dispersion: long waves travel faster
        float x = dot(dir, p) * k + t * omega;
        float s = exp(sin(x) - 1.0);                       // sharp crest, wide trough
        float ds = s * cos(x);
        h += s * amp;
        wSum += amp;
        p -= dir * ds * amp * 0.32 / k * 0.6;              // drag: choppiness
        angle += GOLDEN_ANGLE * 1.13;
        freq *= 1.21;
        amp *= 0.78;
    }
    h /= wSum;
    // fine capillary detail
    h += (noise2D(p * 3.1 + t * vec2(0.6, 0.35)) - 0.5) * 0.05;
    return h * 0.16 * WATER_WAVE_HEIGHT;
}

float waterHeight(vec2 p) { return waterHeightOctaves(p, WATER_WAVE_OCTAVES); }

vec3 waterNormalOctaves(vec2 p, int octaves) {
    const float e = 0.035;
    float h  = waterHeightOctaves(p, octaves);
    float hx = waterHeightOctaves(p + vec2(e, 0.0), octaves);
    float hz = waterHeightOctaves(p + vec2(0.0, e), octaves);
    return normalize(vec3(h - hx, e, h - hz));
}

vec3 waterNormal(vec2 p) { return waterNormalOctaves(p, WATER_WAVE_OCTAVES); }

// Expanding rain-drop rings (normal perturbation in xz)
vec2 rainRipples(vec2 p, float amount) {
    if (amount < 0.01) return vec2(0.0);
    vec2 grad = vec2(0.0);
    float t = frameTimeCounter * 1.3;
    for (int layer = 0; layer < 2; layer++) {
        vec2 q = p * (1.6 + float(layer) * 0.7) + float(layer) * 7.3;
        vec2 cell = floor(q);
        for (int y = -1; y <= 1; y++)
        for (int x = -1; x <= 1; x++) {
            vec2 c = cell + vec2(x, y);
            vec2 rnd = hash22(c);
            float life = fract(t + rnd.x);
            if (hash12(c + floor(t + rnd.x) * 3.1) > amount) continue;
            vec2 center = c + 0.2 + rnd * 0.6;
            vec2 d = q - center;
            float dist = length(d);
            float radius = life * 0.9;
            float ring = sin((dist - radius) * 28.0) * smoothstep(0.14, 0.0, abs(dist - radius));
            ring *= (1.0 - life) * (1.0 - life);
            grad += d / max(dist, 1e-3) * ring;
        }
    }
    return grad * 0.22;
}

//----------------------------------------------------------------------------------//
// Caustics: light converging through the wave surface.
// worldPos is the receiving point, depth the water depth above it along the light.
//----------------------------------------------------------------------------------//
float waterCaustics(vec3 worldPos, vec3 lightDir, float depth) {
    #ifndef WATER_CAUSTICS
        return 1.0;
    #else
        const int oct = 5;
        const float e = 0.12;
        vec3 l = -lightDir;
        // point on the surface above the receiver
        vec2 s = worldPos.xz - lightDir.xz / max(lightDir.y, 0.2) * depth;
        float d = clamp(depth, 0.0, 8.0);
        vec2 q0 = s + refract(l, waterNormalOctaves(s, oct), 0.75).xz * d * 1.6;
        vec2 q1 = s + vec2(e, 0.0) + refract(l, waterNormalOctaves(s + vec2(e, 0.0), oct), 0.75).xz * d * 1.6;
        vec2 q2 = s + vec2(0.0, e) + refract(l, waterNormalOctaves(s + vec2(0.0, e), oct), 0.75).xz * d * 1.6;
        float area = abs((q1.x - q0.x) * (q2.y - q0.y) - (q1.y - q0.y) * (q2.x - q0.x));
        float c = (e * e) / max(area, 1e-5);
        c = clamp(c, 0.1, 6.0);
        // shallow water barely focuses light
        c = mix(1.0, c, smoothstep(0.0, 1.5, depth));
        return mix(1.0, c, WATER_CAUSTICS_STRENGTH * 0.85);
    #endif
}

vec3 waterAbsorption() {
    return vec3(WATER_ABSORB_R, WATER_ABSORB_G, WATER_ABSORB_B) * WATER_FOG_DENSITY;
}
