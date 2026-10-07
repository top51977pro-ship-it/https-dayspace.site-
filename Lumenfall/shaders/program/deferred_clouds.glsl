/*
    Lumenfall - deferred: volumetric clouds with temporal reprojection
    colortex5: rgb = in-scattered light, a = transmittance   (history, not cleared)
    colortex8: r = representative cloud distance             (history, not cleared)
    With CLOUD_TEMPORAL 2 each pixel is re-marched every 4th frame (2x2 pattern)
    and accumulated; fresh samples are always blended with the reprojected history.
*/

#include "/lib/common.glsl"

//==================================================================================//
#ifdef VERTEX_SHADER

out vec2 vUV;
flat out vec3 vLightCol;
flat out vec3 vAmbTop;
flat out vec3 vAmbBottom;

#include "/lib/atmosphere/lightData.glsl"

void main() {
    gl_Position = ftransform();
    vUV = gl_MultiTexCoord0.xy;
    LightInputs li = readLightInputs();
    vLightCol = li.lightCol;
    vAmbTop = li.ambTop;
    vAmbBottom = li.ambBottom;
}

#endif

//==================================================================================//
#ifdef FRAGMENT_SHADER

in vec2 vUV;
flat in vec3 vLightCol;
flat in vec3 vAmbTop;
flat in vec3 vAmbBottom;

uniform sampler2D depthtex0;
uniform sampler2D colortex5;
uniform sampler2D colortex8;

#include "/lib/util/noise.glsl"
#include "/lib/util/space.glsl"
#include "/lib/atmosphere/atmosphere.glsl"
#include "/lib/atmosphere/clouds.glsl"

/* RENDERTARGETS: 5,8 */
layout(location = 0) out vec4 outClouds;
layout(location = 1) out vec4 outDist;

void main() {
    #if !defined VOLUMETRIC_CLOUDS || !defined OVERWORLD
        outClouds = vec4(0.0, 0.0, 0.0, 1.0);
        outDist = vec4(1e6);
        return;
    #else
    ivec2 px = ivec2(gl_FragCoord.xy);
    float depth = texelFetch(depthtex0, px, 0).r;
    vec2 uv = vUV - taaOffset();
    vec3 viewPos = screenToView(vec3(uv, 1.0));
    vec3 dir = normalize(mat3(gbufferModelViewInverse) * viewPos);

    float maxDist = 1e7;
    if (depth < 1.0 && depth >= HAND_DEPTH) {
        maxDist = length(screenToView(vec3(uv, depth)));
    }

    // history
    float histDist = texelFetch(colortex8, px, 0).r;
    histDist = (histDist > 0.0 && histDist < 1e6) ? histDist : 4000.0;
    vec3 prevScreen = reprojectPlayer(dir * histDist);
    bool historyValid = all(greaterThan(prevScreen.xy, vec2(0.0))) && all(lessThan(prevScreen.xy, vec2(1.0)));
    vec4 history = texture(colortex5, prevScreen.xy);
    float historyDist = texture(colortex8, prevScreen.xy).r;
    // a freshly cleared buffer has zero distance: never trust it
    if (!(historyDist > 0.0) || !(history.a >= 0.0 && history.a <= 1.0) || any(isnan(history.rgb))) historyValid = false;

    bool update = true;
    #if CLOUD_TEMPORAL == 2
        int phase = frameCounter & 3;
        ivec2 pattern = ivec2(phase & 1, phase >> 1);
        update = all(equal(px & 1, pattern)) || !historyValid;
    #endif

    vec4 result;
    float resultDist;
    if (update) {
        float dither = blueNoise(gl_FragCoord.xy);
        CloudResult c = marchClouds(dir, maxDist, lightDirWorld(), vLightCol, vAmbTop, vAmbBottom, dither, CLOUD_STEPS);
        vec4 cirrus = cirrusClouds(dir, lightDirWorld(), vLightCol, vAmbTop);
        // cirrus sits above the cumulus layer
        c.scattering = c.scattering + cirrus.rgb * c.transmittance * float(maxDist > 1e6);
        c.transmittance *= mix(1.0, cirrus.a, float(maxDist > 1e6));
        vec4 fresh = vec4(c.scattering, c.transmittance);
        float blend = historyValid ? 0.45 : 1.0;
        #if CLOUD_TEMPORAL == 2
            blend = historyValid ? 0.6 : 1.0;
        #endif
        // camera motion reduces history trust
        float motion = length((prevScreen.xy - uv) * vec2(viewWidth, viewHeight));
        blend = mix(blend, 1.0, saturate(motion * 0.02));
        result = mix(history, fresh, blend);
        resultDist = c.distance;
    } else {
        result = history;
        resultDist = historyDist;
    }

    outClouds = max(sanitize(result), vec4(0.0));
    if (!(resultDist > 0.0 && resultDist < 1e7)) resultDist = 4000.0;
    outDist = vec4(resultDist, 0.0, 0.0, 1.0);
    #endif
}

#endif
