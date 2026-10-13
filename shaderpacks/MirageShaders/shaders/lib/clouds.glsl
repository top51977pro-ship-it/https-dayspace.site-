// Raymarched volumetric cumulus layer.

#if CLOUD_QUALITY == 1
const int cloudSteps = 14;
const int cloudLightSteps = 2;
#elif CLOUD_QUALITY == 2
const int cloudSteps = 22;
const int cloudLightSteps = 3;
#else
const int cloudSteps = 34;
const int cloudLightSteps = 4;
#endif

const float cloudBottom = float(CLOUD_ALTITUDE);
const float cloudTop = float(CLOUD_ALTITUDE + CLOUD_THICKNESS);

vec3 cloudWind() {
    return vec3(frameTimeCounter * 2.2, 0.0, frameTimeCounter * 0.9) * CLOUD_SPEED;
}

// world position -> density 0..1
float cloudDensity(vec3 p) {
    float h = saturate((p.y - cloudBottom) / (cloudTop - cloudBottom));
    p += cloudWind();
    vec3 q = p * 0.0055;

    // large scale weather map: makes clear and cloudy regions
    float weather = noise2D(p.xz * 0.0011 + 13.0);
    float coverage = (0.42 + weather * 0.28) * CLOUD_COVERAGE + rainStrength * 0.25;

    float n = noise3D(q) * 0.56;
    n += noise3D(q * 2.63 + 3.1) * 0.27;
    n += noise3D(q * 6.91 - 7.7) * 0.12;
    n += noise3D(q * 15.3) * 0.05;

    // rounded tops, flatter bottoms
    float shape = smoothstep(0.0, 0.14, h) * smoothstep(1.0, 0.38, h);
    float d = n * shape - (1.0 - coverage) - h * 0.10;
    return saturate(d * 5.0);
}

// 2D-ish cheap lookup used for cloud shadows on terrain.
float cloudShadowAt(vec3 worldPos, vec3 toLight) {
    float midY = (cloudBottom + cloudTop) * 0.5;
    if (toLight.y < 0.05) return 1.0;
    vec3 p = worldPos + toLight * ((midY - worldPos.y) / toLight.y);
    float d = cloudDensity(p) + cloudDensity(p + vec3(0.0, 18.0, 0.0));
    return 1.0 - saturate(d * 1.2) * 0.75;
}

// Returns scattered light in .rgb and transmittance in .a
vec4 getClouds(vec3 dir, float maxDist, float dither) {
    vec3 camPos = cameraPosition;
    float camY = camPos.y;

    float t0, t1;
    if (camY < cloudBottom) {
        if (dir.y <= 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
        t0 = (cloudBottom - camY) / dir.y;
        t1 = (cloudTop - camY) / dir.y;
    } else if (camY > cloudTop) {
        if (dir.y >= 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
        t0 = (cloudTop - camY) / dir.y;
        t1 = (cloudBottom - camY) / dir.y;
    } else {
        t0 = 0.0;
        t1 = dir.y > 0.0 ? (cloudTop - camY) / dir.y : (cloudBottom - camY) / min(dir.y, -1e-4);
        t1 = min(t1, 600.0);
    }

    const float maxRange = 5200.0;
    t1 = min(t1, min(maxDist, maxRange));
    if (t1 <= t0) return vec4(0.0, 0.0, 0.0, 1.0);

    float stepLen = (t1 - t0) / float(cloudSteps);
    float VdotL = dot(dir, lightDir);
    float phase = mix(phaseHG(VdotL, 0.65), phaseHG(VdotL, -0.2), 0.45) * 0.55 + 0.25;

    vec3 skyAmbient = getSkyColor(vec3(0.0, 1.0, 0.0)) * 0.55 + ambientColor * 0.35;
    vec3 scatter = vec3(0.0);
    float transmittance = 1.0;
    float sigma = 0.075;

    for (int i = 0; i < cloudSteps; i++) {
        float t = t0 + (float(i) + dither) * stepLen;
        vec3 p = camPos + dir * t;
        float d = cloudDensity(p);
        if (d < 0.005) continue;

        float lightOD = 0.0;
        for (int j = 0; j < cloudLightSteps; j++) {
            float lt = sq(float(j) + 0.6) * 9.0;
            lightOD += cloudDensity(p + lightDir * lt) * (lt * 0.55 + 4.0);
        }
        float beer = exp(-lightOD * sigma * 1.2);
        float beerSoft = exp(-lightOD * sigma * 0.25) * 0.3;
        float powder = 1.0 - exp(-d * 6.0);
        float h = saturate((p.y - cloudBottom) / (cloudTop - cloudBottom));

        vec3 direct = lightColor * (beer + beerSoft) * phase * mix(0.55, 1.0, powder);
        vec3 ambient = skyAmbient * (0.30 + 0.70 * h);
        vec3 S = direct + ambient;

        float a = 1.0 - exp(-d * sigma * stepLen);
        scatter += transmittance * a * S;
        transmittance *= 1.0 - a;
        if (transmittance < 0.01) break;
    }

    // fade far away clouds into the sky so the horizon stays clean
    float fade = exp(-max(t0, 0.0) / 2600.0);
    vec3 haze = getSkyColor(dir);
    scatter = mix(haze * (1.0 - transmittance), scatter, exp(-max(t0, 0.0) / 1400.0));
    return vec4(scatter * fade, mix(1.0, transmittance, fade));
}
