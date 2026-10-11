// Screen space reflections (raymarched against opaque depth).

// Returns hit uv in .xy and confidence in .z (0 = miss)
vec3 raytraceSSR(vec3 viewPos, vec3 rayDir, float dither) {
    float stepLen = 0.12 + 0.03 * length(viewPos);
    vec3 stepVec = rayDir * stepLen;
    vec3 pos = viewPos + stepVec * dither;

    for (int i = 0; i < 32; i++) {
        pos += stepVec;
        if (pos.z > -near) break;
        vec3 screen = viewToScreen(pos);
        if (any(lessThan(screen.xy, vec2(0.0))) || any(greaterThan(screen.xy, vec2(1.0)))) break;

        float sceneDepth = texture(depthtex1, screen.xy).r;
        if (sceneDepth < 0.56) { stepVec *= 1.2; continue; }
        vec3 sceneView = screenToView(screen.xy, sceneDepth);
        float diff = sceneView.z - pos.z;

        if (diff > 0.0 && diff < length(stepVec) * 2.5 + 0.25) {
            vec3 a = pos - stepVec;
            vec3 b = pos;
            for (int k = 0; k < 5; k++) {
                vec3 m = (a + b) * 0.5;
                vec3 ms = viewToScreen(m);
                float md = screenToView(ms.xy, texture(depthtex1, ms.xy).r).z - m.z;
                if (md > 0.0) b = m; else a = m;
            }
            vec3 hit = viewToScreen(b);
            if (texture(depthtex1, hit.xy).r >= 1.0) return vec3(0.0);
            vec2 edge = min(hit.xy, 1.0 - hit.xy);
            float fade = smoothstep(0.0, 0.06, min(edge.x, edge.y));
            return vec3(hit.xy, fade);
        }
        stepVec *= 1.18;
    }
    return vec3(0.0);
}
