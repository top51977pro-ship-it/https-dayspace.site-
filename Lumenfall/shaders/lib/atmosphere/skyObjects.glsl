/*
    Lumenfall - celestial objects
    Sun disk, procedural moon with phases, star field, Milky Way, aurora,
    shooting stars and rainbows. Needs atmosphere.glsl + noise.glsl.
*/

// Rotates a world direction into the celestial frame (stars turn with the sun)
vec3 toCelestial(vec3 d) {
    float tilt = radians(sunPathRotation);
    float ct = cos(tilt), st = sin(tilt);
    d = vec3(d.x, d.y * ct + d.z * st, -d.y * st + d.z * ct);
    float a = sunAngle * TAU;
    float ca = cos(a), sa = sin(a);
    return vec3(d.x * ca + d.y * sa, -d.x * sa + d.y * ca, d.z);
}

vec3 sunDisk(vec3 dir, vec3 sunDir, vec3 transmittance) {
    float radius = 0.0105 * SUN_SIZE;
    float cosA = dot(dir, sunDir);
    float d = sqrt(max(2.0 - 2.0 * cosA, 0.0)) / radius; // ~ angular distance / radius
    if (d > 1.15) return vec3(0.0);
    float edge = 1.0 - smoothstep(0.92, 1.08, d);
    float mu = sqrt(max(1.0 - d * d, 0.0));
    vec3 limb = pow(vec3(mu), vec3(0.397, 0.503, 0.652)); // wavelength dependent limb darkening
    return SUN_ILLUMINANCE * SUN_INTENSITY * 900.0 * limb * edge * transmittance;
}

vec3 moonDisk(vec3 dir, vec3 moonDir, vec3 transmittance) {
    float radius = 0.024 * MOON_SIZE;
    vec3 t = normalize(cross(moonDir, vec3(0.0, 0.0, 1.0)));
    vec3 b = cross(t, moonDir);
    vec2 uv = vec2(dot(dir, t), dot(dir, b)) / radius;
    float r2 = dot(uv, uv);
    if (r2 > 1.1 || dot(dir, moonDir) < 0.0) return vec3(0.0);

    float edge = 1.0 - smoothstep(0.94, 1.04, sqrt(r2));
    vec3 n = vec3(uv, sqrt(max(1.0 - r2, 0.0)));

    // Surface: maria + craters
    vec2 suv = uv * 2.2 + 3.7;
    float maria = smoothstep(0.42, 0.62, fbm2D(suv * 9.0, 4));
    float craters = 0.0;
    for (int i = 0; i < 3; i++) {
        float w = worley2D(suv * (3.0 + float(i) * 4.0) + float(i) * 11.0);
        craters += (smoothstep(0.18, 0.28, w) - 1.0) * 0.18 + smoothstep(0.28, 0.33, w) * smoothstep(0.38, 0.33, w) * 0.15;
    }
    float albedo = (0.55 - maria * 0.28 + craters) * 1.2;

    float phase = float(moonPhase) * PI * 0.25; // 0 full -> PI new
    vec3 l = normalize(vec3(sin(phase), 0.0, cos(phase)));
    float lit = max(dot(n, l), 0.0);
    float earthshine = 0.015;
    float brightness = albedo * (lit + earthshine);
    return vec3(0.92, 0.95, 1.0) * brightness * edge * 2.4 * MOON_INTENSITY * transmittance;
}

vec3 starLayer(vec3 cdir, float scale, float threshold, float pixelAngle) {
    vec3 p = cdir * scale;
    vec3 cell = floor(p);
    vec3 h = hash33(cell);
    if (h.x < threshold) return vec3(0.0);
    vec3 starPos = cell + 0.5 + (hash33(cell + 17.0) - 0.5) * 0.6;
    float dist = length(p - starPos);
    float size = max(0.03, pixelAngle * scale * 0.55);
    float star = smoothstep(size, 0.0, dist);
    // magnitude distribution: a few bright stars, many faint ones
    float mag = pow((h.x - threshold) / (1.0 - threshold), 7.0) * 30.0 + 0.12;
    float twinkle = 0.75 + 0.25 * sin(frameTimeCounter * (2.0 + h.y * 4.0) + h.z * 60.0);
    vec3 col = mix(vec3(1.0, 0.72, 0.48), vec3(0.66, 0.8, 1.0), h.y);
    col = mix(col, vec3(1.0), 0.45);
    return col * star * mag * twinkle;
}

vec3 milkyWay(vec3 cdir) {
    vec3 n = normalize(vec3(0.35, 0.52, 0.78));
    vec3 core = normalize(vec3(0.82, -0.18, -0.55));
    float d = dot(cdir, n);
    float band = exp(-d * d * 22.0);
    if (band < 0.002) return vec3(0.0);
    float coreDist = 1.0 - dot(cdir, core);
    float coreGlow = exp(-coreDist * 3.0);

    float clouds = fbm3D(cdir * 7.0, 5);
    float fine   = fbm3D(cdir * 22.0 + 3.0, 3);
    float dust   = smoothstep(0.45, 0.70, fbm3D(cdir * 11.0 + 7.0, 4)) * exp(-d * d * 90.0);

    float intensity = band * (0.35 + clouds * 0.9 + fine * 0.35) * (0.6 + coreGlow * 2.2);
    intensity *= 1.0 - dust * 0.85;
    vec3 col = mix(vec3(0.55, 0.62, 0.95), vec3(1.0, 0.82, 0.62), coreGlow * 0.8 + clouds * 0.2);
    // pink HII regions
    col += vec3(0.9, 0.3, 0.45) * smoothstep(0.72, 0.85, fine) * band * 0.6;
    return col * intensity * 0.06 * MILKY_WAY_STRENGTH;
}

vec3 shootingStar(vec3 cdir) {
    float slot = floor(frameTimeCounter / 5.0);
    float tIn = fract(frameTimeCounter / 5.0);
    vec3 h = hash33(vec3(slot, 7.0, 13.0));
    if (h.x > 0.35 || tIn > 0.25) return vec3(0.0);
    float t = tIn / 0.25;
    vec3 center = normalize(vec3(h.y - 0.5, 0.6 + h.z * 0.4, h.x * 2.0 - 0.35));
    vec3 axis = normalize(cross(center, vec3(h.z - 0.5, 1.0, h.y - 0.5)));
    vec3 head = normalize(center + axis * (t - 0.5) * 0.6);
    vec3 tailDir = -axis;
    vec3 rel = cdir - head;
    float along = dot(rel, tailDir);
    float across = length(rel - tailDir * along);
    if (along < 0.0 || along > 0.12) return vec3(0.0);
    float streak = smoothstep(0.0012, 0.0, across) * (1.0 - along / 0.12);
    float fade = sin(t * PI);
    return vec3(0.85, 0.92, 1.0) * streak * fade * 6.0;
}

vec3 auroraColor(float h) {
    vec3 green = vec3(0.10, 1.00, 0.45);
    vec3 teal  = vec3(0.05, 0.75, 0.85);
    vec3 pink  = vec3(0.85, 0.15, 0.75);
    return mix(mix(green, teal, smoothstep(0.0, 0.5, h)), pink, smoothstep(0.45, 1.0, h));
}

vec3 aurora(vec3 dir, float dither) {
    if (dir.y < 0.02) return vec3(0.0);
    vec3 acc = vec3(0.0);
    const int steps = 28;
    float t = frameTimeCounter * 0.02;
    for (int i = 0; i < steps; i++) {
        float fi = (float(i) + dither) / float(steps);
        float hgt = 1.0 + fi * 1.4;
        vec2 p = dir.xz / dir.y * hgt * 0.55;
        // curtains: thin ridges of a warped noise field
        vec2 warp = vec2(fbm2D(p * 3.0 + t, 3), fbm2D(p * 3.0 - t + 5.0, 3));
        float n = fbm2D(p * vec2(1.4, 6.0) + warp * 1.6 + vec2(t * 2.0, 0.0), 4);
        float ridge = pow(1.0 - abs(n - 0.5) * 2.0, 14.0);
        float base = smoothstep(0.0, 0.08, fi) * (1.0 - fi);
        acc += auroraColor(fi) * ridge * base;
    }
    float horizonFade = smoothstep(0.02, 0.25, dir.y);
    return acc / float(steps) * horizonFade * 2.6;
}

vec3 spectrum(float x) {
    // x: 0 = violet ... 1 = red
    vec3 c = vec3(smoothstep(0.45, 0.85, x) + smoothstep(0.15, 0.0, x) * 0.4,
                  smoothstep(0.2, 0.5, x) * smoothstep(0.95, 0.6, x),
                  smoothstep(0.55, 0.15, x));
    return c;
}

vec3 rainbow(vec3 dir, vec3 sunDir, float amount) {
    if (amount < 0.001 || dir.y < -0.02) return vec3(0.0);
    float ang = acos(clamp(dot(dir, -sunDir), -1.0, 1.0));
    float primary = (ang - radians(40.4)) / radians(2.0);
    float secondary = (radians(53.4) - ang) / radians(3.2);
    vec3 col = vec3(0.0);
    if (primary > 0.0 && primary < 1.0) col += spectrum(primary) * sin(primary * PI);
    if (secondary > 0.0 && secondary < 1.0) col += spectrum(secondary) * sin(secondary * PI) * 0.35;
    return col * amount * smoothstep(-0.02, 0.15, dir.y);
}

// Night sky emission (stars, milky way, aurora, meteors) for a world direction
vec3 nightSkyEmission(vec3 dir, float pixelAngle, float dither, vec3 transmittance) {
    vec3 col = vec3(0.0);
    float night = 1.0 - smoothstep(-0.12, 0.05, sunDirWorld().y);
    if (night < 0.001) return col;
    vec3 cdir = toCelestial(dir);
    #ifdef STARS
        float thr = 1.0 - 0.022 * STAR_AMOUNT;
        float horizon = smoothstep(0.0, 0.18, dir.y);
        col += starLayer(cdir, 160.0, thr, pixelAngle) * horizon;
        col += starLayer(cdir, 340.0, 1.0 - 0.012 * STAR_AMOUNT, pixelAngle) * 0.4 * horizon;
    #endif
    #ifdef MILKY_WAY
        col += milkyWay(cdir);
    #endif
    #ifdef SHOOTING_STARS
        col += shootingStar(dir);
    #endif
    col *= transmittance * (1.0 - lf_rain * 0.95);
    #if AURORA > 0
        float auroraAmount = 1.0;
        #if AURORA == 1
            auroraAmount = lf_snowyBiome;
        #endif
        if (auroraAmount > 0.001) col += aurora(dir, dither) * auroraAmount * (1.0 - lf_rain);
    #endif
    return col * night * 0.08;
}
