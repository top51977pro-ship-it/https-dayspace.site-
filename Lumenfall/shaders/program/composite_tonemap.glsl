/*
    Lumenfall - bloom upsample, lens flare, auto exposure, grading & tone mapping
    Writes the display-referred (linear 0..1) image to colortex0 and the
    adapted exposure to colortex9 (texel 4,0).
*/

#include "/lib/common.glsl"

//==================================================================================//
#ifdef VERTEX_SHADER

out vec2 vUV;
flat out float vExposure;
flat out vec3 vSunScreen;   // xy = screen pos of the light, z = visibility

uniform sampler2D colortex0;
uniform sampler2D colortex5;
uniform sampler2D depthtex0;
const bool colortex0MipmapEnabled = true;

#include "/lib/atmosphere/lightData.glsl"
#include "/lib/util/space.glsl"

float computeExposure() {
    float prevExposure = readExposure();
    #ifdef AUTO_EXPOSURE
        // centre-weighted log-average luminance from a low mip
        float sumLog = 0.0, wSum = 0.0;
        for (int y = 0; y < 7; y++)
        for (int x = 0; x < 7; x++) {
            vec2 p = (vec2(x, y) + 0.5) / 7.0;
            // centre weighted, the lower half (ground) counts more than the sky
            float w = exp(-dot(p - 0.5, p - 0.5) * 4.0) * (p.y < 0.55 ? 1.0 : 0.45);
            float l = luminance(textureLod(colortex0, p, 6.0).rgb);
            sumLog += log2(max(l, 1e-5)) * w;
            wSum += w;
        }
        float avgLum = exp2(sumLog / wSum);
        // keep some of the time-of-day mood: don't fully normalise night or caves
        // full adaptation in daylight, partial in the dark so nights and caves stay moody
        float l = clamp(avgLum, 0.0005, 8.0);
        float target = l > 0.3 ? 0.2 / l : 0.2 / (pow(l, 0.72) * pow(0.3, 0.28));
        float speed = 1.0 - exp(-lf_frameTimeSmooth * AE_SPEED * (target > prevExposure ? 1.2 : 2.4));
        float e = mix(prevExposure, target, speed);
        if (!(e > 0.0 && e < 1e4)) e = target;
        return e * exp2(EXPOSURE);
    #else
        #ifdef OVERWORLD
            float day = dayFactor();
            return mix(14.0, 0.55, day) * mix(1.0, 2.5, lf_caveFactor) * exp2(EXPOSURE);
        #else
            return 3.0 * exp2(EXPOSURE);
        #endif
    #endif
}

void main() {
    gl_Position = ftransform();
    vUV = gl_MultiTexCoord0.xy;
    vExposure = computeExposure();

    vSunScreen = vec3(0.0);
    #if defined LENS_FLARE && defined OVERWORLD
        vec3 sunView = normalize(shadowLightPosition);
        if (sunView.z < 0.0) {
            vec3 sp = viewToScreen(sunView * 100.0);
            if (all(greaterThan(sp.xy, vec2(-0.1))) && all(lessThan(sp.xy, vec2(1.1)))) {
                float vis = 0.0;
                for (int y = -2; y <= 2; y++)
                for (int x = -2; x <= 2; x++) {
                    vec2 p = sp.xy + vec2(x, y) * 0.004;
                    float onScreen = float(all(greaterThan(p, vec2(0.0))) && all(lessThan(p, vec2(1.0))));
                    float sky = float(texture(depthtex0, p).r >= 1.0);
                    float cloudT = texture(colortex5, p).a;
                    vis += onScreen * sky * cloudT;
                }
                vis /= 25.0;
                float isSun = float(dot(sunPosition, shadowLightPosition) > 0.0);
                vSunScreen = vec3(sp.xy, vis * (1.0 - lf_rain) * mix(0.15, 1.0, isSun));
            }
        }
    #endif
}

#endif

//==================================================================================//
#ifdef FRAGMENT_SHADER

in vec2 vUV;
flat in float vExposure;
flat in vec3 vSunScreen;

uniform sampler2D colortex0;
uniform sampler2D colortex7;
const bool colortex0MipmapEnabled = true;

#include "/lib/atmosphere/lightData.glsl"
#include "/lib/lighting/brdf.glsl"
#include "/lib/post/bloomTiles.glsl"
#include "/lib/post/tonemap.glsl"

/* RENDERTARGETS: 0,9 */
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outData;

vec3 sampleBloomTile(int level, vec2 uv) {
    vec4 rect = bloomTileRect(level);
    vec2 texel = 1.0 / vec2(viewWidth, viewHeight);
    vec2 p = rect.xy + clamp(uv, 0.0, 1.0) * rect.zw;
    p = clamp(p, rect.xy + texel, rect.xy + rect.zw - texel);
    // 4-tap bilinear tent for smooth upsampling
    vec2 o = texel * 0.75;
    return (texture(colortex7, p + vec2(-o.x, -o.y)).rgb + texture(colortex7, p + vec2(o.x, -o.y)).rgb
          + texture(colortex7, p + vec2(-o.x, o.y)).rgb + texture(colortex7, p + vec2(o.x, o.y)).rgb) * 0.25;
}

vec3 lensFlare(vec2 uv) {
    vec3 col = vec3(0.0);
    #if defined LENS_FLARE && defined OVERWORLD
        if (vSunScreen.z < 0.001) return col;
        vec2 sun = vSunScreen.xy;
        vec2 toCenter = vec2(0.5) - sun;
        vec2 aspect = vec2(aspectRatio, 1.0);
        vec3 lightCol = normalize(readLightData(LD_LIGHT).rgb + 1e-4);
        // ghosts along the optical axis
        const int ghosts = 6;
        float scales[6] = float[6](0.35, 0.62, 0.9, 1.25, 1.55, 1.9);
        float sizes[6]  = float[6](0.05, 0.025, 0.08, 0.04, 0.12, 0.03);
        vec3 tints[6] = vec3[6](vec3(1.0, 0.6, 0.3), vec3(0.4, 1.0, 0.6), vec3(0.4, 0.6, 1.0),
                                vec3(1.0, 0.4, 0.8), vec3(0.6, 0.8, 1.0), vec3(1.0, 0.9, 0.5));
        for (int i = 0; i < ghosts; i++) {
            vec2 gp = sun + toCenter * scales[i] * 2.0;
            float d = length((uv - gp) * aspect);
            float ring = smoothstep(sizes[i], sizes[i] * 0.85, d) * (0.4 + 0.6 * smoothstep(0.0, sizes[i], d));
            col += tints[i] * ring * 0.035;
        }
        // halo ring around the centre
        float dc = length((uv - sun - toCenter * 2.0) * aspect);
        col += vec3(0.5, 0.7, 1.0) * smoothstep(0.02, 0.0, abs(dc - 0.45)) * 0.02;
        // soft glare around the light
        float ds = length((uv - sun) * aspect);
        col += exp(-ds * 9.0) * 0.12;
        col *= lightCol * vSunScreen.z * LENS_FLARE_STRENGTH;
    #endif
    return col;
}

void main() {
    ivec2 px = ivec2(gl_FragCoord.xy);
    vec3 color = texelFetch(colortex0, px, 0).rgb;

    #ifdef BLOOM
        vec3 bloom = vec3(0.0);
        float wSum = 0.0;
        for (int i = 1; i <= BLOOM_LEVELS; i++) {
            float w = pow(BLOOM_RADIUS, float(i - 1)) * (i == 1 ? 0.6 : 1.0);
            bloom += sampleBloomTile(i, vUV) * w;
            wSum += w;
        }
        bloom /= wSum;
        float bloomAmount = BLOOM_STRENGTH * (1.0 + lf_rain * 0.8 + float(isEyeInWater == 1) * 1.5);
        color = mix(color, bloom, bloomAmount);

        if (ANAMORPHIC_STREAKS > 0.0) {
            vec3 streak = vec3(0.0);
            for (int k = -6; k <= 6; k++) {
                float o = float(k) * 0.035;
                streak += sampleBloomTile(3, vUV + vec2(o, 0.0)) * exp(-abs(float(k)) * 0.35);
            }
            color += streak * vec3(0.45, 0.65, 1.0) * 0.02 * ANAMORPHIC_STREAKS;
        }
    #endif

    color += lensFlare(vUV) * readLightData(LD_LIGHT).rgb * 0.02;

    // exposure & grading
    color *= vExposure;
    color = purkinje(color);
    color = colorGrade(color);
    color = applyTonemap(color);

    outColor = vec4(sanitize(color), 1.0);

    // per-frame data passthrough (+ new exposure)
    if (px.y == 0 && px.x < LD_COUNT) {
        outData = px.x == LD_EXPOSURE ? vec4(vExposure / exp2(EXPOSURE), 0.0, 0.0, 1.0) : texelFetch(colortex9, px, 0);
    } else {
        outData = vec4(0.0);
    }
}

#endif
