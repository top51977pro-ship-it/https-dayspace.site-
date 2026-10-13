// Fullscreen pass vertex shader (deferred / composite / final)

#include "/lib/settings.glsl"
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"

out vec2 texcoord;

flat out vec3 atmLight;
flat out vec3 atmAmbient;
flat out vec3 atmZenith;
flat out vec3 atmHorizon;
flat out vec3 atmGlow;
flat out vec4 atmParams;

void main() {
    gl_Position = ftransform();
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;

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
