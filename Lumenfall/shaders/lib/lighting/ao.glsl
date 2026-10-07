/*
    Lumenfall - ground truth ambient occlusion (horizon based, cosine weighted)
    Needs space.glsl. depthtex used is passed in by the caller.
*/

float gtao(sampler2D depthTex, vec2 uv, vec3 viewPos, vec3 viewNormal, vec2 noise) {
    #ifndef AO_ENABLED
        return 1.0;
    #else
    vec3 V = normalize(-viewPos);
    float radius = AO_RADIUS;
    // projected radius in pixels
    float radiusPx = radius * gbufferProjection[1][1] * 0.5 * viewHeight / max(-viewPos.z, 0.1);
    radiusPx = min(radiusPx, viewHeight * 0.15);
    if (radiusPx < 1.5) return 1.0;

    const int slices = 2;
    const int stepsPerSide = max(AO_SAMPLES / 4, 1);
    vec2 texel = 1.0 / vec2(viewWidth, viewHeight);
    float visibility = 0.0;

    for (int s = 0; s < slices; s++) {
        float phi = (float(s) + noise.x) * PI / float(slices);
        vec2 dir2 = vec2(cos(phi), sin(phi));
        vec3 dir3 = vec3(dir2, 0.0);
        vec3 orthoDir = dir3 - dot(dir3, V) * V;
        vec3 axis = normalize(cross(dir3, V));
        vec3 projN = viewNormal - axis * dot(viewNormal, axis);
        float projNLen = length(projN);
        if (projNLen < 1e-4) { visibility += 1.0; continue; }
        float cosN = saturate(dot(projN / projNLen, V));
        float n = sign(dot(orthoDir, projN)) * acos(cosN);

        float h[2];
        for (int side = 0; side < 2; side++) {
            float sgn = side == 0 ? -1.0 : 1.0;
            float maxCos = -1.0;
            for (int j = 0; j < stepsPerSide; j++) {
                float t = (float(j) + noise.y) / float(stepsPerSide);
                t = t * t;
                vec2 offset = sgn * dir2 * max(t * radiusPx, 1.0 + float(j)) * texel;
                vec2 suv = uv + offset;
                if (any(lessThan(suv, vec2(0.0))) || any(greaterThan(suv, vec2(1.0)))) break;
                float sd = texture(depthTex, suv).r;
                if (sd < HAND_DEPTH) continue;
                vec3 sp = screenToView(vec3(suv, sd));
                vec3 delta = sp - viewPos;
                float len2 = dot(delta, delta);
                float cosH = dot(delta, V) * inversesqrt(len2 + 1e-6);
                float falloff = saturate(1.0 - len2 / (radius * radius * 4.0));
                maxCos = max(maxCos, mix(-1.0, cosH, falloff));
            }
            h[side] = sgn * acos(clamp(maxCos, -1.0, 1.0));
        }
        float h0 = n + max(h[0] - n, -HALF_PI);
        float h1 = n + min(h[1] - n, HALF_PI);
        float sinN = sin(n);
        float vd = 0.25 * (-cos(2.0 * h0 - n) + cosN + 2.0 * h0 * sinN)
                 + 0.25 * (-cos(2.0 * h1 - n) + cosN + 2.0 * h1 * sinN);
        visibility += projNLen * vd;
    }
    visibility = saturate(visibility / float(slices));
    return pow(visibility, AO_STRENGTH);
    #endif
}

