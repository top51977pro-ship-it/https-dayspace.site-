#include "/lib/settings.glsl"
#include "/lib/common.glsl"
#include "/lib/shadows.glsl"
#include "/lib/waving.glsl"

uniform mat4 shadowModelViewInverse;

in vec4 mc_Entity;
in vec2 mc_midTexCoord;

out vec2 texcoord;
out vec4 glcolor;
flat out int matID;

void main() {
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    glcolor  = gl_Color;
    matID = mc_Entity.x > 9999.5 ? int(mc_Entity.x - 10000.0 + 0.5) : MAT_NONE;

    vec4 sv = gl_ModelViewMatrix * gl_Vertex;

#ifdef WAVING_PLANTS
    if (matID == MAT_PLANT || matID == MAT_PLANT_TALL || matID == MAT_LEAVES) {
        vec3 playerPos = (shadowModelViewInverse * sv).xyz;
        vec2 lm = remapLightmap((gl_TextureMatrix[1] * gl_MultiTexCoord1).xy);
        bool top = gl_MultiTexCoord0.t < mc_midTexCoord.t;
        playerPos += wavingOffset(playerPos + cameraPosition, matID, top, lm.y);
        sv = shadowModelView * vec4(playerPos, 1.0);
    }
#endif

    vec4 clip = gl_ProjectionMatrix * sv;
    clip.xyz = distortShadow(clip.xyz);
    gl_Position = clip;
}
