/*
    Lumenfall - screen space reflections
    Screen-space ray march (perspective-correct, depth in NDC is linear in screen space),
    thickness test in linear depth, binary refinement, edge fade.
    Needs space.glsl. Uses depthtex1 (opaque) so water does not occlude what it reflects.
*/

uniform sampler2D depthtex1;

// Returns hit uv in xy, confidence in z (0 = miss)
vec3 traceSSR(vec3 viewPos, vec3 viewDir, float dither, int steps) {
    #ifndef SSR
        return vec3(0.0);
    #else
    // start slightly off the surface so the ray can't hit its own origin
    viewPos += viewDir * (0.015 + 0.004 * -viewPos.z);
    float rayLen = far * 1.5;
    if (viewDir.z > 0.0) rayLen = min(rayLen, (-viewPos.z - near * 1.05) / viewDir.z);
    if (rayLen <= 0.0) return vec3(0.0);

    vec3 start = viewToScreen(viewPos);
    vec3 end = viewToScreen(viewPos + viewDir * rayLen);

    // clip the screen ray to the viewport so all steps are useful
    vec2 dirSS = end.xy - start.xy;
    float tMax = 1.0;
    if (dirSS.x > 0.0) tMax = min(tMax, (1.0 - start.x) / dirSS.x);
    if (dirSS.x < 0.0) tMax = min(tMax, (0.0 - start.x) / dirSS.x);
    if (dirSS.y > 0.0) tMax = min(tMax, (1.0 - start.y) / dirSS.y);
    if (dirSS.y < 0.0) tMax = min(tMax, (0.0 - start.y) / dirSS.y);
    end = start + (end - start) * max(tMax, 0.0);

    // non-linear distribution: dense near the origin
    vec3 pos = start;
    vec3 prev = start;
    float startLin = linearizeDepth(start.z);

    for (int i = 0; i < steps; i++) {
        float tn = (float(i) + dither) / float(steps);
        tn = tn * tn * 0.6 + tn * 0.4;
        prev = pos;
        pos = start + (end - start) * tn;
        if (pos.z >= 1.0) break;

        float sceneDepth = texture(depthtex1, pos.xy).r;
        if (sceneDepth < HAND_DEPTH) continue;
        if (pos.z > sceneDepth && sceneDepth < 1.0) {
            float rayLin = linearizeDepth(pos.z);
            float sceneLin = linearizeDepth(sceneDepth);
            float tolerance = abs(rayLin - linearizeDepth(prev.z)) * 2.0 + 0.25 + rayLin * 0.02;
            if (rayLin - sceneLin < tolerance && abs(sceneLin - startLin) > 0.05) {
                // binary refinement
                vec3 a = prev, b = pos;
                for (int j = 0; j < SSR_REFINE_STEPS; j++) {
                    vec3 m = (a + b) * 0.5;
                    float d = texture(depthtex1, m.xy).r;
                    if (m.z > d) b = m; else a = m;
                }
                vec2 hit = b.xy;
                vec2 edge = smoothstep(vec2(0.0), vec2(0.06), hit) * smoothstep(vec2(1.0), vec2(0.94), hit);
                return vec3(hit, edge.x * edge.y);
            }
        }
    }
    return vec3(0.0);
    #endif
}
