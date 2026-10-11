// Composite 1: bloom, exposure, tonemapping and colour grading -> colortex5 (display space).

#include "/lib/settings.glsl"
#include "/lib/uniforms.glsl"
#include "/lib/common.glsl"

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

void main() {
    setupAtmosphere();
    vec3 color = texture(colortex0, texcoord).rgb;

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
    color = mix(color, bloom, bloomAmount);
    #endif

    // eye-adaptation-like exposure from eye brightness (caves and nights get brighter)
    #if defined OVERWORLD
    float exposure = mix(2.4, 1.0, eyeSky) * mix(1.0, 1.4, eyeSky * (1.0 - dayF));
    #elif defined NETHER
    float exposure = 1.6;
    #else
    float exposure = 1.5;
    #endif
    color *= exposure * EXPOSURE;

    color = tonemapLottes(color);
    color = toGamma(color);
    color = colorGrade(color);

    outColor = vec4(color, 1.0);
}

#endif
