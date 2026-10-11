// Space conversion helpers and TAA jitter.

vec3 projectAndDivide(mat4 m, vec3 p) {
    vec4 h = m * vec4(p, 1.0);
    return h.xyz / h.w;
}

vec3 screenToView(vec2 uv, float depth) {
    return projectAndDivide(gbufferProjectionInverse, vec3(uv, depth) * 2.0 - 1.0);
}

vec3 viewToScreen(vec3 viewPos) {
    return projectAndDivide(gbufferProjection, viewPos) * 0.5 + 0.5;
}

vec3 viewToPlayer(vec3 viewPos) {
    return mat3(gbufferModelViewInverse) * viewPos + gbufferModelViewInverse[3].xyz;
}

vec3 playerToView(vec3 playerPos) {
    return mat3(gbufferModelView) * playerPos + gbufferModelView[3].xyz;
}

const vec2 haltonSequence[8] = vec2[8](
    vec2(0.500000, 0.333333), vec2(0.250000, 0.666667),
    vec2(0.750000, 0.111111), vec2(0.125000, 0.444444),
    vec2(0.625000, 0.777778), vec2(0.375000, 0.222222),
    vec2(0.875000, 0.555556), vec2(0.062500, 0.888889)
);

vec2 taaJitter() {
    return (haltonSequence[frameCounter % 8] * 2.0 - 1.0) / vec2(viewWidth, viewHeight);
}

void applyTAAJitter(inout vec4 clipPos) {
    #ifdef TAA
    clipPos.xy += taaJitter() * clipPos.w;
    #endif
}

// Temporal dither in [0,1): varies per frame when TAA can resolve it.
float getDither(vec2 fragCoord) {
    float d = interleavedGradientNoise(fragCoord);
    #ifdef TAA
    d = fract(d + float(frameCounter % 64) * 0.61803398875);
    #endif
    return d;
}
