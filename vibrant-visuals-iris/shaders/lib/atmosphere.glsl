// =====================================================================
//  Atmosphere - a port of Bedrock Vibrant Visuals' default
//  atmospherics.json / lighting/global.json keyframes.
//
//  Vibrant Visuals time of day: 0.0 = noon, 0.25 = sunset,
//  0.5 = midnight, 0.75 = sunrise. Iris' sunAngle: 0.25 = noon.
// =====================================================================

float vvTime() { return fract(sunAngle - 0.25); }

// Generic piecewise-linear keyframe lookup. Keys must be sorted and
// cover 0..1 (first key 0.0, last key 1.0).
// (single line: GLSL 330 has no macro line continuation)
#define KEYFRAME_LOOKUP(N, KEYS, VALS, T, RESULT) RESULT = VALS[N - 1]; for (int i = 0; i < N - 1; i++) { if (T <= KEYS[i + 1]) { RESULT = mix(VALS[i], VALS[i + 1], saturate((T - KEYS[i]) / max(KEYS[i + 1] - KEYS[i], 1e-5))); break; } }

// lighting/global.json -> directional_lights.orbital.sun.color
vec3 vvSunColor(float t) {
    const int N = 11;
    const float k[N] = float[N](0.0, 0.140811, 0.216944, 0.242908, 0.269504, 0.314561, 0.506998, 0.717949, 0.801062, 0.95, 1.0);
    const vec3 v[N] = vec3[N](
        vec3(255, 227, 215), vec3(255, 173, 81), vec3(255, 155, 82), vec3(255, 127, 0),
        vec3(255, 127, 0), vec3(255, 154, 154), vec3(255, 105, 0), vec3(255, 133, 133),
        vec3(255, 173, 81), vec3(255, 220, 200), vec3(255, 227, 215));
    vec3 r; KEYFRAME_LOOKUP(N, k, v, t, r)
    return toLinear(r / 255.0);
}

// lighting/global.json -> sun.illuminance (lux, 0..100)
float vvSunIlluminance(float t) {
    const int N = 9;
    const float k[N] = float[N](0.0, 0.05, 0.282, 0.2915, 0.292, 0.709, 0.719, 0.95, 1.0);
    const float v[N] = float[N](100.0, 100.0, 1.0, 0.01, 0.0, 0.0, 1.0, 100.0, 100.0);
    float r; KEYFRAME_LOOKUP(N, k, v, t, r)
    return r;
}

// lighting/global.json -> moon.illuminance
float vvMoonIlluminance(float t) {
    const int N = 6;
    const float k[N] = float[N](0.0, 0.2, 0.225, 0.735, 0.75, 1.0);
    const float v[N] = float[N](0.0, 0.0, 0.4, 0.4, 0.0, 0.0);
    float r; KEYFRAME_LOOKUP(N, k, v, t, r)
    return r;
}

// atmospherics.json -> sky_zenith_color
vec3 vvZenith(float t) {
    const int N = 6;
    const float k[N] = float[N](0.0, 0.199685, 0.35256, 0.64488, 0.800315, 1.0);
    const vec3 v[N] = vec3[N](vec3(103, 130, 170), vec3(103, 130, 170), vec3(40, 40, 40),
                              vec3(40, 40, 40), vec3(103, 130, 170), vec3(103, 130, 170));
    vec3 r; KEYFRAME_LOOKUP(N, k, v, t, r)
    return toLinear(r / 255.0);
}

// atmospherics.json -> sky_horizon_color
vec3 vvHorizon(float t) {
    const int N = 14;
    const float k[N] = float[N](0.0, 0.167053, 0.217114, 0.239274, 0.276382, 0.361464, 0.401799,
                                0.616996, 0.654508, 0.706861, 0.748744, 0.786432, 0.830049, 1.0);
    const vec3 v[N] = vec3[N](
        vec3(183, 189, 198), vec3(183, 189, 198), vec3(243, 184, 149), vec3(255, 187, 163),
        vec3(136, 108, 108), vec3(168, 168, 238), vec3(83, 117, 157), vec3(83, 117, 157),
        vec3(144, 144, 238), vec3(223, 187, 237), vec3(255, 211, 179), vec3(226, 213, 191),
        vec3(183, 189, 198), vec3(183, 189, 198));
    vec3 r; KEYFRAME_LOOKUP(N, k, v, t, r)
    return toLinear(r / 255.0);
}

// atmospherics.json -> rayleigh_strength (5..10)
float vvRayleigh(float t) {
    const int N = 8;
    const float k[N] = float[N](0.0, 0.138743, 0.25, 0.330402, 0.640704, 0.717412, 0.92931, 1.0);
    const float v[N] = float[N](10.0, 10.0, 5.0, 5.0, 5.0, 5.0, 10.0, 10.0);
    float r; KEYFRAME_LOOKUP(N, k, v, t, r)
    return r;
}

// atmospherics.json -> sun_mie_strength
float vvSunMie(float t) {
    const int N = 8;
    const float k[N] = float[N](0.0, 0.2, 0.25, 0.4, 0.6, 0.75, 0.8, 1.0);
    const float v[N] = float[N](0.0, 0.0, 0.75, 0.0, 0.0, 0.75, 0.0, 0.0);
    float r; KEYFRAME_LOOKUP(N, k, v, t, r)
    return r;
}

// atmospherics.json -> sun_glare_shape
float vvSunGlare(float t) {
    const int N = 8;
    const float k[N] = float[N](0.0, 0.2, 0.25, 0.4, 0.6, 0.75, 0.8, 1.0);
    const float v[N] = float[N](0.0, 0.0, 0.0737705, 0.0, 0.0, 0.05, 0.0, 0.0);
    float r; KEYFRAME_LOOKUP(N, k, v, t, r)
    return r;
}

// atmospherics.json -> horizon_blend_stops.start
float vvBlendStart(float t) {
    const int N = 6;
    const float k[N] = float[N](0.0, 0.25, 0.300912, 0.75, 0.827004, 1.0);
    const float v[N] = float[N](0.8, 0.5, 0.25, 0.25, 0.5, 0.8);
    float r; KEYFRAME_LOOKUP(N, k, v, t, r)
    return r;
}

// atmospherics.json -> horizon_blend_stops.mie_start
float vvMieStart(float t) {
    const int N = 6;
    const float k[N] = float[N](0.0, 0.1, 0.2, 0.8, 0.9, 1.0);
    const float v[N] = float[N](0.5, 0.5, 1.0, 1.0, 0.5, 0.5);
    float r; KEYFRAME_LOOKUP(N, k, v, t, r)
    return r;
}

// ---------------------------------------------------------------------
//  Per-frame atmosphere state. Computed in vertex shaders and passed
//  to fragments as flat varyings so the keyframe loops run rarely.
// ---------------------------------------------------------------------
struct Atmosphere {
    vec3  light;      // color * intensity of the shadow-casting body
    vec3  ambient;    // sky light reaching surfaces with full skylight
    vec3  zenith;
    vec3  horizon;
    vec3  glow;       // color of the mie glow around the sun / moon
    vec4  params;     // x: mie strength, y: glare shape, z: blend start, w: mie start
};

vec3 sunDirWorld()  { return normalize(mat3(gbufferModelViewInverse) * sunPosition); }
vec3 moonDirWorld() { return normalize(mat3(gbufferModelViewInverse) * moonPosition); }

Atmosphere computeAtmosphere() {
    Atmosphere a;
    float t = vvTime();
    float sunElev  = dot(normalize(sunPosition),  normalize(upPosition));
    float moonElev = -sunElev;

    // --- Direct light: sun by day, moon by night. Faded at the horizon so
    // the switch Iris makes at sunAngle 0.5 is invisible.
    vec3  sunCol  = vvSunColor(t);
    float sunLux  = vvSunIlluminance(t) / 100.0;
    float sunFade = smoothstep(0.0, 0.12, sunElev);
    vec3  sunLight = sunCol * sqrt(sunLux) * sunFade * 1.9 * SUN_BRIGHTNESS;

    vec3  moonCol  = toLinear(vec3(163.0, 182.0, 255.0) / 255.0);
    float moonFade = smoothstep(0.0, 0.12, moonElev);
    vec3  moonLight = moonCol * vvMoonIlluminance(t) * moonFade * 0.3 * NIGHT_BRIGHTNESS;

    a.light = sunAngle < 0.5 ? sunLight : moonLight;

    // --- Sky colors. Rayleigh strength pushes the zenith to a deeper blue.
    float rayleigh = vvRayleigh(t) / 10.0;
    vec3 zen = vvZenith(t);
    vec3 hor = vvHorizon(t);
    vec3 rayleighTint = mix(vec3(1.0), vec3(0.42, 0.78, 1.45), rayleigh);
    zen = zen * rayleighTint;
    hor = mix(hor, hor * vec3(0.92, 0.98, 1.08), rayleigh);

    // Overall sky brightness: bright by day, deep blue at night
    float dayAmount = smoothstep(-0.22, 0.08, sunElev);
    float skyBright = mix(0.12 * NIGHT_BRIGHTNESS, 1.1, dayAmount);
    vec3 nightTint = vec3(0.55, 0.75, 1.3);
    zen *= skyBright * mix(nightTint, vec3(1.0), dayAmount);
    hor *= skyBright * mix(nightTint, vec3(1.0), dayAmount);

    // Rain: grey, flat sky and much weaker sun
    float rain = rainStrength;
    vec3 rainSky = vec3(luminance(mix(zen, hor, 0.5))) * vec3(0.95, 0.98, 1.05) * 0.7;
    zen = mix(zen, rainSky, rain * 0.85);
    hor = mix(hor, rainSky * 1.1, rain * 0.85);
    a.light *= 1.0 - rain * 0.88;

    a.zenith  = zen;
    a.horizon = hor;

    // Ambient sky light: mostly the zenith, a bit of horizon
    vec3 skyAvg = mix(zen, hor, 0.35);
    a.ambient = mix(skyAvg, vec3(luminance(skyAvg)), 0.6) * 0.5 * AMBIENT_BRIGHTNESS;

    // Mie glow. Vibrant Visuals only has a sunrise / sunset mie term; we keep a
    // small midday halo so the sun reads as bright like in the reference shots.
    float mie = vvSunMie(t) + 0.12 * dayAmount;
    a.glow = sunAngle < 0.5 ? sunCol * smoothstep(-0.15, 0.05, sunElev)
                            : moonCol * 0.04 * smoothstep(-0.15, 0.05, moonElev);
    a.glow *= 1.0 - rain * 0.9;
    a.params = vec4(mie * SUN_GLOW, vvSunGlare(t), vvBlendStart(t), vvMieStart(t));
    return a;
}

// ---------------------------------------------------------------------
//  Sky color for a world-space direction.
//  Mirrors the three bands of the Vibrant Visuals sky:
//   (1) the horizon line, (2) where the horizon colour blends into the
//   zenith colour, (3) a raised band of mie glow around the sun.
// ---------------------------------------------------------------------
vec3 getSky(vec3 dir, vec3 lightDir, vec3 zenith, vec3 horizon, vec3 glow, vec4 p) {
    float h  = dir.y;
    float hp = max(h, 0.0);
    float cosT = dot(dir, lightDir);

    // How close we are to the sun in azimuth: raises the horizon band (3)
    vec2 dxz = dir.xz / max(length(dir.xz), 1e-4);
    vec2 sxz = lightDir.xz / max(length(lightDir.xz), 1e-4);
    float towardSun = pow(saturate(dot(dxz, sxz) * 0.5 + 0.5), 3.0);
    float sunLow = 1.0 - saturate(abs(lightDir.y) * 2.0);

    float start = p.z * (1.0 + towardSun * sunLow * p.x * 1.4);
    float g = pow(saturate(hp / max(start, 0.05)), 0.55);

    // Toward a low sun the horizon takes on the sun's colour (orange sunsets)
    vec3 glowTint = glow / max(luminance(glow), 1e-3);
    glowTint = pow(glowTint, vec3(1.3)) / max(luminance(pow(glowTint, vec3(1.3))), 1e-3);
    vec3 hor = mix(horizon, horizon * glowTint * 1.15, saturate(towardSun * sunLow * p.x * 1.6));
    vec3 col = mix(hor, zenith, g);

    // Mie scattering glow, confined below mie_start
    float mieMask = 1.0 - smoothstep(0.0, p.w, hp) * 0.75;
    vec3 mieCol = glowTint * luminance(glow);
    vec3 mie = mieCol * (phaseHG(cosT, 0.75) * 1.1 + phaseHG(cosT, 0.45) * 1.2) * p.x * mieMask;
    col += mie * 0.6;

    // Small always-on halo
    col += glow * phaseHG(cosT, 0.93) * 0.012 * SUN_GLOW;

    // Sun glare: a wide soft bloom whose size follows sun_glare_shape
    float ang = acos(clamp(cosT, -1.0, 1.0));
    col += glow * exp(-ang / max(p.y * 3.0, 1e-3)) * step(1e-4, p.y) * 0.9 * SUN_GLOW;

    // Below the horizon fade to a slightly darker horizon colour
    col = mix(col, horizon * 0.75 + mie * 0.3, smoothstep(0.0, -0.25, h));
    return max(col, 0.0);
}
