// Small programs that need little more than a textured quad:
//   PROG_SKYBASIC     - vanilla sky / stars / sunrise fan (replaced by our own sky -> discarded)
//   PROG_SKYTEXTURED  - moon texture (sun disabled in shaders.properties, drawn procedurally)
//   PROG_CLOUDS       - vanilla clouds (replaced by volumetric clouds -> discarded)
//   PROG_BASIC        - lines, leashes, block outline
//   PROG_BEACONBEAM   - beacon beams (emissive)
//   PROG_SPIDEREYES   - glowing eyes of spiders, endermen, phantoms
//   PROG_ARMOR_GLINT  - enchantment glint
//   PROG_DAMAGEDBLOCK - block breaking cracks

#include "/lib/settings.glsl"
#include "/lib/uniforms.glsl"
#include "/lib/common.glsl"
#include "/lib/transforms.glsl"

//==================================================================================//
#ifdef VSH

out vec2 texcoord;
out vec4 glcolor;

void main() {
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    glcolor = gl_Color;
    gl_Position = ftransform();
    #if !defined PROG_SKYBASIC && !defined PROG_SKYTEXTURED && !defined PROG_CLOUDS
    applyTAAJitter(gl_Position);
    #endif
}

#endif
//==================================================================================//
#ifdef FSH

in vec2 texcoord;
in vec4 glcolor;

#if defined PROG_SKYBASIC || defined PROG_CLOUDS

/* RENDERTARGETS: 0 */
layout(location = 0) out vec4 outColor;
void main() {
    discard;
}

#elif defined PROG_SKYTEXTURED

/* RENDERTARGETS: 0 */
layout(location = 0) out vec4 outColor;
void main() {
    #if !defined OVERWORLD
    discard;
    #endif
    #ifdef MC_RENDER_STAGE_SUN
    if (renderStage == MC_RENDER_STAGE_SUN) discard;
    #endif
    vec4 col = texture(gtexture, texcoord) * glcolor;
    outColor = vec4(toLinear(col.rgb) * 2.2 * col.a, col.a);
}

#elif defined PROG_DAMAGEDBLOCK || defined PROG_ARMOR_GLINT

/* RENDERTARGETS: 0 */
layout(location = 0) out vec4 outColor;
void main() {
    vec4 col = texture(gtexture, texcoord) * glcolor;
    if (col.a < 0.01) discard;
    #ifdef PROG_ARMOR_GLINT
    // entities are stored lit (linear HDR), so the glint goes on in the same space
    col.rgb = toLinear(col.rgb) * 0.8;
    #endif
    outColor = col;
}

#elif defined PROG_SPIDEREYES

/* RENDERTARGETS: 0 */
layout(location = 0) out vec4 outColor;
void main() {
    vec4 col = texture(gtexture, texcoord) * glcolor;
    if (col.a < 0.1) discard;
    outColor = vec4(toLinear(col.rgb) * 2.5, col.a); // glowing eyes on top of the lit body
}

#else // PROG_BASIC, PROG_BEACONBEAM

/* RENDERTARGETS: 0,2 */
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outMaterial;
void main() {
    vec4 col = glcolor;
    #ifdef PROG_BEACONBEAM
    col *= texture(gtexture, texcoord);
    #endif
    if (col.a < 0.01) discard;
    vec3 lin = toLinear(col.rgb);
    #ifdef PROG_BEACONBEAM
    lin *= 4.0;
    #else
    lin *= 0.6;
    #endif
    outColor = vec4(lin, col.a);
    outMaterial = vec4(encodeMat(MAT_PASSTHROUGH), 0.0, 0.0, 0.0);
}

#endif

#endif
