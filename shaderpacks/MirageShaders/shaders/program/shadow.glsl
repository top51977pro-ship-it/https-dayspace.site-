// Shadow map pass. Writes depth plus a colour tint for translucent casters
// (stained glass tint, water tint with animated caustics).

#include "/lib/settings.glsl"
#include "/lib/uniforms.glsl"
#include "/lib/common.glsl"
#define SHADOW_PASS
#include "/lib/shadows.glsl"

//==================================================================================//
#ifdef VSH

in vec4 mc_Entity;
in vec4 mc_midTexCoord;

out vec2 texcoord;
out vec4 glcolor;
out vec3 worldPos;
flat out int blockId;

#include "/lib/waving.glsl"

void main() {
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    glcolor = gl_Color;
    blockId = int(mc_Entity.x + 0.5);

    vec2 lm = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
    lm = saturate((lm - 1.0 / 32.0) * 16.0 / 15.0);

    vec3 shadowView = (gl_ModelViewMatrix * gl_Vertex).xyz;
    vec3 playerPos = (shadowModelViewInverse * vec4(shadowView, 1.0)).xyz;
    bool isTop = texcoord.y < mc_midTexCoord.y;
    playerPos = applyWaving(playerPos, blockId, isTop, lm.y);
    worldPos = playerPos + cameraPosition;

    gl_Position = gl_ProjectionMatrix * (shadowModelView * vec4(playerPos, 1.0));
    gl_Position.xyz = distortShadowPos(gl_Position.xyz);
}

#endif
//==================================================================================//
#ifdef FSH

in vec2 texcoord;
in vec4 glcolor;
in vec3 worldPos;
flat in int blockId;

#include "/lib/water.glsl"

/* RENDERTARGETS: 0 */
layout(location = 0) out vec4 outShadowColor;

void main() {
    if (blockId == ID_WATER) {
        vec3 tint = vec3(0.90, 0.96, 0.94);
        #ifdef WATER_CAUSTICS
        tint *= getCaustics(worldPos);
        #endif
        outShadowColor = vec4(tint, 1.0);
        return;
    }

    vec4 albedo = texture(gtexture, texcoord) * glcolor;
    if (albedo.a < 0.1) discard;

    // tint for translucent casters; opaque casters are fully handled by shadowtex1
    vec3 tint = mix(vec3(1.0), albedo.rgb, saturate(albedo.a * 1.4));
    outShadowColor = vec4(tint * (1.0 - albedo.a * 0.35), 1.0);
}

#endif
