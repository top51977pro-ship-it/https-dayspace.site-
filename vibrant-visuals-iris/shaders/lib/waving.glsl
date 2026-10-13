// Wind animation shared by gbuffers_terrain and the shadow pass
// (both must move vertices identically or shadows detach).

vec3 wavingOffset(vec3 worldPos, int mat, bool top, float skylight) {
    float t = frameTimeCounter * 1.6;
    float wind = 1.0 + rainStrength * 1.5;
    vec3 p = worldPos * 0.5;
    vec3 o = vec3(
        sin(t + p.x * 1.3 + p.z * 0.7) + sin(t * 1.7 + p.z * 1.9) * 0.5,
        0.0,
        cos(t * 1.1 + p.z * 1.1 + p.x * 0.4) + cos(t * 1.9 + p.x * 1.7) * 0.5
    );
    float amount = 0.0;
    if (mat == MAT_PLANT)      amount = top ? 0.06 : 0.0;
    if (mat == MAT_PLANT_TALL) amount = top ? 0.11 : 0.06;  // bottom matches the lower half's top
    if (mat == MAT_LEAVES) {
        amount = 0.025;
        o.y = sin(t * 1.3 + p.x + p.z * 1.7) * 0.6;
    }
    // Don't wave indoors / underground
    return o * amount * wind * WAVING_STRENGTH * smoothstep(0.3, 0.8, skylight);
}
