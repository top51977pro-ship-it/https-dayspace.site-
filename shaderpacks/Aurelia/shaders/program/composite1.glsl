// Composite 1: bloom, exposure, tonemapping and colour grading -> colortex5 (display space).

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

#include "/lib/atmosphere.glsl"
#include "/lib/tonemap.glsl"

const bool colortex0MipmapEnabled = true;

/* RENDERTARGETS: 5 */
layout(location = 0) out vec4 outColor;

vec3 bloomTile(float lod) {
    vec2 texel = exp2(lod) / vec2(viewWidth, viewHeight);
    vec3 sum = vec3(0.0);
    float weightSum = 0.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            float w = (x == 0 ? 2.0 : 1.0) * (y == 0 ? 2.0 : 1.0);
            sum += textureLod(colortex0, texcoord + vec2(x, y) * texel, lod).rgb * w;
            weightSum += w;
        }
    }
    return sum / weightSum;
}

#if defined SUNBEAMS && !defined NETHER
// Crepuscular rays: march from each pixel towards the sun on screen and count open sky.
// Trees, terrain and the player block the sky and leave dark streaks between bright rays.
vec3 getSunbeams(float dither) {
    if (isEyeInWater != 0) return vec3(0.0);
    vec3 lightView = shadowLightPosition;
    float facing = dot(normalize(lightView), vec3(0.0, 0.0, -1.0));
    if (facing <= 0.0) return vec3(0.0);

    vec2 lightUV = viewToScreen(lightView).xy;
    vec2 delta = lightUV - texcoord;
    const int samples = 24;
    vec2 stepUV = delta / float(samples);
    vec2 p = texcoord + stepUV * dither;
    float open = 0.0;
    for (int i = 0; i < samples; i++) {
        vec2 q = clamp(p, vec2(0.0), vec2(1.0));
        open += step(1.0, texture(depthtex0, q).r);
        p += stepUV;
    }
    open /= float(samples);

    float r = length(delta * vec2(aspectRatio, 1.0));
    float falloff = exp(-r * 2.4) * 0.8 + exp(-r * 7.0) * 0.6;

    #if defined END
    float amount = 0.18;
    #else
    float amount = mix(0.30, 0.13, noonF) * (1.0 - rainStrength) * mix(0.4, 1.0, eyeSky);
    #endif
    return lightColor * open * falloff * smoothstep(0.0, 0.35, facing) * amount * SUNBEAM_STRENGTH;
}
#endif

void main() {
    setupAtmosphere();
    vec3 color = texture(colortex0, texcoord).rgb;

    #if defined SUNBEAMS && !defined NETHER
    color += getSunbeams(getDither(gl_FragCoord.xy));
    #endif

    #ifdef BLOOM
    vec3 bloom = vec3(0.0);
    float weightSum = 0.0;
    for (int i = 1; i <= 7; i++) {
        float w = pow(1.25, float(i));
        bloom += bloomTile(float(i)) * w;
        weightSum += w;
    }
    bloom /= weightSum;
    float bloomAmount = 0.055 * BLOOM_STRENGTH;
    if (isEyeInWater == 1) bloomAmount *= 2.5;
    #if defined NETHER || defined END
    bloomAmount *= 1.25;
    #endif
    color = mix(color, bloom, bloomAmount);
    #endif

    // eye-adaptation-like exposure from eye brightness (caves and nights get brighter)
    #if defined OVERWORLD
    float exposure = mix(1.7, 1.0, eyeSky) * mix(1.0, 1.4, eyeSky * (1.0 - dayF));
    #elif defined NETHER
    float exposure = 1.2;
    #else
    float exposure = 1.3;
    #endif
    color *= exposure * EXPOSURE;

    color = tonemapLottes(color);
    color = toGamma(color);
    color = colorGrade(color);

    outColor = vec4(color, 1.0);
}

#endif
