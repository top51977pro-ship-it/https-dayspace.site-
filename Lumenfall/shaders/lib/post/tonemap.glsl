/*
    Lumenfall - tone mapping & colour grading
    0: Lumenfall Cinematic (hue-preserving filmic with soft highlight desaturation)
    1: ACES (Hill fit of RRT + ODT)
    2: AgX (punchy look)
    3: Reinhard-Jodie
*/

vec3 tonemapLumenfall(vec3 x) {
    // filmic curve with a gentle toe (shadows keep their detail) and a long shoulder,
    // applied to a max-RGB norm so hues stay stable; very bright light burns to white
    const float a = 2.51, b = 0.35, c = 2.43, d = 0.80, e = 0.55;
    vec3 perChannel = saturate((x * (a * x + b)) / (x * (c * x + d) + e) / 1.033);
    float n = maxOf(x);
    float nm = (n * (a * n + b)) / (n * (c * n + d) + e) / 1.033;
    vec3 huePreserving = x * (saturate(nm) / max(n, 1e-6));
    float blend = smoothstep(0.25, 2.5, n);
    return mix(huePreserving, perChannel, blend * 0.65);
}

vec3 tonemapACES(vec3 c) {
    const mat3 inM = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
    const mat3 outM = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
    c = inM * c;
    vec3 a = c * (c + 0.0245786) - 0.000090537;
    vec3 b = c * (0.983729 * c + 0.4329510) + 0.238081;
    return saturate(outM * (a / b));
}

vec3 agxContrast(vec3 x) {
    vec3 x2 = x * x, x4 = x2 * x2;
    return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}

vec3 tonemapAgX(vec3 c) {
    const mat3 agxIn = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051,
                            0.0784335999999992, 0.878468636469772, 0.0784336,
                            0.0792237451477643, 0.0791661274605434, 0.879142973793104);
    const mat3 agxOut = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438,
                             -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
                             -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
    const float minEv = -12.47393, maxEv = 4.026069;
    c = agxIn * max(c, vec3(1e-10));
    c = clamp(log2(c), minEv, maxEv);
    c = (c - minEv) / (maxEv - minEv);
    c = agxContrast(c);
    // punchy look
    float l = luminance(c);
    c = pow(max(c, 0.0), vec3(1.35));
    c = l + 1.4 * (c - l);
    c = agxOut * c;
    return saturate(srgbToLinear(saturate(c)));
}

vec3 tonemapReinhardJodie(vec3 c) {
    float l = luminance(c);
    vec3 tc = c / (1.0 + c);
    return saturate(mix(c / (1.0 + l), tc, tc));
}

vec3 applyTonemap(vec3 c) {
    #if TONEMAP == 1
        return tonemapACES(c);
    #elif TONEMAP == 2
        return tonemapAgX(c);
    #elif TONEMAP == 3
        return tonemapReinhardJodie(c);
    #else
        return tonemapLumenfall(c);
    #endif
}

// Scotopic vision: in very low light colours fade and shift towards blue
vec3 purkinje(vec3 c) {
    #ifndef PURKINJE
        return c;
    #else
        float rod = dot(c, vec3(0.0, 0.42, 0.58));
        float cone = luminance(c);
        float night = saturate(1.0 - cone * 40.0);
        night *= night;
        return mix(c, rod * vec3(0.58, 0.72, 1.05), night * 0.75);
    #endif
}

vec3 colorGrade(vec3 c) {
    // white balance relative to D65
    vec3 wb = blackbody(6500.0) / blackbody(float(WHITE_BALANCE));
    c *= wb / luminance(wb);

    // contrast around middle grey in log space
    const float mid = 0.18;
    vec3 lc = log2(max(c, 1e-6) / mid);
    c = mid * exp2(lc * CONTRAST);

    // split toning: cool shadows, warm highlights (very subtle at default)
    float l = luminance(c);
    vec3 shadowTint = vec3(0.92, 1.0, 1.08);
    vec3 highTint = vec3(1.06, 1.0, 0.92);
    float hl = smoothstep(0.05, 0.6, l);
    c *= mix(vec3(1.0), mix(shadowTint, highTint, hl), SPLIT_TONING * 0.5);

    // vibrance boosts low-saturation colours more than saturated ones
    l = luminance(c);
    float sat = (maxOf(c) - minOf(c)) / max(maxOf(c), 1e-5);
    float vib = (VIBRANCE - 1.0) * (1.0 - sat);
    c = l + (c - l) * (SATURATION + vib);
    return max(c, vec3(0.0));
}
