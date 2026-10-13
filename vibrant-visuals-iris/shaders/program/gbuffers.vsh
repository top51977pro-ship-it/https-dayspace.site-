// Shared vertex shader for every gbuffers program.
// The including stub defines DIM_* and PROG_*.

#include "/lib/settings.glsl"
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"

out vec2 texcoord;
out vec2 lmcoord;
out vec4 glcolor;
out vec3 viewPos;
out vec3 playerPos;
out vec3 viewNormal;
flat out int matID;

flat out vec3 atmLight;
flat out vec3 atmAmbient;
flat out vec3 atmZenith;
flat out vec3 atmHorizon;
flat out vec3 atmGlow;
flat out vec4 atmParams;

#if defined PROG_TERRAIN || defined PROG_WATER
in vec4 mc_Entity;
in vec2 mc_midTexCoord;
#endif

#ifdef PROG_TERRAIN
#include "/lib/waving.glsl"
#endif

void main() {
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    lmcoord  = remapLightmap((gl_TextureMatrix[1] * gl_MultiTexCoord1).xy);
    glcolor  = gl_Color;

    matID = MAT_NONE;
#if defined PROG_TERRAIN || defined PROG_WATER
    if (mc_Entity.x > 9999.5) matID = int(mc_Entity.x - 10000.0 + 0.5);
#endif

    vec4 vp = gl_ModelViewMatrix * gl_Vertex;
    playerPos = (gbufferModelViewInverse * vp).xyz;

#if defined PROG_TERRAIN && defined WAVING_PLANTS && !defined DIM_END
    if (matID == MAT_PLANT || matID == MAT_PLANT_TALL || matID == MAT_LEAVES) {
        bool top = gl_MultiTexCoord0.t < mc_midTexCoord.t;
        playerPos += wavingOffset(playerPos + cameraPosition, matID, top, lmcoord.y);
        vp = gbufferModelView * vec4(playerPos, 1.0);
    }
#endif

    viewPos = vp.xyz;
    viewNormal = normalize(gl_NormalMatrix * gl_Normal);
    gl_Position = gl_ProjectionMatrix * vp;

#ifndef NO_SKY
    Atmosphere a = computeAtmosphere();
    atmLight   = a.light;
    atmAmbient = a.ambient;
    atmZenith  = a.zenith;
    atmHorizon = a.horizon;
    atmGlow    = a.glow;
    atmParams  = a.params;
#else
    atmLight = vec3(0.0); atmAmbient = vec3(0.0); atmZenith = vec3(0.0);
    atmHorizon = vec3(0.0); atmGlow = vec3(0.0); atmParams = vec4(0.0);
#endif
}
