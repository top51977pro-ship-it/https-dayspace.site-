/*
    Lumenfall - motion blur
    Per-pixel camera motion from depth reprojection, scaled to a frame-rate independent
    180 degree shutter at 24 fps (cinema look) times the user strength.
    Depth-aware sampling keeps sharp foreground edges.
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
uniform sampler2D depthtex0;

#include "/lib/util/noise.glsl"
#include "/lib/util/space.glsl"

/* RENDERTARGETS: 0 */
layout(location = 0) out vec4 outColor;

void main() {
    ivec2 px = ivec2(gl_FragCoord.xy);
    vec3 color = texelFetch(colortex0, px, 0).rgb;

    #ifndef MOTION_BLUR
        outColor = vec4(color, 1.0);
        return;
    #else
    float depth = texelFetch(depthtex0, px, 0).r;
    if (depth < HAND_DEPTH) { outColor = vec4(color, 1.0); return; }

    vec3 prev = reproject(vec3(vUV, depth));
    vec2 velocity = vUV - prev.xy;
    // per-frame motion -> per-second motion -> exposure of a 1/48 s shutter
    float shutter = (1.0 / 48.0) / max(lf_frameTimeSmooth, 1.0 / 1000.0);
    velocity *= min(shutter, 4.0) * MOTION_BLUR_STRENGTH;
    float len = length(velocity);
    float maxLen = 0.06;
    if (len > maxLen) velocity *= maxLen / len;
    if (length(velocity * vec2(viewWidth, viewHeight)) < 0.75) { outColor = vec4(color, 1.0); return; }

    float centerLin = depth >= 1.0 ? far * 4.0 : linearizeDepth(depth);
    float dither = blueNoise(gl_FragCoord.xy);
    vec3 sum = color;
    float wSum = 1.0;
    const int N = MOTION_BLUR_SAMPLES;
    for (int i = 0; i < N; i++) {
        float t = (float(i) + dither) / float(N) - 0.5;
        vec2 suv = vUV + velocity * t;
        if (any(lessThan(suv, vec2(0.0))) || any(greaterThan(suv, vec2(1.0)))) continue;
        float sd = texture(depthtex0, suv).r;
        if (sd < HAND_DEPTH) continue;
        float sLin = sd >= 1.0 ? far * 4.0 : linearizeDepth(sd);
        // samples much closer than the centre belong to a different (foreground) object
        float w = sLin < centerLin * 0.85 ? 0.25 : 1.0;
        sum += texture(colortex0, suv).rgb * w;
        wSum += w;
    }
    outColor = vec4(sum / wSum, 1.0);
    #endif
}

#endif
