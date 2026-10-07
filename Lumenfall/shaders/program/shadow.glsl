/*
    Lumenfall - shadow map
    shadowcolor0: translucent tint (stained glass etc.)
    shadowcolor1: r = water flag (used for caustics and underwater light absorption)
*/

#include "/lib/common.glsl"

//==================================================================================//
#ifdef VERTEX_SHADER

in vec4 mc_Entity;
in vec2 mc_midTexCoord;

out vec2 vTexCoord;
out vec4 vColor;
flat out int vBlockId;

#include "/lib/util/space.glsl"

vec3 windOffsetShadow(vec3 wp, float amount) {
    float t = frameTimeCounter * WAVING_SPEED;
    float gust = sin(t * 0.35 + wp.x * 0.025 + wp.z * 0.01) * 0.5 + 0.5;
    gust = gust * gust;
    float strength = (0.35 + gust * 0.65) * (1.0 + lf_rain * 1.2) * WAVING_STRENGTH;
    vec3 o;
    o.x = sin(t * 1.9 + wp.x * 0.6 + wp.z * 0.35) * 0.045 + sin(t * 3.7 + wp.z * 1.3) * 0.015;
    o.z = sin(t * 1.6 + wp.z * 0.55 - wp.x * 0.25) * 0.035 + cos(t * 4.1 + wp.x * 1.1) * 0.012;
    o.y = sin(t * 2.3 + wp.x + wp.z) * 0.01;
    o.xz += vec2(0.06, 0.025) * gust;
    return o * strength * amount;
}

void main() {
    vTexCoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    vColor = gl_Color;
    vBlockId = int(mc_Entity.x + 0.5);

    vec4 shadowView = gl_ModelViewMatrix * gl_Vertex;

    #ifdef WAVING_PLANTS
        if (vBlockId >= 10001 && vBlockId <= 10005) {
            vec3 playerPos = (shadowModelViewInverse * shadowView).xyz;
            vec3 wp = playerPos + cameraPosition;
            bool topVertex = vTexCoord.y < mc_midTexCoord.y;
            float amount = 0.0;
            if (vBlockId == 10001) amount = 0.55;
            else if (vBlockId == 10002) amount = topVertex ? 1.0 : 0.0;
            else if (vBlockId == 10003) amount = topVertex ? 0.6 : 0.0;
            else if (vBlockId == 10004) amount = topVertex ? 1.4 : 0.6;
            else if (vBlockId == 10005) amount = 0.4;
            playerPos += windOffsetShadow(wp, amount);
            shadowView = shadowModelView * vec4(playerPos, 1.0);
        }
    #endif

    gl_Position = gl_ProjectionMatrix * shadowView;
    gl_Position.xyz = distortShadow(gl_Position.xyz);
}

#endif

//==================================================================================//
#ifdef FRAGMENT_SHADER

in vec2 vTexCoord;
in vec4 vColor;
flat in int vBlockId;

uniform sampler2D tex;

/* RENDERTARGETS: 0,1 */
layout(location = 0) out vec4 outTint;
layout(location = 1) out vec4 outFlags;

void main() {
    vec4 albedo = texture(tex, vTexCoord) * vColor;
    bool water = vBlockId == 10010;
    if (!water && albedo.a < 0.1) discard;
    outTint = water ? vec4(1.0, 1.0, 1.0, 0.0) : albedo;
    outFlags = vec4(water ? 1.0 : 0.0, 0.0, 0.0, 1.0);
}

#endif
