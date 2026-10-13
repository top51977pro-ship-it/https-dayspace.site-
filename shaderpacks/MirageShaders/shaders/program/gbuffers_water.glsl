// Translucent terrain: water, stained glass, ice, slime, honey...
// Written forward-lit into the premultiplied translucent buffer (colortex3), plus the
// surface normal and material so the composite pass can add reflections and refraction.

#include "/lib/settings.glsl"
#include "/lib/uniforms.glsl"
#include "/lib/common.glsl"
#include "/lib/transforms.glsl"

//==================================================================================//
#ifdef VSH

in vec4 mc_Entity;
in vec4 mc_midTexCoord;
in vec4 at_tangent;

out vec2 texcoord;
out vec2 lmcoord;
out vec4 glcolor;
out vec3 normalW;
out vec4 tangentW;
out vec3 playerPos;
out vec2 midCoord;
out vec2 texHalf;
flat out int blockId;

void main() {
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    lmcoord = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
    lmcoord = saturate((lmcoord - 1.0 / 32.0) * 16.0 / 15.0);
    glcolor = gl_Color;
    blockId = int(mc_Entity.x + 0.5);

    vec3 viewPos = (gl_ModelViewMatrix * gl_Vertex).xyz;
    playerPos = viewToPlayer(viewPos);
    normalW = normalize(mat3(gbufferModelViewInverse) * (gl_NormalMatrix * gl_Normal));
    vec3 t = gl_NormalMatrix * at_tangent.xyz;
    tangentW = vec4(dot(t, t) > 1e-6 ? normalize(mat3(gbufferModelViewInverse) * t) : vec3(1.0, 0.0, 0.0),
                    at_tangent.w < 0.0 ? -1.0 : 1.0);
    midCoord = mc_midTexCoord.xy;
    texHalf = abs(texcoord - mc_midTexCoord.xy);

    #ifdef WATER_WAVES
    if (blockId == ID_WATER && normalW.y > 0.5) {
        // tiny vertical bob, keeps shorelines intact
        vec3 wp = playerPos + cameraPosition;
        playerPos.y += sin(frameTimeCounter * 1.4 * WATER_WAVE_SPEED + wp.x * 0.7 + wp.z * 0.45) * 0.012 * WATER_WAVE_STRENGTH;
    }
    #endif

    gl_Position = gl_ProjectionMatrix * vec4(playerToView(playerPos), 1.0);
    applyTAAJitter(gl_Position);
}

#endif
//==================================================================================//
#ifdef FSH

in vec2 texcoord;
in vec2 lmcoord;
in vec4 glcolor;
in vec3 normalW;
in vec4 tangentW;
in vec3 playerPos;
in vec2 midCoord;
in vec2 texHalf;
flat in int blockId;

#include "/lib/atmosphere.glsl"
#include "/lib/sky.glsl"
#include "/lib/shadows.glsl"
#ifdef OVERWORLD
#include "/lib/clouds.glsl"
#endif
#include "/lib/lighting.glsl"
#include "/lib/fog.glsl"
#include "/lib/water.glsl"
#include "/lib/ripples.glsl"

#ifdef PORTAL_EFFECT
#include "/lib/portal.glsl"
#endif

/* RENDERTARGETS: 3,1,2 */
layout(location = 0) out vec4 outTranslucent;
layout(location = 1) out vec4 outData;
layout(location = 2) out vec4 outMaterial;

void main() {
    setupAtmosphere();

    float dither = getDither(gl_FragCoord.xy);
    float dist = length(playerPos);
    vec3 viewDir = -playerPos / dist;
    vec3 normal = normalize(normalW);
    vec3 shadow;
    vec4 outCol;
    int material;
    float smoothness;

    if (blockId == ID_WATER) {
        material = MAT_WATER;
        smoothness = 1.0;

        #ifdef WATER_WAVES
        vec3 worldPos = playerPos + cameraPosition;
        float strength = WATER_WAVE_STRENGTH * mix(1.0, 0.35, smoothstep(24.0, 96.0, dist));
        if (normal.y > 0.5) {
            normal = getWaterNormal(worldPos.xz, strength);
            vec2 slope = getPlayerRipples(playerPos);
            #ifdef RAIN_RIPPLES
            slope += getRainRipples(worldPos.xz, rainStrength * rainExposure(lmcoord.y) * (1.0 - smoothstep(12.0, 36.0, dist))) * 1.3;
            #endif
            normal = normalize(normal + vec3(-slope.x, 0.0, -slope.y));
        } else if (normal.y > -0.5) {
            vec3 n2 = getWaterNormal(worldPos.xz + worldPos.y, strength * 0.5);
            normal = normalize(normal + vec3(n2.x, 0.0, n2.z));
        }
        #endif
        // underwater view of the surface faces downwards
        if (isEyeInWater == 1 && dot(normal, viewDir) < 0.0) normal = -normal;

        vec3 tint = getWaterTint(glcolor.rgb);
        vec3 lit = computeLighting(tint, normal, playerPos, lmcoord, 1.0, 0.0, 0.0, 0.02, 0.0, dither, shadow);
        float alpha = WATER_OPACITY;

        // sun / moon highlight (computeLighting skips it for smoothness 0)
        float spec = specularGGX(normal, viewDir, lightDir, 0.06, 0.02);
        vec3 highlight = lightColor * shadow * min(spec, 60.0);
        lit = lit * 0.6 + highlight / max(alpha, 0.1);

        lit = applyFog(lit, playerPos);
        outCol = vec4(lit, alpha);
    }
    #ifdef PORTAL_EFFECT
    else if (blockId == ID_NETHER_PORTAL) {
        material = MAT_PORTAL;
        smoothness = 0.0;
        vec3 N = normalize(normalW);
        vec3 T = normalize(tangentW.xyz - N * dot(tangentW.xyz, N));
        vec3 B = cross(N, T) * tangentW.w;
        vec2 tileSize = max(texHalf * 2.0, vec2(1e-6));
        outCol = netherPortal(texcoord, midCoord - texHalf, tileSize, T, B, N, normalize(playerPos), dither);
        // standing inside the portal: fade it so the screen isn't covered in purple
        float closeFade = saturate(dist - 0.3);
        outCol.rgb *= closeFade;
        outCol.a *= closeFade;
        outCol.rgb = applyFog(outCol.rgb, playerPos);
    }
    #endif
    else {
        vec4 albedo = texture(gtexture, texcoord) * glcolor;
        if (albedo.a < 0.02) discard;
        material = MAT_GLASS;
        smoothness = blockId == ID_ICE ? 0.92 : 0.96;

        vec3 lin = toLinear(albedo.rgb);
        float emission = blockId == ID_NETHER_PORTAL ? 0.9 : 0.0;
        if (emission > 0.0) smoothness = 0.0;
        vec3 lit = computeLighting(lin, normal, playerPos, lmcoord, 1.0, 0.0, smoothness, 0.04, emission, dither, shadow);
        lit = applyFog(lit, playerPos);
        outCol = vec4(lit, albedo.a);
    }

    outTranslucent = outCol;
    outData = vec4(encodeNormal(normal), lmcoord);
    outMaterial = vec4(encodeMat(material), smoothness, 0.0, 0.0);
}

#endif
