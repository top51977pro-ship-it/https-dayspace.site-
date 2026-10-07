/*
    Lumenfall - Nether & End environments
*/

vec3 netherBiomeColor() {
    vec3 wastes  = vec3(0.42, 0.10, 0.035);
    vec3 crimson = vec3(0.46, 0.06, 0.05);
    vec3 warped  = vec3(0.05, 0.20, 0.22);
    vec3 basalt  = vec3(0.20, 0.17, 0.19);
    vec3 soul    = vec3(0.06, 0.17, 0.23);
    float wSum = lf_netherWastes + lf_crimson + lf_warped + lf_basalt + lf_soulValley;
    vec3 c = wastes * lf_netherWastes + crimson * lf_crimson + warped * lf_warped + basalt * lf_basalt + soul * lf_soulValley;
    vec3 vanilla = srgbToLinear(fogColor) * 1.6 + 0.01;
    return wSum > 0.05 ? mix(vanilla, c / wSum, 0.75) : vanilla;
}

vec3 netherAmbient() { return netherBiomeColor() * 0.55 + vec3(0.02, 0.012, 0.01); }

vec3 endAmbient() { return vec3(0.075, 0.055, 0.12); }
vec3 endLightColor() { return vec3(0.85, 0.75, 1.0) * 1.4; }

vec3 endSky(vec3 dir, float pixelAngle) {
    vec3 col = vec3(0.004, 0.002, 0.008);
    #ifdef END_NEBULA
        float t = frameTimeCounter * 0.004;
        vec3 p = dir * 2.2 + vec3(t, 0.0, t * 0.6);
        float n1 = fbm3D(p * 2.0, 5);
        float n2 = fbm3D(p * 4.5 + 11.0, 4);
        float clouds = smoothstep(0.38, 0.78, n1);
        vec3 neb = mix(vec3(0.35, 0.10, 0.55), vec3(0.08, 0.25, 0.55), n2);
        neb = mix(neb, vec3(0.85, 0.35, 0.65), smoothstep(0.6, 0.8, n2) * 0.6);
        float dust = smoothstep(0.5, 0.75, fbm3D(p * 6.0 + 3.0, 3));
        col += neb * clouds * (1.0 - dust * 0.7) * 0.22;
    #endif
    // stars
    vec3 sp3 = dir * 220.0;
    vec3 cell = floor(sp3);
    vec3 h = hash33(cell);
    if (h.x > 0.965) {
        vec3 sp = cell + 0.5 + (hash33(cell + 5.0) - 0.5) * 0.6;
        float s = smoothstep(max(0.06, pixelAngle * 180.0), 0.0, length(sp3 - sp));
        col += mix(vec3(0.8, 0.6, 1.0), vec3(0.6, 0.9, 1.0), h.y) * s * pow(h.z, 4.0) * 4.0;
    }
    // the "eye" of the End: a pale star at the light direction
    float mu = dot(dir, lightDirWorld());
    col += vec3(0.9, 0.75, 1.0) * (pow(max(mu, 0.0), 1800.0) * 40.0 + pow(max(mu, 0.0), 40.0) * 0.08);
    return col;
}
