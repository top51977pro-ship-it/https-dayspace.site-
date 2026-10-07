/*
    Lumenfall - temporal anti-aliasing
    Closest-depth reprojection, Catmull-Rom history, YCoCg variance clipping,
    luminance-weighted (tonemapped) blending, motion-adaptive feedback.
    colortex4 = history (not cleared)
*/

#include "/lib/common.glsl"

//==================================================================================//
#ifdef VERTEX_SHADER

out vec2 vUV;

void main() {
    gl_Position = ftransform();
    vUV = gl_MultiTexCoord0.xy;
}

#endif

//==================================================================================//
#ifdef FRAGMENT_SHADER

in vec2 vUV;

uniform sampler2D colortex0;
uniform sampler2D colortex4;
uniform sampler2D depthtex0;

#include "/lib/util/space.glsl"

/* RENDERTARGETS: 0,4 */
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outHistory;

vec3 rgbToYCoCg(vec3 c) {
    return vec3(dot(c, vec3(0.25, 0.5, 0.25)), dot(c, vec3(0.5, 0.0, -0.5)), dot(c, vec3(-0.25, 0.5, -0.25)));
}
vec3 yCoCgToRgb(vec3 c) {
    return vec3(c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z);
}

vec3 tonemapWeight(vec3 c) { return c / (1.0 + luminance(c)); }
vec3 tonemapWeightInv(vec3 c) { return c / max(1.0 - luminance(c), 1e-4); }

vec3 sampleCatmullRom(sampler2D t, vec2 uv) {
    vec2 res = vec2(viewWidth, viewHeight);
    vec2 pos = uv * res;
    vec2 c = floor(pos - 0.5) + 0.5;
    vec2 f = pos - c;
    vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
    vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
    vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
    vec2 w3 = f * f * (-0.5 + 0.5 * f);
    vec2 w12 = w1 + w2;
    vec2 off12 = w2 / w12;
    vec2 p0 = (c - 1.0) / res, p3 = (c + 2.0) / res, p12 = (c + off12) / res;
    vec3 r = vec3(0.0);
    r += texture(t, vec2(p12.x, p0.y)).rgb * w12.x * w0.y;
    r += texture(t, vec2(p0.x, p12.y)).rgb * w0.x * w12.y;
    r += texture(t, vec2(p12.x, p12.y)).rgb * w12.x * w12.y;
    r += texture(t, vec2(p3.x, p12.y)).rgb * w3.x * w12.y;
    r += texture(t, vec2(p12.x, p3.y)).rgb * w12.x * w3.y;
    float wSum = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
    return max(r / wSum, vec3(0.0));
}

void main() {
    ivec2 px = ivec2(gl_FragCoord.xy);
    vec3 current = texelFetch(colortex0, px, 0).rgb;

    #ifndef TAA
        outColor = vec4(current, 1.0);
        outHistory = vec4(current, 1.0);
        return;
    #else
    // neighbourhood statistics + closest depth
    vec3 m1 = vec3(0.0), m2 = vec3(0.0);
    vec3 nMin = vec3(1e9), nMax = vec3(-1e9);
    float closest = 1.0;
    ivec2 closestOff = ivec2(0);
    for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
        ivec2 o = ivec2(x, y);
        vec3 c = rgbToYCoCg(tonemapWeight(texelFetch(colortex0, px + o, 0).rgb));
        m1 += c; m2 += c * c;
        nMin = min(nMin, c); nMax = max(nMax, c);
        float d = texelFetch(depthtex0, px + o, 0).r;
        if (d < closest) { closest = d; closestOff = o; }
    }
    m1 /= 9.0; m2 /= 9.0;
    vec3 sigma = sqrt(max(m2 - m1 * m1, 0.0));

    float depth = texelFetch(depthtex0, px, 0).r;
    bool hand = depth < HAND_DEPTH;
    vec2 uv = (vec2(px + closestOff) + 0.5) / vec2(viewWidth, viewHeight) - taaOffset();
    vec3 prev = reproject(vec3(uv, closest));
    vec2 velocity = prev.xy - uv;
    vec2 prevUV = vUV + velocity;

    bool offscreen = any(lessThan(prevUV, vec2(0.0))) || any(greaterThan(prevUV, vec2(1.0)));

    vec3 history = rgbToYCoCg(tonemapWeight(sanitize(sampleCatmullRom(colortex4, prevUV))));
    vec3 cur = rgbToYCoCg(tonemapWeight(current));

    // variance clip (tight) intersected with min/max box
    float gamma = 1.1;
    vec3 boxMin = max(nMin, m1 - sigma * gamma);
    vec3 boxMax = min(nMax, m1 + sigma * gamma);
    vec3 center = (boxMin + boxMax) * 0.5;
    vec3 extent = max((boxMax - boxMin) * 0.5, vec3(1e-5));
    vec3 diff = history - center;
    vec3 unit = abs(diff / extent);
    float maxUnit = max(unit.x, max(unit.y, unit.z));
    if (maxUnit > 1.0) history = center + diff / maxUnit;

    float speed = length(velocity * vec2(viewWidth, viewHeight));
    float blend = TAA_BLEND;
    blend = mix(blend, 0.78, saturate(speed / 18.0));
    if (hand) blend = min(blend, 0.6);
    if (offscreen || any(isnan(history))) blend = 0.0;

    vec3 result = mix(cur, history, blend);
    result = tonemapWeightInv(yCoCgToRgb(result));
    result = max(sanitize(result), vec3(0.0));

    outColor = vec4(result, 1.0);
    outHistory = vec4(result, 1.0);
    #endif
}

#endif
