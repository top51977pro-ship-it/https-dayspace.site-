/*
    Lumenfall - deferred lighting
    Sky + clouds for background pixels, full PBR shading (PCSS shadows, SSS, GTAO,
    sky ambient, block light, emission) for opaque G-buffer pixels.
*/

#include "/lib/common.glsl"

//==================================================================================//
#ifdef VERTEX_SHADER

out vec2 vUV;
flat out vec3 vLightCol;
flat out vec3 vAmbTop;
flat out vec3 vAmbBottom;
flat out float vLightRadius;

#include "/lib/atmosphere/lightData.glsl"
#include "/lib/util/noise.glsl"
#include "/lib/atmosphere/dimensions.glsl"

void main() {
    gl_Position = ftransform();
    vUV = gl_MultiTexCoord0.xy;
    LightInputs li = readLightInputs();
    vLightCol = li.lightCol;
    vAmbTop = li.ambTop;
    vAmbBottom = li.ambBottom;
    vLightRadius = li.lightRadius;
    #ifdef NETHER
        vLightCol = vec3(0.0);
        vAmbTop = netherAmbient();
        vAmbBottom = vAmbTop;
    #endif
    #ifdef END
        vLightCol = endLightColor();
        vAmbTop = endAmbient();
        vAmbBottom = endAmbient() * 0.6;
    #endif
}

#endif

//==================================================================================//
#ifdef FRAGMENT_SHADER

in vec2 vUV;
flat in vec3 vLightCol;
flat in vec3 vAmbTop;
flat in vec3 vAmbBottom;
flat in float vLightRadius;

uniform sampler2D colortex0;
uniform sampler2D colortex1;
uniform sampler2D colortex2;
uniform sampler2D colortex3;
uniform sampler2D colortex5;
uniform sampler2D colortex8;
uniform sampler2D depthtex0;

#include "/lib/util/encoding.glsl"
#include "/lib/util/noise.glsl"
#include "/lib/util/space.glsl"
#include "/lib/water/waves.glsl"
#include "/lib/atmosphere/atmosphere.glsl"
#include "/lib/atmosphere/skyObjects.glsl"
#include "/lib/atmosphere/dimensions.glsl"
#include "/lib/atmosphere/sky.glsl"
#include "/lib/atmosphere/clouds.glsl"
#include "/lib/lighting/brdf.glsl"
#include "/lib/lighting/shadows.glsl"
#include "/lib/lighting/ao.glsl"
#include "/lib/lighting/lighting.glsl"

/* RENDERTARGETS: 0 */
layout(location = 0) out vec4 outColor;

// Short screen-space ray towards the light: catches contact shadows the shadow map misses
float contactShadow(vec3 viewPos, vec3 viewLight, float dither) {
    #if !defined SCREEN_SPACE_SHADOWS || !defined SHADOWS
        return 1.0;
    #else
        float dist = -viewPos.z;
        float len = 0.12 + dist * 0.01;
        const int steps = 12;
        vec3 stepV = viewLight * len / float(steps);
        vec3 p = viewPos + stepV * dither;
        for (int i = 0; i < steps; i++) {
            p += stepV;
            vec3 sp = viewToScreen(p);
            if (any(lessThan(sp.xy, vec2(0.0))) || any(greaterThan(sp.xy, vec2(1.0)))) break;
            float d = texture(depthtex0, sp.xy).r;
            if (d < HAND_DEPTH) continue;
            float sceneZ = linearizeDepth(d);
            float rayZ = -p.z;
            float diff = rayZ - sceneZ;
            if (diff > 0.02 && diff < len * 1.5) return 0.0;
        }
        return 1.0;
    #endif
}

void main() {
    ivec2 px = ivec2(gl_FragCoord.xy);
    float depth = texelFetch(depthtex0, px, 0).r;
    vec2 uv = vUV - taaOffset();
    vec3 viewPos = screenToView(vec3(uv, depth));
    vec3 playerPos = viewToPlayer(viewPos);
    vec3 dir = normalize(mat3(gbufferModelViewInverse) * viewPos);
    float dither = blueNoise(gl_FragCoord.xy);
    vec3 preEmissive = texelFetch(colortex0, px, 0).rgb;

    vec3 color;

    if (depth >= 1.0) {
        //-------------------------------------------------------------- sky
        float pixelAngle = 1.0 / (gbufferProjection[1][1] * viewHeight * 0.5);
        color = renderSky(dir, pixelAngle, dither);
        #if defined VOLUMETRIC_CLOUDS && defined OVERWORLD
            vec4 clouds = texelFetch(colortex5, px, 0);
            color = color * clouds.a + clouds.rgb;
        #endif
        color += preEmissive;
    } else {
        //-------------------------------------------------------------- surfaces
        GData g = unpackGData(texelFetch(colortex1, px, 0), texelFetch(colortex2, px, 0), texelFetch(colortex3, px, 0));
        bool hand = depth < HAND_DEPTH;

        #ifdef OVERWORLD
            applyWetness(g, playerPos + cameraPosition, wetness);
        #endif

        LightInputs li;
        li.lightDir = lightDirWorld();
        li.lightCol = vLightCol;
        li.ambTop = vAmbTop;
        li.ambBottom = vAmbBottom;
        li.lightRadius = vLightRadius;

        float ao = 1.0;
        #ifdef AO_ENABLED
            if (!hand && g.matId != MAT_EMISSIVE && g.matId != MAT_LAVA) {
                vec3 viewNormal = mat3(gbufferModelView) * g.normal;
                ao = gtao(depthtex0, uv, viewPos, viewNormal, blueNoise2(gl_FragCoord.xy));
            }
        #endif

        #if defined OVERWORLD || defined END
            vec3 viewLight = mat3(gbufferModelView) * li.lightDir;
            bool thinFoliage = g.matId == MAT_PLANT || g.matId == MAT_FOLIAGE;
            if (!hand && !thinFoliage && dot(g.geoNormal, li.lightDir) > 0.0) {
                li.lightCol *= contactShadow(viewPos, viewLight, dither);
            }
        #endif

        vec3 spec;
        color = shadeSurface(g, playerPos, dir, ao, dither, li, spec);
        color += spec;
        color += preEmissive;

        // clouds in front of terrain (mountains in clouds / flying above them)
        #if defined VOLUMETRIC_CLOUDS && defined OVERWORLD
            float camH = cameraPosition.y;
            float surfH = playerPos.y + cameraPosition.y;
            if (!hand && (camH > CLOUD_BASE || surfH > CLOUD_BASE)) {
                vec4 clouds = texelFetch(colortex5, px, 0);
                float cloudDist = texelFetch(colortex8, px, 0).r;
                if (cloudDist < length(playerPos)) color = color * clouds.a + clouds.rgb;
            }
        #endif
    }

    outColor = vec4(max(sanitize(color), vec3(0.0)), 1.0);
}

#endif
