// Final: bloom, exposure, Vibrant Visuals colour grading and tone mapping

#include "/lib/settings.glsl"
#include "/lib/common.glsl"
#include "/lib/tonemap.glsl"

uniform sampler2D colortex0;

in vec2 texcoord;

/*
const bool colortex0MipmapEnabled = true;
*/

layout(location = 0) out vec4 fragColor;

vec3 bloomTap(float lod) {
    vec2 px = exp2(lod) / vec2(viewWidth, viewHeight);
    vec3 b = textureLod(colortex0, texcoord + vec2( 0.5,  0.5) * px, lod).rgb;
    b     += textureLod(colortex0, texcoord + vec2(-0.5,  0.5) * px, lod).rgb;
    b     += textureLod(colortex0, texcoord + vec2( 0.5, -0.5) * px, lod).rgb;
    b     += textureLod(colortex0, texcoord + vec2(-0.5, -0.5) * px, lod).rgb;
    return b * 0.25;
}

void main() {
    vec3 color = texture(colortex0, texcoord).rgb;

#ifdef BLOOM
    vec3 bloom = bloomTap(2.0) * 0.30 + bloomTap(3.0) * 0.25 + bloomTap(4.0) * 0.20
               + bloomTap(5.0) * 0.15 + bloomTap(6.0) * 0.10;
    color = mix(color, bloom, 0.045 * BLOOM_STRENGTH);
    // Extra glow only from very bright pixels (sun, glints, lava)
    color += max(bloom - 1.5, 0.0) * 0.06 * BLOOM_STRENGTH;
#endif

    float exposure = EXPOSURE;
#ifdef AUTO_EXPOSURE
    // Eye adaptation driven by how much sky the player can see
    float eyeSky = eyeBrightnessSmooth.y / 240.0;
    float eyeBlock = eyeBrightnessSmooth.x / 240.0;
    #ifdef DIM_OVERWORLD
        float day = smoothstep(-0.2, 0.1, dot(normalize(sunPosition), normalize(upPosition)));
        // Darker at night and in caves -> open up the exposure
        exposure *= mix(2.6, 1.0, day * eyeSky);
        // Pitch dark caves without torches get a little extra
        exposure *= mix(1.0 + (1.0 - eyeBlock) * 0.6, 1.0, eyeSky);
    #else
        exposure *= 1.4;
    #endif
#endif
    color *= exposure;

    color = colorGrade(color);
    color = tonemapGeneric(color);
    color = pow(color, vec3(1.0 / 2.2));

    // Dither to avoid banding in the sky
    color += (bayer16(gl_FragCoord.xy) - 0.5) / 255.0;

    fragColor = vec4(color, 1.0);
}
