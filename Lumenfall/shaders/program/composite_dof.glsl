/*
    Lumenfall - depth of field
    Thin-lens circle of confusion, scatter-as-gather bokeh with polygonal aperture
    blades, highlight-weighted bokeh balls, optional axial chromatic aberration,
    foreground/background separation to avoid halos.
*/

#include "/lib/common.glsl"

//==================================================================================//
#ifdef VERTEX_SHADER

out vec2 vUV;
flat out float vFocus;

#include "/lib/util/space.glsl"

void main() {
    gl_Position = ftransform();
    vUV = gl_MultiTexCoord0.xy;
    #if DOF_FOCUS_MODE == 0
        float cd = centerDepthSmooth;
        vFocus = cd < HAND_DEPTH ? 2.0 : (cd >= 1.0 ? far : linearizeDepth(cd));
    #else
        vFocus = DOF_FOCUS_DISTANCE;
    #endif
    vFocus = max(vFocus, 0.3);
}

#endif

//==================================================================================//
#ifdef FRAGMENT_SHADER

in vec2 vUV;
flat in float vFocus;

uniform sampler2D colortex0;
uniform sampler2D depthtex0;

#include "/lib/util/noise.glsl"
#include "/lib/util/space.glsl"
#include "/lib/atmosphere/lightData.glsl"

/* RENDERTARGETS: 0 */
layout(location = 0) out vec4 outColor;

// signed CoC in pixels: negative = near field
float circleOfConfusion(float depth) {
    if (depth < HAND_DEPTH) return 0.0;
    float d = depth >= 1.0 ? far * 4.0 : linearizeDepth(depth);
    float coc = (1.0 - vFocus / d) * DOF_INTENSITY * 9.0 * (viewHeight / 1080.0);
    #ifndef DOF_NEAR_BLUR
        coc = max(coc, 0.0);
    #endif
    float maxR = DOF_MAX_RADIUS * (viewHeight / 1080.0);
    return clamp(coc, -maxR, maxR);
}

vec2 apertureShape(vec2 diskSample) {
    #if DOF_BLADES == 0
        return diskSample;
    #else
        const float n = float(DOF_BLADES);
        float r = length(diskSample);
        float theta = atan(diskSample.y, diskSample.x) + 0.35;
        float seg = TAU / n;
        float local = mod(theta, seg) - seg * 0.5;
        float polyR = cos(PI / n) / cos(local);
        return diskSample * mix(1.0, polyR, 0.9);
    #endif
}

void main() {
    ivec2 px = ivec2(gl_FragCoord.xy);
    vec3 center = texelFetch(colortex0, px, 0).rgb;

    #ifndef DOF
        outColor = vec4(center, 1.0);
        return;
    #else
    float depthC = texelFetch(depthtex0, px, 0).r;
    float cocC = circleOfConfusion(depthC);
    float linC = depthC >= 1.0 ? far * 4.0 : linearizeDepth(depthC);

    // search for near-field blur that could spill onto this pixel
    float maxR = DOF_MAX_RADIUS * (viewHeight / 1080.0);
    float nearSpill = 0.0;
    #ifdef DOF_NEAR_BLUR
        for (int i = 0; i < 8; i++) {
            float a = float(i) * TAU / 8.0;
            vec2 o = vec2(cos(a), sin(a)) * maxR * 0.6;
            float c = circleOfConfusion(texture(depthtex0, vUV + o / vec2(viewWidth, viewHeight)).r);
            nearSpill = max(nearSpill, -c);
        }
    #endif

    float radius = max(abs(cocC), nearSpill);
    if (radius < 0.5) {
        outColor = vec4(center, 1.0);
        return;
    }

    vec2 texel = 1.0 / vec2(viewWidth, viewHeight);
    const int N = DOF_SAMPLES;
    // rotate the pattern only within one sample spacing: stable, no visible noise
    float phi = blueNoise(gl_FragCoord.xy) * TAU / float(N);
    float exposure = readExposure();
    vec3 sum = vec3(0.0);
    float wSum = 0.0;

    for (int i = 0; i < N; i++) {
        float r = sqrt((float(i) + 0.5) / float(N));
        float theta = float(i) * GOLDEN_ANGLE + phi;
        vec2 disk = apertureShape(r * vec2(cos(theta), sin(theta)));
        vec2 o = disk * radius;
        vec2 suv = vUV + o * texel;

        float sd = texture(depthtex0, suv).r;
        float sCoc = circleOfConfusion(sd);
        float sLin = sd >= 1.0 ? far * 4.0 : linearizeDepth(sd);
        // background samples can't blur over a sharper foreground
        float effCoc = sLin > linC + 0.5 ? min(abs(sCoc), abs(cocC)) : abs(sCoc);
        float dist = length(o);
        float w = saturate(effCoc - dist + 1.0);
        w /= max(effCoc * effCoc, 1.0); // energy: larger CoC spreads light over more area

        vec3 s;
        #ifdef DOF_CHROMATIC
            s.r = texture(colortex0, vUV + o * texel * 1.012).r;
            s.g = texture(colortex0, suv).g;
            s.b = texture(colortex0, vUV + o * texel * 0.988).b;
        #else
            s = texture(colortex0, suv).rgb;
        #endif
        // accumulate in a tonemapped (exposure-relative) space: kills fireflies;
        // bright samples get extra weight so lights still open into bokeh discs
        vec3 sE = s * exposure;
        float lumE = luminance(sE);
        float highlight = 1.0 + DOF_BOKEH_HIGHLIGHTS * smoothstep(0.8, 2.5, lumE) * 1.5;
        w *= highlight;
        sum += sE / (1.0 + lumE) * w;
        wSum += w;
    }
    vec3 blurredT = wSum > 1e-5 ? sum / wSum : center * exposure / (1.0 + luminance(center) * exposure);
    vec3 blurred = blurredT / max(1.0 - luminance(blurredT), 0.02) / max(exposure, 1e-4);
    float mixAmt = smoothstep(0.5, 1.5, radius);
    outColor = vec4(sanitize(mix(center, blurred, mixAmt)), 1.0);
    #endif
}

#endif
