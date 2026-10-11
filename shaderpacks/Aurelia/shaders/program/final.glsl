// Final pass: sharpening, vignette, output dithering.

#include "/lib/settings.glsl"
#include "/lib/uniforms.glsl"
#include "/lib/common.glsl"

/*
const int colortex0Format = RGBA16F;
const int colortex1Format = RGBA16;
const int colortex2Format = RGBA8;
const int colortex3Format = RGBA16F;
const int colortex5Format = RGBA16;
const int colortex6Format = RGBA16;
const int shadowcolor0Format = RGBA16F;

const bool colortex6Clear = false;

const vec4 colortex0ClearColor = vec4(0.0, 0.0, 0.0, 0.0);
const vec4 colortex1ClearColor = vec4(0.5, 0.5, 0.0, 1.0);
const vec4 colortex2ClearColor = vec4(0.0, 0.0, 0.0, 0.0);
const vec4 colortex3ClearColor = vec4(0.0, 0.0, 0.0, 0.0);
const vec4 shadowcolor0ClearColor = vec4(1.0, 1.0, 1.0, 1.0);

const int noiseTextureResolution = 256;
*/

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

layout(location = 0) out vec4 fragColor;

void main() {
    vec2 px = 1.0 / vec2(viewWidth, viewHeight);
    vec3 color = texture(colortex6, texcoord).rgb;

    #if SHARPENING > 0
    vec3 n = texture(colortex6, texcoord + vec2(0.0, -px.y)).rgb;
    vec3 s = texture(colortex6, texcoord + vec2(0.0,  px.y)).rgb;
    vec3 e = texture(colortex6, texcoord + vec2( px.x, 0.0)).rgb;
    vec3 w = texture(colortex6, texcoord + vec2(-px.x, 0.0)).rgb;
    vec3 mn = min(color, min(min(n, s), min(e, w)));
    vec3 mx = max(color, max(max(n, s), max(e, w)));
    vec3 amp = sqrt(saturate(min(mn, 1.0 - mx) / max(mx, vec3(1e-4))));
    vec3 weight = amp * (-1.0 / mix(8.0, 5.0, float(SHARPENING) * 0.1));
    color = saturate((color + (n + s + e + w) * weight) / (1.0 + 4.0 * weight));
    #endif

    #ifdef VIGNETTE
    vec2 centered = texcoord - 0.5;
    centered.x *= aspectRatio * 0.75;
    float vignette = 1.0 - pow(length(centered) * 1.35, 2.6) * 0.42 * VIGNETTE_STRENGTH;
    color *= saturate(vignette);
    #endif

    color += (interleavedGradientNoise(gl_FragCoord.xy) - 0.5) / 255.0;
    fragColor = vec4(color, 1.0);
}

#endif
