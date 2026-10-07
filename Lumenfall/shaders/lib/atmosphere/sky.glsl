/*
    Lumenfall - sky composition for every dimension
    Needs atmosphere.glsl, skyObjects.glsl, dimensions.glsl, noise.glsl
*/

vec3 rainySky(vec3 sky) {
    float l = luminance(sky);
    return mix(sky, vec3(l) * vec3(0.82, 0.88, 1.0) * 0.55, lf_rain * 0.85);
}

// Atmosphere only (no sun disk / stars) - used for fog, reflections, ambient
vec3 skyAtmosphere(vec3 dir) {
    #if defined NETHER
        return netherBiomeColor() * 0.6;
    #elif defined END
        return endSky(dir, 0.002) * 0.5 + endAmbient() * 0.15;
    #else
        vec3 d = dir;
        float below = saturate(-d.y * 2.5);
        d.y = max(d.y, 0.0);
        d = normalize(d);
        vec3 sky = atmosphereScatter(d, sunDirWorld(), moonDirWorld());
        sky *= mix(1.0, 0.35, below);
        return rainySky(sky);
    #endif
}

// Full sky including celestial objects
vec3 renderSky(vec3 dir, float pixelAngle, float dither) {
    #if defined NETHER
        return netherBiomeColor() * 0.6;
    #elif defined END
        return endSky(dir, pixelAngle);
    #else
        vec3 sunDir = sunDirWorld();
        vec3 moonDir = moonDirWorld();
        vec3 d = dir;
        float below = saturate(-d.y * 2.5);
        d.y = max(d.y, 0.0);
        d = normalize(d);

        vec3 sky = atmosphereScatter(d, sunDir, moonDir);
        vec3 trans = sunTransmittanceAtViewer(d);
        float clear = 1.0 - lf_rain * 0.92;

        if (dir.y > -0.01) {
            sky += sunDisk(dir, sunDir, trans) * clear;
            sky += moonDisk(dir, moonDir, trans) * clear;
            sky += nightSkyEmission(dir, pixelAngle, dither, trans);
            #ifdef RAINBOWS
                float rainbowAmount = saturate(wetness * 1.4 - rainStrength * 1.5) * dayFactor() * (1.0 - lf_dryBiome);
                sky += rainbow(dir, sunDir, rainbowAmount) * luminance(sky) * 0.35;
            #endif
        }
        sky *= mix(1.0, 0.35, below);
        return rainySky(sky);
    #endif
}
