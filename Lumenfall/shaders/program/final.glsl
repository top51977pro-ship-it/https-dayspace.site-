/*
    Lumenfall - final
    Contrast adaptive sharpening, lateral chromatic aberration, vignette,
    film grain, cinematic letterbox, sRGB encode + dithering.
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

#include "/lib/util/noise.glsl"

layout(location = 0) out vec4 outColor;

vec3 fetch(ivec2 p) {
    return texelFetch(colortex0, clamp(p, ivec2(0), ivec2(viewWidth, viewHeight) - 1), 0).rgb;
}

// AMD FidelityFX CAS style sharpening (re-derived)
vec3 sharpen(ivec2 px, vec3 c) {
    if (SHARPENING > 0.0) {
        vec3 n = fetch(px + ivec2(0, 1));
        vec3 s = fetch(px + ivec2(0, -1));
        vec3 e = fetch(px + ivec2(1, 0));
        vec3 w = fetch(px + ivec2(-1, 0));
        vec3 mn = min(c, min(min(n, s), min(e, w)));
        vec3 mx = max(c, max(max(n, s), max(e, w)));
        vec3 amp = sqrt(saturate(min(mn, 1.0 - mx) / max(mx, 1e-4)));
        vec3 peak = -1.0 / mix(vec3(8.0), vec3(5.0), saturate(SHARPENING));
        vec3 wgt = amp * peak;
        return saturate((c + (n + s + e + w) * wgt) / (1.0 + 4.0 * wgt));
    }
    return c;
}

void main() {
    ivec2 px = ivec2(gl_FragCoord.xy);
    vec3 color;

    if (CHROMATIC_ABERRATION > 0.0) {
        vec2 off = (vUV - 0.5) * 0.006 * CHROMATIC_ABERRATION;
        color.r = texture(colortex0, vUV + off).r;
        color.g = texelFetch(colortex0, px, 0).g;
        color.b = texture(colortex0, vUV - off).b;
    } else {
        color = texelFetch(colortex0, px, 0).rgb;
    }

    color = sharpen(px, color);

    if (VIGNETTE > 0.0) {
        vec2 d = (vUV - 0.5) * vec2(aspectRatio, 1.0);
        float r2 = dot(d, d) * 1.6;
        float v = 1.0 / sqr(1.0 + r2 * VIGNETTE * 0.6); // ~cos^4 falloff
        color *= v;
    }

    if (FILM_GRAIN > 0.0) {
        float g = hash12(gl_FragCoord.xy + fract(frameTimeCounter * 13.37) * 1000.0) - 0.5;
        float l = luminance(color);
        color += g * FILM_GRAIN * 0.12 * (1.0 - l) * sqrt(l + 0.02);
    }

    color = linearToSrgb(saturate(color));

    if (LETTERBOX > 0.0) {
        float targetAspect = LETTERBOX;
        if (aspectRatio < targetAspect) {
            float barHeight = (1.0 - aspectRatio / targetAspect) * 0.5;
            if (vUV.y < barHeight || vUV.y > 1.0 - barHeight) color = vec3(0.0);
        }
    }

    // dither to hide 8-bit banding in skies and fog
    color += (hash12(gl_FragCoord.xy + float(frameCounter % 64)) - 0.5) / 255.0;

    outColor = vec4(color, 1.0);
}

#endif
