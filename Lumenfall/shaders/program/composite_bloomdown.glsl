/*
    Lumenfall - bloom downsample
    Builds 7 blurred mip levels into a tile atlas (colortex7) from colortex0's mipmaps.
    The first level uses a Karis average to suppress fireflies.
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
const bool colortex0MipmapEnabled = true;

#include "/lib/post/bloomTiles.glsl"

/* RENDERTARGETS: 7 */
layout(location = 0) out vec4 outBloom;

void main() {
    #ifndef BLOOM
        outBloom = vec4(0.0);
        return;
    #else
    vec3 result = vec3(0.0);
    for (int level = 1; level <= BLOOM_LEVELS; level++) {
        vec4 rect = bloomTileRect(level);
        vec2 local = (vUV - rect.xy) / rect.zw;
        // a 2 px margin (tiles are 4 px apart) gives the upsample filter valid neighbours
        vec2 margin = 2.0 / (rect.zw * vec2(viewWidth, viewHeight));
        if (all(greaterThanEqual(local, -margin)) && all(lessThanEqual(local, 1.0 + margin))) {
            vec2 src = clamp(local, 0.0, 1.0);
            vec2 texel = exp2(float(level)) / vec2(viewWidth, viewHeight);
            float lod = float(level);
            // 13-tap filter (CoD: AW style), weights sum to 1
            vec3 a = textureLod(colortex0, src + texel * vec2(-1.0, -1.0), lod).rgb;
            vec3 b = textureLod(colortex0, src + texel * vec2( 0.0, -1.0), lod).rgb;
            vec3 c = textureLod(colortex0, src + texel * vec2( 1.0, -1.0), lod).rgb;
            vec3 d = textureLod(colortex0, src + texel * vec2(-0.5, -0.5), lod).rgb;
            vec3 e = textureLod(colortex0, src + texel * vec2( 0.5, -0.5), lod).rgb;
            vec3 f = textureLod(colortex0, src + texel * vec2(-1.0,  0.0), lod).rgb;
            vec3 g = textureLod(colortex0, src, lod).rgb;
            vec3 h = textureLod(colortex0, src + texel * vec2( 1.0,  0.0), lod).rgb;
            vec3 i = textureLod(colortex0, src + texel * vec2(-0.5,  0.5), lod).rgb;
            vec3 j = textureLod(colortex0, src + texel * vec2( 0.5,  0.5), lod).rgb;
            vec3 k = textureLod(colortex0, src + texel * vec2(-1.0,  1.0), lod).rgb;
            vec3 l = textureLod(colortex0, src + texel * vec2( 0.0,  1.0), lod).rgb;
            vec3 m = textureLod(colortex0, src + texel * vec2( 1.0,  1.0), lod).rgb;
            if (level == 1) {
                // Karis average on the brightest level to kill fireflies
                vec3 g0 = (a + b + f + g) * 0.25, g1 = (b + c + g + h) * 0.25;
                vec3 g2 = (f + g + k + l) * 0.25, g3 = (g + h + l + m) * 0.25;
                vec3 g4 = (d + e + i + j) * 0.25;
                float w0 = 1.0 / (1.0 + luminance(g0)), w1 = 1.0 / (1.0 + luminance(g1));
                float w2 = 1.0 / (1.0 + luminance(g2)), w3 = 1.0 / (1.0 + luminance(g3));
                float w4 = 1.0 / (1.0 + luminance(g4));
                result = (g0 * w0 * 0.125 + g1 * w1 * 0.125 + g2 * w2 * 0.125 + g3 * w3 * 0.125 + g4 * w4 * 0.5)
                       / (w0 * 0.125 + w1 * 0.125 + w2 * 0.125 + w3 * 0.125 + w4 * 0.5);
            } else {
                result = (d + e + i + j) * 0.125
                       + (a + b + f + g) * 0.03125 + (b + c + g + h) * 0.03125
                       + (f + g + k + l) * 0.03125 + (g + h + l + m) * 0.03125;
            }
            break;
        }
    }
    outBloom = vec4(max(result, vec3(0.0)), 1.0);
    #endif
}

#endif
