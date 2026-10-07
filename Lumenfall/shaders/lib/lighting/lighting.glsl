/*
    Lumenfall - surface shading (opaque deferred + forward translucents)
    Needs: brdf.glsl, shadows.glsl, clouds.glsl (cloudShadow), space.glsl, noise.glsl
*/

vec3 blockLightColor() {
    return blackbody(float(BLOCKLIGHT_TEMP)) * BLOCKLIGHT_INTENSITY;
}

float blockLightFalloff(float lm) {
    // lightmap is linear in light level: build a smooth inverse-square-like curve
    float l = saturate(lm * 1.03 - 0.02);
    float curve = pow(l, 4.2) * 3.2 + pow(l, 1.6) * 0.18;
    #ifdef BLOCKLIGHT_FLICKER
        float flicker = 1.0 + 0.035 * (sin(frameTimeCounter * 7.3) * 0.6 + sin(frameTimeCounter * 13.1 + 1.7) * 0.4);
        curve *= flicker;
    #endif
    return curve;
}

float skyLightFalloff(float lm) {
    return lm * lm * (3.0 - 2.0 * lm) * lm;
}

vec3 heldLight(vec3 playerPos) {
    #ifdef HANDHELD_LIGHT
        float level = float(max(heldBlockLightValue, heldBlockLightValue2));
        if (level < 0.5) return vec3(0.0);
        float d = length(playerPos);
        float range = level * 0.9;
        float att = saturate(1.0 - d / range);
        att = att * att / (1.0 + d * d * 0.08);
        return blockLightColor() * att * level / 15.0 * 1.8;
    #else
        return vec3(0.0);
    #endif
}

vec3 minimumLight() {
    return vec3(0.55, 0.65, 1.0) * 0.0035 * MIN_LIGHT + nightVision * vec3(0.12);
}

vec3 lightningFlash(vec2 lm) {
    #ifdef LIGHTNING_FLASH
        if (lightningBoltPosition.w < 0.5) return vec3(0.0);
        return vec3(0.65, 0.75, 1.0) * 1.6 * lm.y * lm.y;
    #else
        return vec3(0.0);
    #endif
}

// Rain: darkens porous surfaces & makes up-facing ones glossy
void applyWetness(inout GData g, vec3 worldPos, float wet) {
    if (wet < 0.001) return;
    float exposure = smoothstep(0.85, 0.97, g.lightmap.y);
    float up = smoothstep(0.3, 0.9, g.geoNormal.y);
    float w = wet * exposure;
    if (w < 0.001) return;
    float puddle = 0.0;
    #ifdef RAIN_PUDDLES
        float n = fbm2D(worldPos.xz * 0.35, 3);
        puddle = smoothstep(0.62 - PUDDLE_AMOUNT * 0.3, 0.70 - PUDDLE_AMOUNT * 0.3, n) * up * w;
        if (g.matId == MAT_PLANT || g.matId == MAT_FOLIAGE) puddle = 0.0;
    #endif
    float porosity = (g.matId == MAT_METAL || g.matId == MAT_GEM || g.matId == MAT_ICE) ? 0.1 : 0.65;
    g.albedo *= mix(1.0, 1.0 - porosity * 0.55, w * (0.5 + 0.5 * up));
    g.smoothness = mix(g.smoothness, max(g.smoothness, 0.55 + up * 0.25), w * up);
    g.smoothness = mix(g.smoothness, 0.97, puddle);
    g.f0 = mix(g.f0, max(g.f0, 0.02), w);
    g.normal = normalize(mix(g.normal, g.geoNormal, puddle));
}

vec3 shadeSurface(GData g, vec3 playerPos, vec3 viewDirW, float ao, float dither, LightInputs li,
                  out vec3 specularOut) {
    vec3 n = g.normal;
    vec3 v = -viewDirW;
    vec3 l = li.lightDir;
    bool foliage = g.matId == MAT_FOLIAGE || g.matId == MAT_PLANT;
    bool metal = isMetal(g.f0);
    float roughness = saturate(1.0 - g.smoothness);

    vec3 f0 = metal ? metalF0(g.f0, g.albedo) : vec3(max(g.f0, 0.02));
    vec3 diffuseAlbedo = metal ? vec3(0.0) : g.albedo;

    float NdotL = dot(n, l);
    float NdotV = saturate(dot(n, v));
    float geoNdotL = dot(g.geoNormal, l);

    // plants: soften the normal towards up so fields don't look noisy
    float NdotLShade = foliage ? saturate(mix(NdotL, 0.6, 0.5)) : saturate(NdotL);

    vec3 color = vec3(0.0);
    specularOut = vec3(0.0);

    //---- direct light ----------------------------------------------------------
    #if defined OVERWORLD || defined END
    {
        float facing = foliage ? 1.0 : step(0.0, geoNdotL);
        vec3 shadowLight = vec3(0.0);
        ShadowResult sr;
        sr.light = vec3(0.0);
        sr.opaque = 0.0;
        sr.thickness = 8.0;
        if (facing > 0.0 || foliage) {
            sr = sampleShadow(playerPos, g.geoNormal * (foliage ? sign(geoNdotL + 1e-4) : 1.0),
                              abs(geoNdotL), dither, foliage);
            shadowLight = sr.light;
            float dist = length(playerPos);
            float outside = smoothstep(shadowDistance * 0.92, shadowDistance, dist);
            float lmShadow = smoothstep(0.82, 0.96, g.lightmap.y);
            shadowLight = mix(shadowLight, vec3(lmShadow), outside);
            #ifndef SHADOWS
                shadowLight = vec3(lmShadow);
            #endif
        }
        #ifdef OVERWORLD
            float cs = cloudShadow(playerPos + cameraPosition, l);
            shadowLight *= cs;
        #endif

        vec3 h = normalize(l + v);
        float LdotH = saturate(dot(l, h));
        float diff = foliage ? NdotLShade * INV_PI : diffuseBurley(NdotLShade, NdotV, LdotH, roughness);
        vec3 F = fresnelSchlick(NdotV, f0);
        color += diffuseAlbedo * (1.0 - F * float(!foliage) * 0.5) * diff * li.lightCol * shadowLight * facing;

        // subsurface scattering (leaves, grass, snow)
        float sss = g.sss * SSS_STRENGTH;
        if (sss > 0.001) {
            float mu = dot(viewDirW, l);
            float thickness = sr.thickness;
            float transmit = exp(-thickness * (foliage ? 1.6 : 4.0));
            float phase = mix(phaseHG(mu, 0.55), 0.0796, 0.35) * 4.0;
            vec3 sssCol = diffuseAlbedo * sqrt(diffuseAlbedo) * 2.0;
            float vis = max(sr.opaque, transmit * 0.85);
            #ifndef SHADOWS
                vis = smoothstep(0.82, 0.96, g.lightmap.y);
            #endif
            color += sssCol * li.lightCol * vis * phase * sss * saturate(1.0 - NdotL * 0.6) * 0.5;
        }

        #ifdef SPECULAR_HIGHLIGHTS
            if (facing > 0.0 && NdotL > 0.0) {
                vec3 spec = specularGGX(n, v, l, roughness, f0, li.lightRadius);
                specularOut = spec * li.lightCol * shadowLight;
            }
        #endif
    }
    #endif

    //---- ambient ---------------------------------------------------------------
    vec3 aoCol = aoMultiBounce(ao, g.albedo);
    float skyL = skyLightFalloff(g.lightmap.y);
    float upness = n.y * 0.5 + 0.5;
    vec3 ambient = mix(li.ambBottom, li.ambTop, upness) * skyL;
    #ifdef NETHER
        ambient = li.ambTop * mix(0.7, 1.0, upness);
    #endif
    #ifdef END
        ambient = mix(li.ambBottom, li.ambTop, upness);
    #endif
    ambient *= AMBIENT_INTENSITY;

    vec3 block = blockLightColor() * blockLightFalloff(g.lightmap.x);
    block += heldLight(playerPos) * saturate(dot(n, -normalize(playerPos)) * 0.7 + 0.3);

    vec3 indirect = ambient * aoCol + block * mix(1.0, ao, 0.6) + minimumLight() * aoCol + lightningFlash(g.lightmap);

    // energy split between diffuse and the (later) reflection pass
    vec3 Fenv = envBRDFApprox(f0, NdotV, roughness);
    color += diffuseAlbedo * indirect * (metal ? 0.0 : 1.0) * (1.0 - Fenv * 0.5);
    // metals still pick up some ambient colour when reflections are unavailable
    color += metal ? g.albedo * indirect * 0.2 : vec3(0.0);

    //---- emission --------------------------------------------------------------
    color += g.albedo * g.emission * EMISSIVE_STRENGTH * 6.0;

    return color;
}
