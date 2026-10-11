// Procedural sky: gradient, sun, stars, aurora, End nebula.
// Requires atmosphere.glsl (setupAtmosphere() must have been called).

// Follows the biome fog colour (crimson red, warped teal-purple, soul valley blue, basalt grey).
vec3 getNetherFogColor() {
    vec3 hue = fogColor / (maxOf(fogColor) + 1e-4);
    float sat = maxOf(fogColor) - min(fogColor.r, min(fogColor.g, fogColor.b));
    vec3 biome = mix(vec3(luminance(hue)), hue, 0.85);
    return mix(vec3(0.85, 0.30, 0.13), biome, 0.70) * mix(0.24, 0.30, saturate(sat * 4.0));
}

vec3 getEndSky(vec3 dir) {
    float up = dir.y;
    float horizon = exp(-abs(up) * 4.0);
    vec3 sky = mix(vec3(0.008, 0.005, 0.018), vec3(0.070, 0.035, 0.115), horizon);
    sky = mix(sky, vec3(0.005, 0.003, 0.010), smoothstep(0.0, -0.6, up)); // the void below
    #ifdef END_NEBULA
    float t = frameTimeCounter * 0.01;
    vec3 q = dir * 2.5 + t;
    q += (vec3(noise3D(q * 1.7), noise3D(q * 1.7 + 19.0), noise3D(q * 1.7 + 41.0)) - 0.5) * 1.6;
    const mat3 rot = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
    float n = 0.0, amp = 0.5;
    for (int i = 0; i < 4; i++) { n += noise3D(q) * amp; q = rot * q * 2.3; amp *= 0.5; }
    n /= 0.9375;
    float neb = smoothstep(0.36, 0.82, n);
    float dust = smoothstep(0.50, 0.72, noise3D(dir * 7.0 + 3.0) * 0.6 + noise3D(dir * 16.0) * 0.4);
    vec3 nebCol = mix(vec3(0.55, 0.15, 0.95), vec3(0.95, 0.35, 0.75), noise3D(dir * 1.3 + 11.0));
    nebCol = mix(nebCol, vec3(0.15, 0.60, 0.85), smoothstep(0.62, 0.82, noise3D(dir * 2.0 + 30.0)));
    sky += nebCol * neb * neb * 0.24 * (1.0 - dust * 0.75) * smoothstep(-0.5, 0.1, up);
    #endif
    // distant bright star in the direction of the End's light
    float VdotL = saturate(dot(dir, lightDir));
    sky += vec3(0.85, 0.65, 1.00) * (pow(VdotL, 2500.0) * 8.0 + pow(VdotL, 150.0) * 0.45 + pow(VdotL, 12.0) * 0.07);
    return sky;
}

// Sky colour without sun disc / stars. Used for fog, reflections and the base sky.
vec3 getSkyColor(vec3 dir) {
    #if defined NETHER
    return getNetherFogColor();
    #elif defined END
    return getEndSky(dir);
    #else
    float up = dir.y;
    float upc = max(up, 0.0);
    float VdotS = dot(dir, sunDir);
    float towardSun = VdotS * 0.5 + 0.5;

    vec3 dayZenith    = vec3(0.13, 0.30, 0.85);
    vec3 dayHorizon   = vec3(0.55, 0.74, 1.00);
    vec3 setZenith    = vec3(0.09, 0.12, 0.33);
    vec3 setHorizon   = mix(vec3(0.30, 0.22, 0.42), vec3(1.10, 0.46, 0.16), towardSun * towardSun);
    vec3 nightZenith  = vec3(0.004, 0.007, 0.019);
    vec3 nightHorizon = vec3(0.014, 0.022, 0.046);

    vec3 zenith  = mix(nightZenith,  mix(setZenith,  dayZenith,  noonF), dayF);
    vec3 horizon = mix(nightHorizon, mix(setHorizon, dayHorizon, noonF), dayF);

    vec3 sky = mix(zenith, horizon, pow(1.0 - upc, 3.0));
    sky += horizon * exp(-abs(up) * 16.0) * 0.20;

    // mie-like glow around the sun, stronger at sunrise/sunset
    float glowAmount = mix(0.65, 0.18, noonF) * dayF;
    float VdotSc = saturate(VdotS);
    sky += sunColor * (pow(VdotSc, 5.0) * 0.10 + pow(VdotSc, 40.0) * 0.30) * glowAmount;

    // soft glow around the moon
    sky += moonColor * pow(saturate(-VdotS), 24.0) * 0.6 * (1.0 - dayF);

    // below the horizon
    sky = mix(sky, horizon * vec3(0.30, 0.33, 0.38), smoothstep(0.0, -0.4, up));

    vec3 rainSky = vec3(luminance(sky)) * vec3(0.90, 0.95, 1.00) * 0.75;
    sky = mix(sky, rainSky, rainStrength * 0.85);
    return sky;
    #endif
}

vec3 getStars(vec3 dir) {
    float a = sunAngle * TAU;
    float ca = cos(a), sa = sin(a);
    vec3 d = vec3(dir.x * ca - dir.y * sa, dir.x * sa + dir.y * ca, dir.z);

    vec3 p = d * 230.0;
    vec3 cell = floor(p);
    float h = hash13(cell);
    if (h < 0.9965) return vec3(0.0);

    vec3 offset = vec3(hash13(cell + 17.3), hash13(cell + 41.7), hash13(cell + 73.1)) * 0.5 + 0.25;
    float dist = length(fract(p) - offset);
    float bright = (h - 0.9965) / 0.0035;
    float star = smoothstep(0.32, 0.0, dist) * (0.3 + bright * bright * 1.7);
    star *= 0.65 + 0.35 * sin(frameTimeCounter * (2.0 + h * 5.0) + h * 300.0);

    vec3 tint = mix(vec3(0.65, 0.78, 1.00), vec3(1.00, 0.86, 0.70), hash13(cell + 5.0));
    return tint * star * 0.9 * STAR_BRIGHTNESS;
}

vec3 getAurora(vec3 dir, float dither) {
    if (dir.y < 0.01) return vec3(0.0);
    float visibility = nightF * (1.0 - rainStrength) * AURORA_STRENGTH;
    if (visibility < 0.005) return vec3(0.0);

    float t = frameTimeCounter * 0.025;
    vec3 col = vec3(0.0);
    const int layers = 12;
    for (int i = 0; i < layers; i++) {
        float fi = (float(i) + dither) / float(layers);
        vec2 p = dir.xz / (dir.y + 0.08) * (1.0 + fi * 0.55) * 18.0;
        vec2 q = p + vec2(t * 8.0, t * 3.0);
        float warp = noise2D(q * 0.06) * 18.0;
        float ridge = 1.0 - abs(noise2D(vec2(q.x * 0.09 + warp, q.y * 0.025)) * 2.0 - 1.0);
        ridge = pow(ridge, 9.0);
        float patches = smoothstep(0.38, 0.72, noise2D(p * 0.02 + t));
        vec3 layerCol = mix(vec3(0.08, 1.00, 0.50), vec3(0.55, 0.18, 1.00), fi * fi);
        col += layerCol * ridge * patches * (1.0 - fi);
    }
    float horizonFade = smoothstep(0.01, 0.25, dir.y);
    return col * (0.22 / float(layers)) * 4.0 * visibility * horizonFade;
}

// Full sky for directly visible sky pixels.
vec3 getSky(vec3 dir, float dither) {
    vec3 sky = getSkyColor(dir);
    #ifdef OVERWORLD
    float clearSky = 1.0 - rainStrength;
    float VdotS = dot(dir, sunDir);
    float sunRadius = radians(2.6 * SUN_SIZE);
    float disc = smoothstep(cos(sunRadius), cos(sunRadius * 0.82), VdotS);
    float corona = pow(saturate((VdotS - cos(sunRadius * 3.0)) / (1.0 - cos(sunRadius * 3.0))), 6.0);
    sky += sunColor * (disc * 20.0 + corona * 1.5) * clearSky * smoothstep(-0.02, 0.02, dir.y);

    float starVis = nightF * clearSky * smoothstep(0.0, 0.2, dir.y);
    #ifdef STARS
    if (starVis > 0.0) sky += getStars(dir) * starVis;
    #endif
    #ifdef AURORA
    sky += getAurora(dir, dither);
    #endif
    #endif
    #ifdef END
    #ifdef STARS
    sky += getStars(dir) * 2.5;
    #endif
    #endif
    return sky;
}
