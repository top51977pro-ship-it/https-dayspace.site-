// Realistic rain streaks drawn on the vanilla weather quads.
// The weather quads are vertical strips around the player: every strip holds a few columns of
// drops, each drop has its own speed, spacing and trail length, a bright head and a fading trail.
// Returns drop coverage 0..1.
float rainStreaks(vec2 uv, vec3 worldPos, float time) {
    float drop = 0.0;
    for (int layer = 0; layer < 2; layer++) {
        float cols = layer == 0 ? 6.0 : 10.0;
        float u = uv.x * cols + float(layer) * 0.37;
        float fx = fract(u) - 0.5;
        float h = hash12(vec2(floor(u) + float(layer) * 101.0, floor(worldPos.x) * 3.1 + floor(worldPos.z) * 7.7));
        float speed = 16.0 + h * 7.0;
        float period = 2.0 + h * 2.5;
        float trail = 0.40 + h * 0.35;
        float f = fract((worldPos.y + time * speed + h * 37.0) / period) * period;
        float streak = smoothstep(0.0, 0.03, f) * pow(saturate(1.0 - f / trail), 1.5);
        float width = exp(-fx * fx * (layer == 0 ? 600.0 : 900.0));
        drop = max(drop, streak * width * (layer == 0 ? 1.0 : 0.65));
    }
    return drop;
}
