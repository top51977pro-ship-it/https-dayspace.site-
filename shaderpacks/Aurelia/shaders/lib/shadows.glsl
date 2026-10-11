// Shadow map distortion + soft, coloured shadow lookups.

float getDistortFactor(vec2 p) {
    return length(p) * SHADOW_DISTORT + (1.0 - SHADOW_DISTORT);
}

vec3 distortShadowPos(vec3 p) {
    p.xy /= getDistortFactor(p.xy);
    p.z *= 0.2;
    return p;
}

#if defined FSH && !defined SHADOW_PASS
// playerPos: feet-relative world aligned position, normalW: world normal.
// subsurface > 0.5 offsets along the light direction instead of the normal (foliage).
vec3 getShadow(vec3 playerPos, vec3 normalW, float subsurface, float dither) {
    vec3 shadowView = (shadowModelView * vec4(playerPos, 1.0)).xyz;
    vec2 shadowClipXY = (shadowProjection * vec4(shadowView, 1.0)).xy;
    float distortF = getDistortFactor(shadowClipXY);

    float texelWorld = 2.0 * shadowDistance / float(shadowMapResolution);
    vec3 offsetDir = subsurface > 0.5 ? lightDir : normalW;
    float NdotL = dot(normalW, lightDir);
    float bias = texelWorld * distortF * (1.2 + 1.5 * (1.0 - saturate(abs(NdotL)))) + 0.01;
    vec3 biasedPos = playerPos + offsetDir * bias;

    vec3 shadowPos = (shadowProjection * (shadowModelView * vec4(biasedPos, 1.0))).xyz;
    shadowPos = distortShadowPos(shadowPos) * 0.5 + 0.5;
    shadowPos.z -= 0.00002;

    if (any(greaterThan(abs(shadowPos.xy - 0.5), vec2(0.499)))) return vec3(1.0);

    float radius = (0.4 + SHADOW_SOFTNESS * 1.1) / float(shadowMapResolution) * (1.0 + subsurface);
    float phi = dither * TAU;
    float s0 = 0.0;
    float s1 = 0.0;
    for (int i = 0; i < SHADOW_SAMPLES; i++) {
        vec2 offset = vogelDisk(i, SHADOW_SAMPLES, phi) * radius;
        vec2 uv = shadowPos.xy + offset;
        s0 += step(shadowPos.z, texture(shadowtex0, uv).r);
        #ifdef COLORED_SHADOWS
        s1 += step(shadowPos.z, texture(shadowtex1, uv).r);
        #endif
    }
    s0 /= float(SHADOW_SAMPLES);

    #ifdef COLORED_SHADOWS
    s1 /= float(SHADOW_SAMPLES);
    if (s1 - s0 > 0.001) {
        vec3 tint = texture(shadowcolor0, shadowPos.xy).rgb;
        return vec3(s0) + tint * (s1 - s0);
    }
    #endif
    return vec3(s0);
}

// Cheap single-tap version for volumetric light.
vec3 getShadowVL(vec3 playerPos) {
    vec3 shadowPos = (shadowProjection * (shadowModelView * vec4(playerPos, 1.0))).xyz;
    shadowPos = distortShadowPos(shadowPos) * 0.5 + 0.5;
    if (any(greaterThan(abs(shadowPos.xy - 0.5), vec2(0.499)))) return vec3(1.0);
    float s0 = step(shadowPos.z, texture(shadowtex0, shadowPos.xy).r);
    #ifdef COLORED_SHADOWS
    float s1 = step(shadowPos.z, texture(shadowtex1, shadowPos.xy).r);
    if (s1 > s0) return texture(shadowcolor0, shadowPos.xy).rgb;
    #endif
    return vec3(s0);
}
#endif
