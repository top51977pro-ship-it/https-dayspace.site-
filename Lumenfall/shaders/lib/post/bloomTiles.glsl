/*
    Lumenfall - bloom tile atlas layout (colortex7)
    Level i (1..7) stores the scene downsampled by 2^i, laid out without overlap.
*/

const int BLOOM_LEVELS = 7;

vec4 bloomTileRect(int level) {
    // returns offset.xy, size.xy in uv
    vec2 pad = 4.0 / vec2(viewWidth, viewHeight);
    float s = exp2(-float(level));
    if (level == 1) return vec4(0.0, 0.0, s, s);
    if (level == 2) return vec4(0.5 + pad.x, 0.0, s, s);
    float x = 0.5 + pad.x;
    for (int i = 3; i < level; i++) x += exp2(-float(i)) + pad.x;
    return vec4(x, 0.25 + pad.y, s, s);
}
