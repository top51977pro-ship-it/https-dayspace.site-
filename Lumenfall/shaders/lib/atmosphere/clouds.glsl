/*
    Lumenfall - volumetric clouds
    Ray-marched cumulus layer on a curved shell, energy-conserving integration,
    multi-octave multiple scattering, dual-lobe phase, powder term, cirrus layer
    and cheap cloud shadows. Needs noise.glsl + atmosphere.glsl.
*/

const float CLOUD_PLANET_R = 60000.0; // curvature radius in blocks
const float CLOUD_BASE = float(CLOUD_ALTITUDE);
const float CLOUD_TOP  = float(CLOUD_ALTITUDE + CLOUD_THICKNESS);

vec3 cloudWind() {
    float t = frameTimeCounter * CLOUD_SPEED;
    return vec3(t * 9.0, 0.0, t * 3.2);
}

float cloudCoverage() {
    return saturate(CLOUD_COVERAGE + lf_rain * 0.38 - lf_dryBiome * 0.15);
}

// Curved-shell height of a world position relative to the camera column
float cloudHeight(vec3 wp) {
    vec2 d = wp.xz - cameraPosition.xz;
    return wp.y + dot(d, d) / (2.0 * CLOUD_PLANET_R);
}

float cloudShape(vec3 wp, out float heightFrac) {
    float h = cloudHeight(wp);
    heightFrac = (h - CLOUD_BASE) / (CLOUD_TOP - CLOUD_BASE);
    if (heightFrac < 0.0 || heightFrac > 1.0) return 0.0;

    vec3 wind = cloudWind();
    vec3 p = (wp + wind) / CLOUD_SCALE;

    float cov = cloudCoverage();
    // large scale weather: where cumulus grow
    float weather = fbm2D(p.xz * 0.00045 + 13.0, 3);
    weather = saturate(remap(weather, 0.25, 0.75, 0.0, 1.0));
    float localCov = saturate(cov * 1.2 - 0.1 + (weather - 0.5) * 0.9);

    // vertical profile: rounded bottoms, cauliflower tops, taller where dense
    float bottom = smoothstep(0.0, 0.10, heightFrac);
    float top = smoothstep(1.0, mix(0.35, 0.75, localCov), heightFrac);
    float profile = bottom * top;

    float base = fbm3D(p * vec3(0.0055, 0.0075, 0.0055), 4);
    float threshold = 1.0 - localCov * 0.85;
    // steep remap: crisp cloud boundaries with dense cores
    float d = saturate(remap(base * profile, threshold, threshold + 0.28, 0.0, 1.0));
    return d;
}

float cloudDensity(vec3 wp, bool detail) {
    float hf;
    float d = cloudShape(wp, hf);
    if (d <= 0.0) return 0.0;
    #if CLOUD_DETAIL > 0
        if (detail) {
            vec3 p = (wp + cloudWind() * 1.6) / CLOUD_SCALE;
            // billowy cauliflower lobes from inverted cellular noise, wisps from value noise
            float cells = 1.0 - worley3D(p * 0.022);
            float wisps = fbm3D(p * 0.06, CLOUD_DETAIL);
            float e = mix(wisps, cells, mix(0.25, 0.75, hf));
            #if CLOUD_DETAIL >= 3
                e = e * 0.8 + fbm3D(p * 0.15, 2) * 0.2;
            #endif
            // erode more at the bottom (wispy) than at the top (billowy)
            d = saturate(remap(d, e * mix(0.55, 0.32, hf), 1.0, 0.0, 1.0));
        }
    #endif
    return d * (0.06 + lf_rain * 0.03) * CLOUD_DENSITY;
}

float cloudLightOpticalDepth(vec3 wp, vec3 l, float dither) {
    float od = 0.0;
    float stepLen = 10.0;
    vec3 p = wp + l * stepLen * dither;
    for (int i = 0; i < CLOUD_LIGHT_STEPS; i++) {
        od += cloudDensity(p, i < 2) * stepLen;
        p += l * stepLen;
        stepLen *= 1.75;
    }
    return od;
}

float cloudPhase(float mu) {
    return mix(phaseHG(mu, -0.15), phaseHG(mu, 0.80), 0.55) * 0.75 + phaseHG(mu, 0.98) * 0.25;
}

struct CloudResult {
    vec3  scattering;
    float transmittance;
    float distance;
};

/*
    rayDir: world direction, maxDist: opaque geometry distance (blocks),
    lightCol / ambTop / ambBottom: precomputed light colours.
*/
CloudResult marchClouds(vec3 rayDir, float maxDist, vec3 lightDir, vec3 lightCol, vec3 ambTop, vec3 ambBottom,
                        float dither, int steps) {
    CloudResult res;
    res.scattering = vec3(0.0);
    res.transmittance = 1.0;
    res.distance = 1e6;

    vec3 ro = cameraPosition;
    vec3 center = vec3(cameraPosition.x, -CLOUD_PLANET_R, cameraPosition.z);
    vec2 inner = raySphere(ro - center, rayDir, CLOUD_PLANET_R + CLOUD_BASE);
    vec2 outer = raySphere(ro - center, rayDir, CLOUD_PLANET_R + CLOUD_TOP);
    float camH = cloudHeight(ro);

    float tStart, tEnd;
    if (camH < CLOUD_BASE) {
        if (rayDir.y < 0.0 && inner.y < 0.0) return res;
        tStart = max(inner.y, 0.0);
        tEnd = outer.y;
    } else if (camH > CLOUD_TOP) {
        if (outer.x < 0.0) return res;
        tStart = outer.x;
        tEnd = inner.x > 0.0 ? inner.x : outer.y;
    } else {
        tStart = 0.0;
        tEnd = inner.x > 0.0 ? inner.x : outer.y;
    }
    tEnd = min(tEnd, tStart + 9000.0);
    tEnd = min(tEnd, maxDist);
    if (tEnd <= tStart) return res;

    float stepLen = (tEnd - tStart) / float(steps);
    float mu = dot(rayDir, lightDir);
    float phase = cloudPhase(mu);
    float t = tStart + stepLen * dither;
    float weightedDist = 0.0, weightSum = 0.0;

    for (int i = 0; i < steps; i++) {
        vec3 p = ro + rayDir * t;
        float density = cloudDensity(p, true);
        if (density > 1e-4) {
            float hf = saturate((cloudHeight(p) - CLOUD_BASE) / (CLOUD_TOP - CLOUD_BASE));
            float od = cloudLightOpticalDepth(p, lightDir, dither);

            // multiple scattering octaves
            vec3 lightScatter = vec3(0.0);
            float a = 1.0, b = 1.0, c = 1.0;
            for (int k = 0; k < 4; k++) {
                float ph = mix(phaseHG(mu * c, 0.80 * c), phaseHG(mu, -0.15), 0.25);
                ph = k == 0 ? phase : ph;
                lightScatter += vec3(a * ph * exp(-od * b));
                a *= 0.55; b *= 0.4; c *= 0.6;
            }
            float powder = 1.0 - exp(-density * 60.0);
            powder = mix(1.0, powder, saturate(0.6 - mu * 0.6) * 0.8 + 0.2);

            vec3 ambient = mix(ambBottom, ambTop, hf * hf * 0.7 + 0.3) * (0.35 + 0.65 * hf);
            vec3 S = (lightCol * lightScatter * powder * 2.2 + ambient) * density;
            float ext = exp(-density * stepLen);
            vec3 Sint = (S - S * ext) / max(density, 1e-5);
            res.scattering += res.transmittance * Sint;

            float w = res.transmittance * (1.0 - ext);
            weightedDist += t * w;
            weightSum += w;

            res.transmittance *= ext;
            if (res.transmittance < 0.01) break;
            t += stepLen;
        } else {
            // empty space: stride further (the step budget then ends the march early)
            t += stepLen * 1.8;
        }
        if (t > tEnd) break;
    }

    res.distance = weightSum > 1e-4 ? weightedDist / weightSum : tEnd;

    // fade far clouds into the atmosphere
    float fade = exp(-max(res.distance - 1500.0, 0.0) * 0.00028);
    fade *= smoothstep(0.0, 0.03, rayDir.y + 0.03 * float(camH > CLOUD_BASE));
    res.scattering *= fade;
    res.transmittance = mix(1.0, res.transmittance, fade);
    return res;
}

// High-altitude cirrus (single layer, 2D)
vec4 cirrusClouds(vec3 rayDir, vec3 lightDir, vec3 lightCol, vec3 ambient) {
    #ifndef CIRRUS_CLOUDS
        return vec4(0.0, 0.0, 0.0, 1.0);
    #else
        if (rayDir.y < 0.01) return vec4(0.0, 0.0, 0.0, 1.0);
        float alt = 1400.0 - cameraPosition.y;
        if (alt < 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
        vec2 p = (cameraPosition.xz + rayDir.xz / rayDir.y * alt + cloudWind().xz * 2.5) * 0.0004;
        vec2 warp = vec2(fbm2D(p * 3.0, 3), fbm2D(p * 3.0 + 9.0, 3)) - 0.5;
        float n = fbm2D(p * vec2(1.0, 4.0) + warp * 1.5, 5);
        float streak = fbm2D(p * vec2(10.0, 40.0) + warp * 4.0, 3);
        float d = smoothstep(0.52 - lf_rain * 0.1, 0.85, n) * (0.55 + streak * 0.6);
        d *= smoothstep(0.01, 0.15, rayDir.y);
        float mu = dot(rayDir, lightDir);
        vec3 col = (lightCol * (phaseHG(mu, 0.7) * 0.8 + 0.12) + ambient * 0.6) * d * 0.55;
        return vec4(col, 1.0 - d * 0.45);
    #endif
}

// Cheap cloud shadow for surfaces & volumetric light
float cloudShadow(vec3 worldPos, vec3 lightDir) {
    #if defined CLOUD_SHADOWS && defined VOLUMETRIC_CLOUDS
        if (lightDir.y < 0.02) return 1.0;
        float mid = mix(CLOUD_BASE, CLOUD_TOP, 0.35);
        float t = (mid - worldPos.y) / lightDir.y;
        if (t < 0.0) return 1.0;
        vec3 p = worldPos + lightDir * t;
        float od = 0.0;
        for (int i = -1; i <= 1; i++) {
            od += cloudDensity(p + lightDir * float(i) * CLOUD_THICKNESS * 0.25, false);
        }
        od *= CLOUD_THICKNESS * 0.33;
        return mix(1.0, exp(-od * 0.9), 0.92);
    #else
        return 1.0;
    #endif
}
