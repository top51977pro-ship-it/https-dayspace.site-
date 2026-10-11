// Composite 2: temporal anti-aliasing (or FXAA when TAA is off) -> colortex6 (also TAA history).

#include "/lib/settings.glsl"
#include "/lib/uniforms.glsl"
#include "/lib/common.glsl"
#include "/lib/transforms.glsl"

//==================================================================================//
#ifdef VSH

out vec2 texcoord;

void main() {
    texcoord = gl_MultiTexCoord0.xy;
    gl_Position = ftransform();
}

#endif
//==================================================================================//
#ifdef FSH

in vec2 texcoord;

/* RENDERTARGETS: 6 */
layout(location = 0) out vec4 outColor;

#ifdef TAA
vec3 textureCatmullRom(sampler2D tex, vec2 uv, vec2 texSize) {
    vec2 samplePos = uv * texSize;
    vec2 texPos1 = floor(samplePos - 0.5) + 0.5;
    vec2 f = samplePos - texPos1;
    vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
    vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
    vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
    vec2 w3 = f * f * (-0.5 + 0.5 * f);
    vec2 w12 = w1 + w2;
    vec2 texPos0 = (texPos1 - 1.0) / texSize;
    vec2 texPos3 = (texPos1 + 2.0) / texSize;
    vec2 texPos12 = (texPos1 + w2 / w12) / texSize;

    vec3 result = texture(tex, vec2(texPos12.x, texPos0.y)).rgb * (w12.x * w0.y)
                + texture(tex, vec2(texPos0.x, texPos12.y)).rgb * (w0.x * w12.y)
                + texture(tex, texPos12).rgb * (w12.x * w12.y)
                + texture(tex, vec2(texPos3.x, texPos12.y)).rgb * (w3.x * w12.y)
                + texture(tex, vec2(texPos12.x, texPos3.y)).rgb * (w12.x * w3.y);
    float weight = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
    return max(result / weight, vec3(0.0));
}

vec2 reproject(vec2 uv, float depth) {
    if (depth < 0.56) return uv; // hand moves with the camera
    vec3 viewPos = screenToView(uv, depth);
    vec3 playerPos = viewToPlayer(viewPos);
    vec3 prevPlayer = playerPos + cameraPosition - previousCameraPosition;
    if (depth >= 1.0) prevPlayer = playerPos; // sky only rotates
    vec4 prevClip = gbufferPreviousProjection * (gbufferPreviousModelView * vec4(prevPlayer, 1.0));
    return prevClip.xy / prevClip.w * 0.5 + 0.5;
}
#else
// compact FXAA
vec3 fxaa(vec2 uv) {
    vec2 px = 1.0 / vec2(viewWidth, viewHeight);
    vec3 rgbM = texture(colortex5, uv).rgb;
    vec3 rgbNW = texture(colortex5, uv + vec2(-1.0, -1.0) * px).rgb;
    vec3 rgbNE = texture(colortex5, uv + vec2( 1.0, -1.0) * px).rgb;
    vec3 rgbSW = texture(colortex5, uv + vec2(-1.0,  1.0) * px).rgb;
    vec3 rgbSE = texture(colortex5, uv + vec2( 1.0,  1.0) * px).rgb;
    float lM = luminance(rgbM), lNW = luminance(rgbNW), lNE = luminance(rgbNE), lSW = luminance(rgbSW), lSE = luminance(rgbSE);
    float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
    float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
    vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
    float reduce = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
    float rcpMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + reduce);
    dir = clamp(dir * rcpMin, vec2(-8.0), vec2(8.0)) * px;
    vec3 a = 0.5 * (texture(colortex5, uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture(colortex5, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
    vec3 b = a * 0.5 + 0.25 * (texture(colortex5, uv - dir * 0.5).rgb + texture(colortex5, uv + dir * 0.5).rgb);
    float lB = luminance(b);
    return (lB < lMin || lB > lMax) ? a : b;
}
#endif

void main() {
    #ifdef TAA
    vec2 px = 1.0 / vec2(viewWidth, viewHeight);
    vec3 current = texture(colortex5, texcoord).rgb;

    vec3 minCol = current;
    vec3 maxCol = current;
    float closestDepth = texture(depthtex0, texcoord).r;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            if (x == 0 && y == 0) continue;
            vec2 o = vec2(x, y) * px;
            vec3 s = texture(colortex5, texcoord + o).rgb;
            minCol = min(minCol, s);
            maxCol = max(maxCol, s);
            closestDepth = min(closestDepth, texture(depthtex0, texcoord + o).r);
        }
    }

    vec2 prevUV = reproject(texcoord, closestDepth);
    vec3 history = textureCatmullRom(colortex6, prevUV, vec2(viewWidth, viewHeight));
    history = clamp(history, minCol, maxCol);

    vec2 velocity = (texcoord - prevUV) * vec2(viewWidth, viewHeight);
    float blend = 0.9 - saturate(length(velocity) * 0.015) * 0.25;
    if (any(lessThan(prevUV, vec2(0.0))) || any(greaterThan(prevUV, vec2(1.0)))) blend = 0.0;

    outColor = vec4(mix(current, history, blend), 1.0);
    #else
    outColor = vec4(fxaa(texcoord), 1.0);
    #endif
}

#endif
