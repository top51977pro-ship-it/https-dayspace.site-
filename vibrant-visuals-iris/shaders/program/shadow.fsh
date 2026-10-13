#include "/lib/settings.glsl"
#include "/lib/common.glsl"

uniform sampler2D gtexture;

in vec2 texcoord;
in vec4 glcolor;
flat in int matID;

/* RENDERTARGETS: 0 */
layout(location = 0) out vec4 shadowColor;

void main() {
    vec4 c = texture(gtexture, texcoord) * glcolor;
    // Water still writes depth (shadowtex0) so terrain knows it is under water
    if (matID != MAT_WATER && c.a < 0.1) discard;
    shadowColor = c;
}
