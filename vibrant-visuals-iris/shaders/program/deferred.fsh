// Deferred: runs after opaque geometry, before water/translucents.
// Fills sky pixels with the Vibrant Visuals atmosphere.

#include "/lib/settings.glsl"
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"

uniform sampler2D colortex0;
uniform sampler2D depthtex0;

in vec2 texcoord;
flat in vec3 atmLight;
flat in vec3 atmAmbient;
flat in vec3 atmZenith;
flat in vec3 atmHorizon;
flat in vec3 atmGlow;
flat in vec4 atmParams;

/*
const int colortex0Format = RGBA16F;
const int colortex1Format = RGBA16;
const int colortex2Format = RGBA16F;
const int colortex3Format = RGBA8;
const vec4 colortex0ClearColor = vec4(0.0, 0.0, 0.0, 0.0);
const vec4 colortex1ClearColor = vec4(0.5, 0.5, 0.0, 1.0);
const bool colortex2Clear = true;
*/

/* RENDERTARGETS: 0 */
layout(location = 0) out vec4 outColor;

void main() {
    vec4 color = texture(colortex0, texcoord);
    float depth = texture(depthtex0, texcoord).r;

#ifdef DIM_OVERWORLD
    if (depth >= 1.0) {
        vec3 viewDir = normalize(screenToView(texcoord, 1.0));
        vec3 dir = mat3(gbufferModelViewInverse) * viewDir;
        vec3 lightDir = normalize(mat3(gbufferModelViewInverse) * shadowLightPosition);
        vec3 sky = getSky(dir, lightDir, atmZenith, atmHorizon, atmGlow, atmParams);
        // colortex0 holds what skybasic/skytextured drew: stars, sun and moon
        color.rgb = sky + color.rgb;
        color.a = 1.0;
    }
#elif defined DIM_NETHER
    if (depth >= 1.0) color.rgb = toLinear(fogColor);
#endif

    outColor = color;
}
