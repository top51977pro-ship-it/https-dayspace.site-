// Time-of-day / dimension dependent light colours.
// Call setupAtmosphere() once at the top of main() before using any of these globals.

vec3  sunDir;       // world space direction towards the sun
vec3  lightDir;     // world space direction towards the shadow casting light (sun or moon)
float sunH;         // sun height, -1..1
float dayF;         // 0 at night, 1 during the day (soft transition around the horizon)
float noonF;        // 0 near sunrise/sunset, 1 when the sun is high
float nightF;       // 1 during deep night
float eyeSky;       // how much sky the player currently sees (eye brightness), 0..1
vec3  sunColor;
vec3  moonColor;
vec3  lightColor;   // colour/intensity of the shadow casting light
vec3  ambientColor; // sky ambient colour/intensity

vec3 getBlockLightColor() {
    #if BLOCKLIGHT_STYLE == 0
    return vec3(1.00, 0.56, 0.25);
    #elif BLOCKLIGHT_STYLE == 1
    return vec3(1.00, 0.72, 0.42);
    #else
    return vec3(1.00, 0.86, 0.72);
    #endif
}

void setupAtmosphere() {
    eyeSky = float(eyeBrightnessSmooth.y) / 240.0;

    #if defined NETHER
        sunDir = vec3(0.0, 1.0, 0.0);
        lightDir = sunDir;
        sunH = 1.0; dayF = 0.0; noonF = 0.0; nightF = 0.0;
        sunColor = vec3(0.0); moonColor = vec3(0.0);
        lightColor = vec3(0.0);
        vec3 hue = fogColor / (maxOf(fogColor) + 1e-4);
        ambientColor = mix(vec3(1.0, 0.55, 0.38), hue, 0.45) * 0.30 * AMBIENT_STRENGTH;
    #elif defined END
        sunDir = normalize(mat3(gbufferModelViewInverse) * shadowLightPosition);
        lightDir = sunDir;
        sunH = sunDir.y; dayF = 0.0; noonF = 0.0; nightF = 1.0;
        sunColor = vec3(0.0); moonColor = vec3(0.0);
        lightColor = vec3(0.72, 0.56, 1.00) * 1.15 * SUN_INTENSITY;
        ambientColor = vec3(0.34, 0.26, 0.50) * 0.32 * AMBIENT_STRENGTH;
    #else
        sunDir = normalize(mat3(gbufferModelViewInverse) * sunPosition);
        lightDir = normalize(mat3(gbufferModelViewInverse) * shadowLightPosition);
        sunH = sunDir.y;
        dayF = smoothstep(-0.10, 0.05, sunH);
        noonF = smoothstep(0.02, 0.45, sunH);
        nightF = 1.0 - smoothstep(-0.25, -0.02, sunH);

        sunColor = mix(vec3(1.00, 0.42, 0.15), vec3(1.00, 0.90, 0.78), noonF) * 3.0 * SUN_INTENSITY;
        float moonBright = mix(1.0, 0.45, 1.0 - abs(float(moonPhase) - 4.0) / 4.0);
        moonColor = vec3(0.55, 0.70, 1.00) * 0.24 * moonBright;

        float lightFade = smoothstep(0.0, 0.10, abs(sunH));
        lightColor = (sunH > 0.0 ? sunColor : moonColor) * lightFade;

        vec3 dayAmb   = vec3(0.40, 0.58, 1.00) * 0.46;
        vec3 setAmb   = vec3(0.70, 0.52, 0.58) * 0.32;
        vec3 nightAmb = vec3(0.30, 0.42, 0.85) * 0.075;
        ambientColor = mix(nightAmb, mix(setAmb, dayAmb, noonF), dayF) * AMBIENT_STRENGTH;

        lightColor *= 1.0 - rainStrength * 0.88;
        vec3 rainAmb = vec3(luminance(ambientColor)) * vec3(0.92, 0.97, 1.06) * 0.8;
        ambientColor = mix(ambientColor, rainAmb, rainStrength * 0.75);
    #endif
}
