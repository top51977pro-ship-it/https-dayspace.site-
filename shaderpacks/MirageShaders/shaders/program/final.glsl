// Final pass: sharpening, vignette, output dithering.

#include "/lib/settings.glsl"
#include "/lib/uniforms.glsl"
#include "/lib/common.glsl"
#include "/lib/transforms.glsl"

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

#ifdef MOTION_BLUR
// Camera motion blur. Returns the blur length in pixels in .w (0 = no blur applied).
vec4 motionBlur(vec3 color) {
    float depth = texture(depthtex0, texcoord).r;
    vec2 screen = vec2(viewWidth, viewHeight);
    if (depth < 0.56) return vec4(color, 0.0); // the hand moves with the camera: keep it sharp
    vec2 velocity = texcoord - reproject(texcoord, depth);

    float shutter = 0.5 * MOTION_BLUR_STRENGTH;
    #ifdef MOTION_BLUR_FPS_INDEPENDENT
    // same amount of blur at any frame rate (tuned for 60 fps)
    shutter *= clamp(0.0166 / max(frameTime, 1e-4), 0.25, 4.0);
    #endif
    velocity *= shutter;

    float lenPx = length(velocity * screen);
    if (lenPx < 0.5) return vec4(color, 0.0);
    if (lenPx > float(MOTION_BLUR_MAX_LENGTH)) {
        velocity *= float(MOTION_BLUR_MAX_LENGTH) / lenPx;
        lenPx = float(MOTION_BLUR_MAX_LENGTH);
    }

    float dither = interleavedGradientNoise(gl_FragCoord.xy);
    vec3 sum = color;
    float weight = 1.0;
    for (int i = 0; i < MOTION_BLUR_SAMPLES; i++) {
        float t = (float(i) + dither) / float(MOTION_BLUR_SAMPLES) - 0.5;
        vec2 uv = texcoord + velocity * t;
        if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) continue;
        if (texture(depthtex0, uv).r < 0.56) continue; // never smear the hand into the world
        sum += texture(colortex6, uv).rgb;
        weight += 1.0;
    }
    return vec4(sum / weight, lenPx);
}
#endif

void main() {
    vec2 px = 1.0 / vec2(viewWidth, viewHeight);
    vec3 color = texture(colortex6, texcoord).rgb;
    float blurLength = 0.0;

    #ifdef MOTION_BLUR
    vec4 blurred = motionBlur(color);
    color = blurred.rgb;
    blurLength = blurred.w;
    #endif

    #if SHARPENING > 0
    if (blurLength < 1.0) {
    vec3 n = texture(colortex6, texcoord + vec2(0.0, -px.y)).rgb;
    vec3 s = texture(colortex6, texcoord + vec2(0.0,  px.y)).rgb;
    vec3 e = texture(colortex6, texcoord + vec2( px.x, 0.0)).rgb;
    vec3 w = texture(colortex6, texcoord + vec2(-px.x, 0.0)).rgb;
    vec3 mn = min(color, min(min(n, s), min(e, w)));
    vec3 mx = max(color, max(max(n, s), max(e, w)));
    vec3 amp = sqrt(saturate(min(mn, 1.0 - mx) / max(mx, vec3(1e-4))));
    vec3 weight = amp * (-1.0 / mix(8.0, 5.0, float(SHARPENING) * 0.1));
    color = saturate((color + (n + s + e + w) * weight) / (1.0 + 4.0 * weight));
    }
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
