/*
    Lumenfall - small programs
    GB_SKY          : skybasic / skytextured (the sky is rendered procedurally in deferred)
    GB_BASIC        : lines, selection outline, leashes
    GB_DAMAGED      : block breaking cracks (multiplied into the albedo buffer)
    GB_EMISSIVE     : beacon beams, spider eyes, lightning (HDR emission into colortex0)
    GB_GLINT        : enchantment glint (additive)
*/

#include "/lib/common.glsl"

//==================================================================================//
#ifdef VERTEX_SHADER

out vec2 vTexCoord;
out vec4 vColor;

void main() {
    vTexCoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    vColor = gl_Color;
    gl_Position = ftransform();
    #if defined TAA && !defined GB_SKY
        gl_Position.xy += taaOffset() * 2.0 * gl_Position.w;
    #endif
}

#endif

//==================================================================================//
#ifdef FRAGMENT_SHADER

in vec2 vTexCoord;
in vec4 vColor;

uniform sampler2D tex;

#if defined GB_DAMAGED
    /* RENDERTARGETS: 1 */
#else
    /* RENDERTARGETS: 0 */
#endif
layout(location = 0) out vec4 outColor;

void main() {
    #if defined GB_SKY
        discard;
    #elif defined GB_BASIC
        vec4 c = vColor;
        if (c.a < 0.01) discard;
        // selection outline & lines: subtle bright line (added to the lit scene)
        outColor = vec4(srgbToLinear(c.rgb) * 0.6 + 0.04, c.a);
    #elif defined GB_DAMAGED
        vec4 c = texture(tex, vTexCoord) * vColor;
        if (c.a < 0.01) discard;
        outColor = vec4(c.rgb, 0.5);
    #elif defined GB_EMISSIVE
        vec4 c = texture(tex, vTexCoord) * vColor;
        #ifdef GB_LIGHTNING
            c = vec4(0.75, 0.82, 1.0, 1.0) * vColor.a;
        #endif
        if (c.a < 0.01) discard;
        outColor = vec4(srgbToLinear(c.rgb) * 6.0 * EMISSIVE_STRENGTH, c.a);
    #elif defined GB_GLINT
        vec4 c = texture(tex, vTexCoord) * vColor;
        outColor = vec4(srgbToLinear(c.rgb) * 0.8, c.a);
    #else
        outColor = texture(tex, vTexCoord) * vColor;
    #endif
}

#endif
